import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { createPrismaClient } from '../src/prisma/standalone-client';
import {
  MAIL_RETRY_BACKOFF_MS,
  MAIL_TRANSPORT,
} from '../src/modules/mail/mail.transport';
import {
  createE2eApp,
  envelopeData,
  httpServer,
  OWNER_EMAIL,
  OWNER_PASSWORD,
} from './utils/e2e-app';

// Reply-by-email through the REAL HTTP route, against a real PostgreSQL.
//
// THE SEAM, and why it is this one. Every layer the request passes through is production code —
// JwtAuthGuard, PermissionsGuard, ParseUUIDPipe, the ValidationPipe, MessagesAdminController,
// ContactReplyService, ContactMailService, MailService, the RFC 7807 filter and the envelope
// interceptor. Exactly ONE thing is replaced: `MAIL_TRANSPORT`, the Nodemailer transport, which is
// the last object before the network. That is deliberate and it is the difference from
// reply-delivery.e2e-spec.ts, which fakes `ContactMailService` and therefore proves the state
// machine while bypassing message construction, the recipient invariant, the retry loop and the
// header the provider actually reads. Faking either the reply service or ContactMailService here
// would bypass the exact business path this suite exists to prove.
//
// NO MAIL IS SENT AND NO RELAY IS CONTACTED. The transport token is replaced before the app is
// built, so the real `createTransport` factory never runs and no SMTP client is ever constructed.
//
// `MAIL_RETRY_BACKOFF_MS` is overridden to `[]` — one attempt, no real timers. Without it a refusal
// costs ten seconds of wall clock and, worse, produces THREE transport invocations, which would
// silently corrupt every send-count assertion below.

const DAY_MS = 24 * 60 * 60 * 1000;
const BARRIER_DEADLINE_MS = 2_000;
const BARRIER_POLL_MS = 25;

// The provider's header, written as a LITERAL rather than imported from mail.service.ts (where it
// is deliberately confined). A literal pins the wire format independently: if production renames
// the header, this fake reads `undefined` and the key assertions below fail — which is the
// direction the test should break in.
const PROVIDER_IDEMPOTENCY_HEADER = 'Resend-Idempotency-Key';

// Counts backends this database is currently making wait. `pg_blocking_pids` rather than counting
// `pg_locks` rows: two backends queued on one unique index produce a mix of lock types, so reading
// pg_locks by locktype miscounts. Established by refresh-token-rotation.e2e-spec.ts.
async function waitUntilBlocked(
  observer: PrismaClient,
  expected: number,
): Promise<void> {
  const startedAt = Date.now();
  for (;;) {
    const rows = await observer.$queryRaw<{ blocked: number }[]>`
      SELECT count(*)::int AS blocked
        FROM pg_stat_activity
       WHERE datname = current_database()
         AND cardinality(pg_blocking_pids(pid)) > 0
    `;
    if ((rows[0]?.blocked ?? 0) >= expected) {
      return;
    }
    if (Date.now() - startedAt > BARRIER_DEADLINE_MS) {
      // Throws rather than proceeding. A barrier that never formed would let the concurrent test
      // pass by running its two requests in sequence, and a race test that can pass without racing
      // proves nothing. This is the instrument's own self-check (§21), and it is load-bearing: it
      // is deliberately verified to FIRE in the sequential negative control.
      throw new Error(
        `Barrier never formed: expected ${expected} blocked backend(s) within ${BARRIER_DEADLINE_MS}ms.`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, BARRIER_POLL_MS));
  }
}

interface SentMail {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly providerKey: string | undefined;
  readonly headerNames: readonly string[];
}

// Models the external mail PROVIDER at the transport boundary — not the mail service.
//
// The distinction it exists to draw (§10): a transport INVOCATION is one call to `sendMail`, while
// an external LOGICAL SEND is one email a real recipient would receive. They are not the same
// number, and conflating them is what makes a naive fake report a duplicate-email defect that did
// not happen — or miss one that did. A provider that has already seen an idempotency key inside its
// retention window accepts the call and sends nothing, so the second invocation is real and the
// second email is not.
//
// Only the ONE documented property is modelled: same key within the window → no duplicate external
// email. Resend's HTTP-API replay semantics (a 409, a cached response body, the original message
// id) are NOT modelled — they are undocumented for the SMTP relay (ledger §5aj-E), and inventing
// them here would let a test depend on behaviour the real provider never promised. A replay is
// therefore given a DIFFERENT message id, so nothing downstream can quietly rely on it matching.
class FakeSmtpTransport {
  readonly invocations: SentMail[] = [];
  private readonly sentKeys = new Set<string>();
  private mode: 'accept' | 'reject' = 'accept';
  private replays = 0;

  reset(): void {
    this.invocations.length = 0;
    this.sentKeys.clear();
    this.mode = 'accept';
    this.replays = 0;
  }

  // A permanent 5xx rejection — the conclusive, pre-acceptance failure §13 asks for. `responseCode`
  // is what `isPermanentRejection` reads, so this models a relay that has DECIDED rather than one
  // that is merely unreachable.
  rejectConclusively(): void {
    this.mode = 'reject';
  }

  accept(): void {
    this.mode = 'accept';
  }

  // Distinct external emails: one per idempotency key the provider actually delivered.
  get externalSends(): number {
    return this.sentKeys.size;
  }

  get lastSent(): SentMail {
    const last = this.invocations.at(-1);
    if (last === undefined) {
      throw new Error('No transport invocation was recorded.');
    }
    return last;
  }

  sentWithKey(key: string): SentMail[] {
    return this.invocations.filter((call) => call.providerKey === key);
  }

  // Shaped as the sliver of Nodemailer's Transporter that MailService actually uses. Cast at the
  // override site rather than implementing the full interface — the same approach
  // `reply-delivery.e2e-spec.ts` takes
  // for its own fake, and the cast is checked by the fact that a wrong shape fails at runtime here.
  sendMail(options: {
    to?: unknown;
    subject?: unknown;
    text?: unknown;
    headers?: Record<string, string>;
  }): Promise<{ messageId: string }> {
    const headers = options.headers ?? {};
    const providerKey = headers[PROVIDER_IDEMPOTENCY_HEADER];

    this.invocations.push({
      to: String(options.to),
      subject: String(options.subject),
      text: String(options.text),
      providerKey,
      // Recorded so a test can assert which headers exist at all, not merely what they contain —
      // an absent header and an empty one are different facts.
      headerNames: Object.keys(headers),
    });

    if (this.mode === 'reject') {
      // Rejected BEFORE any key is recorded: a conclusively refused message was never sent, so it
      // must not count as an external send nor consume the key.
      return Promise.reject(
        Object.assign(new Error('550 Mailbox unavailable (fake transport).'), {
          responseCode: 550,
        }),
      );
    }

    if (providerKey !== undefined && this.sentKeys.has(providerKey)) {
      // The provider recognises the key: it accepts the call and sends NOTHING.
      this.replays += 1;
      return Promise.resolve({
        messageId: `<replay-${this.replays}@fake.invalid>`,
      });
    }

    if (providerKey !== undefined) {
      this.sentKeys.add(providerKey);
    }
    return Promise.resolve({
      messageId: `<send-${this.sentKeys.size}@fake.invalid>`,
    });
  }
}

interface Reply {
  id: string;
  contactMessageId: string;
  body: string;
  status: string;
  initiatedByUserId: string;
  createdAt: string;
  sentAt: string | null;
  failedAt: string | null;
}

describe('Reply delivery over HTTP (e2e)', () => {
  let app: INestApplication;
  let db: PrismaClient;
  let transport: FakeSmtpTransport;
  let ownerToken: string;
  // Two DISTINCT restricted operators, both holding `messages.reply` and nothing else relevant.
  // OWNER is used only to create fixtures: a reply attributed to OWNER could not distinguish
  // "the authenticated principal was recorded" from "the seed user happens to be everywhere".
  let operatorAToken: string;
  let operatorAId: string;
  let operatorBToken: string;
  let operatorBId: string;
  const unique = Date.now();

  const bearer = (token: string): Record<string, string> => ({
    Authorization: `Bearer ${token}`,
  });

  const createMessage = async (
    overrides: { email?: string | null; subject?: string } = {},
  ): Promise<string> => {
    const row = await db.contactMessage.create({
      data: {
        name: 'Alex Morgan',
        email:
          overrides.email === undefined
            ? 'visitor@example.com'
            : overrides.email,
        phone: null,
        subject: overrides.subject ?? 'Website enquiry',
        body: 'I would like to discuss a Nuxt build.',
        meta: {},
      },
    });
    return row.id;
  };

  // Creates a role granting exactly `messages.read` + `messages.reply`, a user holding it, and
  // returns that user's token and id.
  const createOperator = async (
    label: string,
  ): Promise<{ token: string; id: string }> => {
    const roleRes = await request(httpServer(app))
      .post('/api/v1/admin/roles')
      .set(bearer(ownerToken))
      .send({
        name: `Replier ${label} ${unique}`,
        permissions: ['messages.read', 'messages.reply'],
      })
      .expect(201);
    const roleId = envelopeData<{ id: string }>(roleRes).id;

    const email = `replier-${label}-${unique}@example.com`;
    const password = 'change-me-minimum-12';
    const userRes = await request(httpServer(app))
      .post('/api/v1/admin/users')
      .set(bearer(ownerToken))
      .send({ email, password, roleId })
      .expect(201);
    const id = envelopeData<{ id: string }>(userRes).id;

    const login = await request(httpServer(app))
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return {
      token: envelopeData<{ accessToken: string }>(login).accessToken,
      id,
    };
  };

  const postReply = (
    messageId: string,
    key: string,
    token: string,
    body = 'Thanks for reaching out — happy to talk.',
  ) =>
    request(httpServer(app))
      .post(`/api/v1/admin/messages/${messageId}/replies`)
      .set(bearer(token))
      .set('Idempotency-Key', key)
      .send({ body });

  beforeAll(async () => {
    transport = new FakeSmtpTransport();
    app = await createE2eApp({
      overrides: [
        { token: MAIL_TRANSPORT, value: transport },
        { token: MAIL_RETRY_BACKOFF_MS, value: [] },
      ],
    });
    db = createPrismaClient(process.env.DATABASE_URL ?? '');

    const login = await request(httpServer(app))
      .post('/api/v1/auth/login')
      .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD })
      .expect(200);
    ownerToken = envelopeData<{ accessToken: string }>(login).accessToken;

    const a = await createOperator('a');
    operatorAToken = a.token;
    operatorAId = a.id;
    const b = await createOperator('b');
    operatorBToken = b.token;
    operatorBId = b.id;
  });

  afterAll(async () => {
    await db.$disconnect();
    await app.close();
  });

  // Reset between tests so one test's provider keys can never satisfy another's idempotency
  // assertions (§20) — a leaked key would make a genuine duplicate send look prevented.
  beforeEach(() => {
    transport.reset();
  });

  // The override is what every other test in this file rests on. Asserted directly, because a
  // silently-unapplied override would leave the REAL transport provider in place, which returns
  // null in the e2e environment — and every delivery below would then report FAILED while still
  // "passing" any assertion that merely tolerated it.
  it('replaced the transport: the app sends through the fake and not through SMTP', async () => {
    const messageId = await createMessage();
    await postReply(messageId, `key-seam-${unique}`, operatorAToken).expect(
      201,
    );

    expect(transport.invocations).toHaveLength(1);
    expect(transport.externalSends).toBe(1);
  });

  // ===================================================================================
  // §5 — successful POST
  // ===================================================================================
  describe('a successful reply', () => {
    it('sends it, records SENT, and attributes it to the authenticated operator', async () => {
      const messageId = await createMessage({ subject: 'Nuxt migration' });
      const key = `key-success-${unique}`;

      const res = await postReply(
        messageId,
        key,
        operatorAToken,
        'Happy to help with the migration.',
      ).expect(201);

      const reply = envelopeData<Reply>(res);

      // --- HTTP: the response represents the persisted reply -------------------------
      expect(reply.contactMessageId).toBe(messageId);
      expect(reply.status).toBe('SENT');
      expect(reply.body).toBe('Happy to help with the migration.');
      expect(reply.sentAt).not.toBeNull();
      expect(reply.failedAt).toBeNull();
      expect(reply.initiatedByUserId).toBe(operatorAId);

      // --- Database: exactly one row, and it is the row the response described --------
      const rows = await db.contactMessageReply.findMany({
        where: { contactMessageId: messageId },
      });
      expect(rows).toHaveLength(1);
      const row = rows[0]!;
      expect(row.id).toBe(reply.id);
      expect(row.status).toBe('SENT');
      expect(row.sentAt).not.toBeNull();
      expect(row.failedAt).toBeNull();
      expect(row.initiatedByUserId).toBe(operatorAId);

      // --- Recipient: taken from the STORED message, and unreachable from the request --
      const sent = transport.lastSent;
      expect(sent.to).toBe('visitor@example.com');

      // --- Subject: the existing normalization applied -------------------------------
      expect(sent.subject).toBe('Re: Nuxt migration');

      // --- Body: the operator's exact plain text, undecorated ------------------------
      expect(sent.text).toBe('Happy to help with the migration.');

      // --- Provider: one logical send under the row-derived key ----------------------
      expect(sent.providerKey).toBe(`contact-reply/${row.id}`);
      expect(sent.headerNames).toContain(PROVIDER_IDEMPOTENCY_HEADER);
      expect(transport.invocations).toHaveLength(1);
      expect(transport.externalSends).toBe(1);

      // --- Public response: no transport internals, no secrets ------------------------
      const published = Object.keys(reply);
      expect(published).not.toContain('providerMessageId');
      expect(published).toEqual(
        expect.arrayContaining(['id', 'status', 'initiatedByUserId']),
      );
      // The stored diagnostic exists but is not published — asserting both directions, so this
      // cannot pass merely because the column was never written.
      expect(row.providerMessageId).toBe('<send-1@fake.invalid>');
      expect(JSON.stringify(res.body)).not.toContain('fake.invalid');
    });

    it('cannot be aimed at a recipient the caller chooses', async () => {
      const messageId = await createMessage({ email: 'real@example.com' });

      // `to` is not a field on the DTO; the whitelist/forbid ValidationPipe rejects it outright
      // rather than silently dropping it, so the attempt cannot even be expressed.
      await request(httpServer(app))
        .post(`/api/v1/admin/messages/${messageId}/replies`)
        .set(bearer(operatorAToken))
        .set('Idempotency-Key', `key-smuggle-${unique}`)
        .send({ body: 'Hello.', to: 'attacker@example.com' })
        .expect(422);

      expect(transport.invocations).toHaveLength(0);
    });
  });

  // ===================================================================================
  // §6 — same-key sequential replay
  // ===================================================================================
  describe('a same-key sequential replay of a SENT attempt', () => {
    it('returns the original attempt, sends nothing, and never moves its owner', async () => {
      const messageId = await createMessage();
      const key = `key-replay-sent-${unique}`;

      const first = await postReply(messageId, key, operatorAToken).expect(201);
      const original = envelopeData<Reply>(first);
      expect(original.status).toBe('SENT');
      expect(transport.invocations).toHaveLength(1);

      // A DIFFERENT authorized operator repeats the same key. This pins ownership stability at the
      // same time as the replay semantics: the record of who sent that email must not follow
      // whoever happened to repeat the request.
      const second = await postReply(messageId, key, operatorBToken).expect(
        200,
      );
      const replayed = envelopeData<Reply>(second);

      // The terminal-state branch itself, not merely "a unique constraint stopped row two".
      expect(replayed.id).toBe(original.id);
      expect(replayed.status).toBe('SENT');
      expect(replayed.sentAt).toBe(original.sentAt);
      expect(replayed.initiatedByUserId).toBe(operatorAId);
      expect(replayed.initiatedByUserId).not.toBe(operatorBId);

      // NO second delivery attempt reached the transport at all — the strong property, distinct
      // from "the provider deduplicated it".
      expect(transport.invocations).toHaveLength(1);
      expect(transport.externalSends).toBe(1);

      await expect(
        db.contactMessageReply.count({ where: { idempotencyKey: key } }),
      ).resolves.toBe(1);
    });
  });

  // ===================================================================================
  // Same-key CONCURRENT POSTs — the primary idempotency test of this suite
  // ===================================================================================
  describe('two concurrent same-key POSTs', () => {
    it('produce one reply, one identity, one provider key and exactly one external email', async () => {
      const messageId = await createMessage();
      const key = `key-race-${unique}`;

      const blocker = createPrismaClient(process.env.DATABASE_URL ?? '');
      const observer = createPrismaClient(process.env.DATABASE_URL ?? '');
      let releaseBlocker: () => void = () => {};
      const blockerReleased = new Promise<void>((resolve) => {
        releaseBlocker = resolve;
      });
      let inserted: () => void = () => {};
      const blockerInserted = new Promise<void>((resolve) => {
        inserted = resolve;
      });

      const ownerRow = await db.user.findFirstOrThrow({
        where: { email: OWNER_EMAIL },
      });

      // The barrier is the unique index itself, not a sleep. This transaction INSERTs the key and
      // holds it uncommitted, so BOTH real requests must queue on the index behind it.
      //
      // It ROLLS BACK (by throwing) rather than committing. A committed blocker would win the key
      // outright and both requests would merely replay the fixture's own row — "same logical reply
      // id" would then be a statement about the barrier, not about the two requests racing.
      const held = blocker
        .$transaction(
          async (tx) => {
            await tx.contactMessageReply.create({
              data: {
                contactMessageId: messageId,
                body: 'Held by the barrier transaction.',
                idempotencyKey: key,
                initiatedByUserId: ownerRow.id,
              },
            });
            // Signal only AFTER the uncommitted insert exists. Signalling earlier would let the
            // requests fire first, win outright, and prove nothing about contention.
            inserted();
            await blockerReleased;
            throw new Error('rollback: barrier released');
          },
          { timeout: 15_000 },
        )
        .catch(() => undefined);

      let a: request.Response;
      let b: request.Response;
      try {
        await blockerInserted;

        // `.then()` is what DISPATCHES a supertest request — a `Test` object builds lazily and
        // issues no HTTP until subscribed to. Without it these are unsent request objects, the
        // barrier below never sees two blocked backends, and the race never happens. This was
        // learned the hard way: a lazy request object used as a barrier signal passes green and
        // proves nothing.
        const pendingA = postReply(
          messageId,
          key,
          operatorAToken,
          'From A.',
        ).then((res) => res);
        const pendingB = postReply(
          messageId,
          key,
          operatorBToken,
          'From B.',
        ).then((res) => res);

        // BOTH requests are queued on the index simultaneously. This is the proof of real overlap,
        // and it throws loudly if contention never forms.
        await waitUntilBlocked(observer, 2);

        releaseBlocker();
        await held;

        [a, b] = await Promise.all([pendingA, pendingB]);
      } finally {
        releaseBlocker();
        await held;
        await Promise.all([blocker.$disconnect(), observer.$disconnect()]);
      }

      // --- DATABASE: exactly ONE row for (message, key) -------------------------------
      const rows = await db.contactMessageReply.findMany({
        where: { contactMessageId: messageId, idempotencyKey: key },
      });
      expect(rows).toHaveLength(1);
      const row = rows[0]!;

      // Neither request replayed the barrier's row: it rolled back, so the surviving row was
      // created by one of the two real requests.
      expect(row.body).not.toBe('Held by the barrier transaction.');
      expect([operatorAId, operatorBId]).toContain(row.initiatedByUserId);

      // --- IDENTITY: both responses name the SAME logical reply -----------------------
      expect(a.status).toBeGreaterThanOrEqual(200);
      expect(b.status).toBeGreaterThanOrEqual(200);
      const idA = envelopeData<Reply>(a).id;
      const idB = envelopeData<Reply>(b).id;
      expect(idA).toBe(row.id);
      expect(idB).toBe(row.id);

      // Exactly one request created it: one 201, one 200. Two 201s would mean the idempotency
      // guarantee never fired.
      expect([a.status, b.status].sort()).toEqual([200, 201]);

      // --- PROVIDER KEY: every attempt for this reply used the SAME key ---------------
      const expectedKey = `contact-reply/${row.id}`;
      expect(transport.invocations.length).toBeGreaterThanOrEqual(1);
      for (const call of transport.invocations) {
        expect(call.providerKey).toBe(expectedKey);
      }

      // --- EXTERNAL EFFECT: exactly ONE email to a real person ------------------------
      expect(transport.externalSends).toBe(1);

      // --- OBSERVABILITY: the invocation count is RECORDED, not pinned -----------------
      // Transport invocations may legitimately be 1 or 2 and both are correct. If the loser reads
      // the winner's row while it is still PENDING it recovers under the same key — a second
      // invocation the provider deduplicates. If the winner already finalized to SENT, the loser
      // returns without sending. Pinning either number would make a correct interleaving flake, so
      // the assertion is on the load-bearing invariant (one external email) and the observed count
      // is reported. The implementation does NOT guarantee a single MailService call, so this
      // suite does not claim one.
      expect(transport.invocations.length).toBeLessThanOrEqual(2);

      console.log(
        `[concurrent same-key] transport invocations=${transport.invocations.length}, ` +
          `external logical sends=${transport.externalSends}, statuses=${a.status}/${b.status}`,
      );

      // --- FINAL STATE: coherent, and no ownership rewrite ----------------------------
      expect(['SENT', 'PENDING']).toContain(row.status);
      expect(row.initiatedByUserId).toBe(
        envelopeData<Reply>(a.status === 201 ? a : b).initiatedByUserId,
      );
    });
  });

  // ===================================================================================
  // §12 — different application keys are different logical replies
  // ===================================================================================
  describe('two different application keys on the same message', () => {
    it('are two independent replies with two provider keys and two emails', async () => {
      const messageId = await createMessage();
      const keyA = `key-distinct-a-${unique}`;
      const keyB = `key-distinct-b-${unique}`;

      // The same BODY deliberately: a repeated message text is not a duplicate when the
      // application keys differ, and nothing may serialize or collapse replies per message.
      const [resA, resB] = await Promise.all([
        postReply(messageId, keyA, operatorAToken, 'Same text.').then((r) => r),
        postReply(messageId, keyB, operatorBToken, 'Same text.').then((r) => r),
      ]);

      expect(resA.status).toBe(201);
      expect(resB.status).toBe(201);

      const replyA = envelopeData<Reply>(resA);
      const replyB = envelopeData<Reply>(resB);
      expect(replyA.id).not.toBe(replyB.id);
      expect(replyA.status).toBe('SENT');
      expect(replyB.status).toBe('SENT');

      const rows = await db.contactMessageReply.findMany({
        where: { contactMessageId: messageId },
      });
      expect(rows).toHaveLength(2);

      // Two distinct provider keys, and two external emails.
      expect(transport.sentWithKey(`contact-reply/${replyA.id}`)).toHaveLength(
        1,
      );
      expect(transport.sentWithKey(`contact-reply/${replyB.id}`)).toHaveLength(
        1,
      );
      expect(transport.externalSends).toBe(2);

      // Each attempt is attributed to the operator who made it.
      expect(replyA.initiatedByUserId).toBe(operatorAId);
      expect(replyB.initiatedByUserId).toBe(operatorBId);
    });
  });

  // ===================================================================================
  // §13/§14/§15 — conclusive provider failure, its replay, and a deliberate retry
  // ===================================================================================
  describe('a conclusively refused first send', () => {
    it('records FAILED, answers with the attempt rather than an error, and leaks no transport text', async () => {
      const messageId = await createMessage();
      const key = `key-failed-${unique}`;
      transport.rejectConclusively();

      // The approved semantics: the attempt was RECORDED, so this is a 201 carrying FAILED — not
      // an HTTP error. (Pinned from the controller's own documented contract, not inferred.)
      const res = await postReply(messageId, key, operatorAToken).expect(201);
      const reply = envelopeData<Reply>(res);

      expect(reply.status).toBe('FAILED');
      expect(reply.failedAt).not.toBeNull();
      expect(reply.sentAt).toBeNull();

      const row = await db.contactMessageReply.findUniqueOrThrow({
        where: { id: reply.id },
      });
      expect(row.status).toBe('FAILED');
      expect(row.failedAt).not.toBeNull();
      expect(row.sentAt).toBeNull();
      expect(row.providerMessageId).toBeNull();

      // No raw SMTP text, no provider stack, no secrets anywhere in the response.
      const serialized = JSON.stringify(res.body);
      expect(serialized).not.toContain('responseCode');
      expect(serialized).not.toContain('Mailbox unavailable');
      expect(serialized).not.toContain('fake transport');

      // One attempt only — the retry backoff override is what makes this count meaningful.
      expect(transport.invocations).toHaveLength(1);
      expect(transport.externalSends).toBe(0);
    });

    it('is never re-sent by a same-key replay, even once the provider recovers', async () => {
      const messageId = await createMessage();
      const key = `key-failed-replay-${unique}`;
      transport.rejectConclusively();

      const first = envelopeData<Reply>(
        await postReply(messageId, key, operatorAToken).expect(201),
      );
      expect(first.status).toBe('FAILED');

      // The provider is healthy again — and it still must not be contacted. A replay repeats a
      // request; it does not ask for a second attempt.
      transport.accept();
      const replayed = envelopeData<Reply>(
        await postReply(messageId, key, operatorBToken).expect(200),
      );

      expect(replayed.id).toBe(first.id);
      expect(replayed.status).toBe('FAILED');
      expect(replayed.initiatedByUserId).toBe(operatorAId);
      expect(transport.invocations).toHaveLength(1);
      expect(transport.externalSends).toBe(0);
    });

    it('is retried only by a NEW application key, which never recycles the failed row', async () => {
      const messageId = await createMessage();
      const keyA = `key-retry-a-${unique}`;
      const keyB = `key-retry-b-${unique}`;

      transport.rejectConclusively();
      const attemptA = envelopeData<Reply>(
        await postReply(messageId, keyA, operatorAToken).expect(201),
      );
      expect(attemptA.status).toBe('FAILED');

      transport.accept();
      const attemptB = envelopeData<Reply>(
        await postReply(messageId, keyB, operatorAToken).expect(201),
      );
      expect(attemptB.status).toBe('SENT');
      expect(attemptB.id).not.toBe(attemptA.id);

      // History keeps BOTH: the failed attempt is preserved, not overwritten or recycled.
      const rows = await db.contactMessageReply.findMany({
        where: { contactMessageId: messageId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      expect(rows.map((r) => r.status)).toEqual(['FAILED', 'SENT']);
      expect(rows.map((r) => r.id)).toEqual([attemptA.id, attemptB.id]);

      // Independent provider keys — the retry is a genuinely new logical send.
      expect(
        transport.sentWithKey(`contact-reply/${attemptA.id}`),
      ).toHaveLength(1);
      expect(
        transport.sentWithKey(`contact-reply/${attemptB.id}`),
      ).toHaveLength(1);
      expect(transport.externalSends).toBe(1);
    });
  });

  // ===================================================================================
  // §16/§17 — provider accepted, DB finalization failed, and the recovery
  // ===================================================================================
  describe('a send the provider accepted whose SENT write then failed', () => {
    it('leaves the reply PENDING, fails the request, and never marks it FAILED', async () => {
      const messageId = await createMessage();
      const key = `key-finalize-${unique}`;

      // The one-shot failure seam: the FIRST `update` after the provider accepts throws. A plain
      // Error (not a Prisma known-request error) is deliberate — the filter maps Prisma codes to
      // 4xx, and this must surface as the server fault it actually is.
      const prisma = app.get(PrismaService);
      const spy = jest
        .spyOn(prisma.contactMessageReply, 'update')
        .mockImplementationOnce(() => {
          throw new Error('finalize write failed (injected)');
        });

      let replyId: string;
      try {
        const res = await postReply(messageId, key, operatorAToken);

        // HTTP: a stable server failure under the current exception policy.
        expect(res.status).toBe(500);
        expect(res.headers['content-type']).toContain(
          'application/problem+json',
        );

        // PROVIDER: the email really did go out, exactly once.
        expect(transport.externalSends).toBe(1);
        expect(transport.invocations).toHaveLength(1);

        // DB: the row survives, PENDING, with no terminal timestamp in either direction.
        const row = await db.contactMessageReply.findFirstOrThrow({
          where: { contactMessageId: messageId, idempotencyKey: key },
        });
        replyId = row.id;
        expect(row.status).toBe('PENDING');
        expect(row.sentAt).toBeNull();
        expect(row.failedAt).toBeNull();
        expect(transport.lastSent.providerKey).toBe(`contact-reply/${row.id}`);

        // Exactly one row: no compensation send, no second attempt.
        await expect(
          db.contactMessageReply.count({
            where: { contactMessageId: messageId },
          }),
        ).resolves.toBe(1);
      } finally {
        // Restored in `finally` so the seam cannot leak into any later test (§20).
        spy.mockRestore();
      }

      // ----- §17: recovery under the SAME key, inside the 24h window -------------------
      const recovered = envelopeData<Reply>(
        await postReply(messageId, key, operatorAToken).expect(200),
      );

      // Same logical reply, same row — not a second one.
      expect(recovered.id).toBe(replyId);
      expect(recovered.status).toBe('SENT');
      expect(recovered.sentAt).not.toBeNull();
      expect(recovered.failedAt).toBeNull();
      expect(recovered.initiatedByUserId).toBe(operatorAId);

      const rows = await db.contactMessageReply.findMany({
        where: { contactMessageId: messageId },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]!.status).toBe('SENT');

      // The recovery re-attempt used the SAME provider key, so the provider replayed it and the
      // visitor received exactly ONE email across both requests. Correctness rests on the reply
      // identity, the key, and the provider's duplicate-send guarantee — never on the returned
      // message id, which the fake deliberately varies on replay.
      expect(transport.invocations).toHaveLength(2);
      for (const call of transport.invocations) {
        expect(call.providerKey).toBe(`contact-reply/${replyId}`);
      }
      expect(transport.externalSends).toBe(1);
    });

    it('is left strictly alone once the provider window has passed', async () => {
      const messageId = await createMessage();
      const key = `key-stale-guard-${unique}`;

      // A PENDING attempt older than the 24h window, written directly: this is the fixture for the
      // recovery BOUNDARY, not the boundary matrix itself, which lives in
      // `reply-http-security.e2e-spec.ts`.
      const stale = await db.contactMessageReply.create({
        data: {
          contactMessageId: messageId,
          body: 'An attempt whose outcome was never resolved.',
          idempotencyKey: key,
          initiatedByUserId: operatorAId,
          createdAt: new Date(Date.now() - DAY_MS - 60_000),
        },
      });

      const res = envelopeData<Reply>(
        await postReply(messageId, key, operatorBToken).expect(200),
      );

      expect(res.id).toBe(stale.id);
      expect(res.status).toBe('PENDING');
      // Nothing was sent: past the window the provider may have forgotten the key, so a re-send
      // could mail a real person twice.
      expect(transport.invocations).toHaveLength(0);
      expect(transport.externalSends).toBe(0);
    });
  });
});
