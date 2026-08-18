// The SMTP config group must be ON before `app.module.ts` is imported, so this side-effect import
// is deliberately FIRST and must stay first. See `e2e-mail-env.ts` for why a `beforeAll` assignment
// cannot work here (it was measured, and it does not).
import './utils/e2e-mail-env';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppConfigService } from '../src/config/app-config.service';
import { PrismaClient } from '../src/generated/prisma/client';
import { createPrismaClient } from '../src/prisma/standalone-client';
import {
  MAIL_RETRY_BACKOFF_MS,
  MAIL_TRANSPORT,
} from '../src/modules/mail/mail.transport';
import { E2E_MAIL_ENV } from './utils/e2e-mail-env';
import {
  createE2eApp,
  envelopeData,
  httpServer,
  OWNER_EMAIL,
  OWNER_PASSWORD,
} from './utils/e2e-app';

// Reply-by-email: the security, history and reliability matrix, through the REAL HTTP routes against
// a real PostgreSQL.
//
// THE SEAM IS `reply-http-delivery.e2e-spec.ts`'S, REUSED RATHER THAN REBUILT. Exactly one
// provider is replaced — `MAIL_TRANSPORT`,
// the Nodemailer transport, the last object before the network — plus `MAIL_RETRY_BACKOFF_MS` to
// collapse the retry schedule to a single attempt. Everything above the token is production code:
// the guards, the pipes, the controller, `ContactReplyService`, `ContactMailService`, `MailService`,
// the RFC 7807 filter and the envelope interceptor. Faking `ContactMailService` (the domain seam)
// would bypass message construction, the recipient invariant and the provider header, which are
// precisely what §16 exists to prove.
//
// NO MAIL IS SENT AND NO RELAY IS CONTACTED. An overridden provider's factory never runs, so
// `mailTransportProvider` never calls `createTransport` and no SMTP client is ever constructed.
//
// WHAT THIS SUITE ADDS TO THAT CONFIGURATION, and why it needs it. That suite runs with the SMTP group OFF,
// which is fine for delivery — `MailService.isEnabled` reads `transport !== null`, so a fake is
// enough to make replies send. It is NOT enough for §§15–16: with the group off, `config.mail.from`
// and `ownerNotificationTo` are both null, so `buildOwnerNotification` THROWS on the null destination
// and `dispatchForSubmission` catches it and logs. The contact-notification path would then reach the
// transport zero times and every regression test over it would pass vacuously, which is the
// instrument-cannot-discriminate failure §20 forbids. It also makes §16's "configured sender"
// unassertable. So this suite turns the group on — through the REAL `AppConfigService`, never by
// overriding it, which would move the seam above `MAIL_TRANSPORT`.

const DAY_MS = 24 * 60 * 60 * 1000;
const DRAIN_DEADLINE_MS = 3_000;
const DRAIN_POLL_MS = 20;

// Written as a LITERAL rather than imported from mail.service.ts, where it is deliberately confined.
// A literal pins the wire format independently: if production renamed the header, this fake would
// read `undefined` and the key assertions would fail — the direction the test should break in.
const PROVIDER_IDEMPOTENCY_HEADER = 'Resend-Idempotency-Key';

interface SentMail {
  readonly from: string | undefined;
  readonly to: string;
  readonly replyTo: string | undefined;
  readonly subject: string;
  readonly text: string;
  readonly providerKey: string | undefined;
  // Recorded so a test can assert which headers exist AT ALL, not merely what they contain. An
  // absent header and an empty one are different facts, and §16-B turns on the difference.
  readonly headerNames: readonly string[];
}

// Models the external mail PROVIDER at the transport boundary — not the mail service.
//
// The distinction (§5am-D): a transport INVOCATION is one `sendMail` call; an external LOGICAL SEND
// is one email a real recipient would receive. They are not the same number. A provider that has
// already seen an idempotency key inside its retention window accepts the call and sends nothing, so
// the second invocation is real and the second email is not. Only that ONE documented property is
// modelled; Resend's HTTP-API replay semantics are undocumented for the SMTP relay (ledger §5aj-E),
// so a replay is given a DIFFERENT message id to stop anything downstream relying on it.
class FakeSmtpTransport {
  readonly invocations: SentMail[] = [];
  private readonly sentKeys = new Set<string>();
  private mode: 'accept' | 'reject' = 'accept';
  private replays = 0;

  // Full reset (§2): invocations, the provider-key registry, the logical-send counter, the
  // configured failure behaviour. No test may inherit provider idempotency state from another — a
  // leaked key would make a genuine duplicate send look prevented.
  reset(): void {
    this.invocations.length = 0;
    this.sentKeys.clear();
    this.mode = 'accept';
    this.replays = 0;
  }

  // A permanent 5xx rejection: `responseCode` is what `isPermanentRejection` reads, so this models a
  // relay that has DECIDED rather than one that is merely unreachable.
  rejectConclusively(): void {
    this.mode = 'reject';
  }

  accept(): void {
    this.mode = 'accept';
  }

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

  sentTo(recipient: string): SentMail[] {
    return this.invocations.filter((call) => call.to === recipient);
  }

  // Shaped as the sliver of Nodemailer's Transporter that MailService actually uses. `from` and
  // `replyTo` are typed as `string | undefined` rather than `unknown` because that is exactly what
  // `MailService.send` passes (`from ?? undefined`, `message.replyTo`) — typing them honestly is
  // what lets their absence be asserted without a stringification cast.
  sendMail(options: {
    from?: string;
    to?: unknown;
    replyTo?: string;
    subject?: unknown;
    text?: unknown;
    headers?: Record<string, string>;
  }): Promise<{ messageId: string }> {
    const headers = options.headers ?? {};
    const providerKey = headers[PROVIDER_IDEMPOTENCY_HEADER];

    this.invocations.push({
      from: options.from,
      to: String(options.to),
      replyTo: options.replyTo,
      subject: String(options.subject),
      text: String(options.text),
      providerKey,
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

// getInstance<T>() is generic; a minimal structural type keeps this strict without importing the
// express type surface. Same approach as contact.e2e-spec.ts.
interface TrustProxyApp {
  set(setting: string, value: unknown): unknown;
}

describe('Reply security, history and reliability over HTTP (e2e)', () => {
  let app: INestApplication;
  let db: PrismaClient;
  let transport: FakeSmtpTransport;
  let ownerToken: string;

  // FOUR distinct principals, because the permission matrix (§12) is exactly what a single
  // all-permissions operator cannot prove. The delivery suite's `createOperator` grants `messages.read` AND
  // `messages.reply` together, which passes every cell of the matrix vacuously.
  let replierToken: string; // messages.read + messages.reply — the ordinary operator
  let replierId: string;
  let replierBToken: string; // a SECOND full operator, for cross-operator replay/ownership
  let replierBId: string;
  let readerToken: string; // messages.read only
  let readerId: string;
  let replyOnlyToken: string; // messages.reply only — must NOT gain read
  let replyOnlyId: string;
  let outsiderToken: string; // authenticated, neither permission

  const unique = Date.now();

  // A fresh documentation-range IP (TEST-NET-3) per contact REQUEST. `POST /contact` is throttled on
  // the client IP (3/hour), and the guard counts BEFORE the handler, so a fresh IP per request is
  // what keeps this suite from self-429ing. Established by contact.e2e-spec.ts.
  let ipCounter = 0;
  const nextIp = (): string => `203.0.113.${(ipCounter++ % 250) + 1}`;

  // A separate documentation range (TEST-NET-2) for LOGINS, which are throttled at 5 per 15 minutes
  // per IP. This suite needs six principals, so a shared bucket self-429s on the sixth — which is
  // exactly how it first failed. Kept disjoint from the contact range above so neither can consume
  // the other's budget.
  let loginIpCounter = 0;
  const nextLoginIp = (): string =>
    `198.51.100.${(loginIpCounter++ % 250) + 1}`;

  const bearer = (token: string): Record<string, string> => ({
    Authorization: `Bearer ${token}`,
  });

  const createMessage = async (
    overrides: {
      email?: string | null;
      phone?: string | null;
      subject?: string;
    } = {},
  ): Promise<string> => {
    const row = await db.contactMessage.create({
      data: {
        name: 'Alex Morgan',
        email:
          overrides.email === undefined
            ? 'visitor@example.com'
            : overrides.email,
        phone: overrides.phone ?? null,
        subject: overrides.subject ?? 'Website enquiry',
        body: 'I would like to discuss a Nuxt build.',
        meta: {},
      },
    });
    return row.id;
  };

  // Creates a role granting exactly `permissions`, a user holding it, and returns token + id.
  const createPrincipal = async (
    label: string,
    permissions: string[],
  ): Promise<{ token: string; id: string }> => {
    const roleRes = await request(httpServer(app))
      .post('/api/v1/admin/roles')
      .set(bearer(ownerToken))
      .send({ name: `B2 ${label} ${unique}`, permissions })
      .expect(201);
    const roleId = envelopeData<{ id: string }>(roleRes).id;

    const email = `b2-${label}-${unique}@example.com`;
    const password = 'change-me-minimum-12';
    const userRes = await request(httpServer(app))
      .post('/api/v1/admin/users')
      .set(bearer(ownerToken))
      .send({ email, password, roleId })
      .expect(201);
    const id = envelopeData<{ id: string }>(userRes).id;

    const login = await request(httpServer(app))
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', nextLoginIp())
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

  const getReplies = (messageId: string, token: string) =>
    request(httpServer(app))
      .get(`/api/v1/admin/messages/${messageId}/replies`)
      .set(bearer(token));

  const submitContact = (body: Record<string, unknown>) =>
    request(httpServer(app))
      .post('/api/v1/contact')
      .set('X-Forwarded-For', nextIp())
      .send(body);

  // Waits until the transport has been invoked `expected` times, then returns.
  //
  // `contact.service.ts` dispatches notification mail DETACHED from the request (`void … .catch`),
  // so the HTTP response returns before any send has happened. Two things follow, and both are
  // load-bearing: a count asserted immediately after a contact POST is a race, and — worse — an
  // in-flight dispatch can land AFTER a later test's `beforeEach` reset and inject a phantom
  // invocation into an unrelated test's counters. Every contact test therefore drains before it
  // ends. THROWS on timeout rather than returning: a drain that silently gave up would let a test
  // that sent nothing assert "nothing was sent" and pass for the wrong reason.
  const drainMail = async (expected: number): Promise<void> => {
    const startedAt = Date.now();
    while (transport.invocations.length < expected) {
      if (Date.now() - startedAt > DRAIN_DEADLINE_MS) {
        throw new Error(
          `Mail never drained: expected ${expected} transport invocation(s) within ` +
            `${DRAIN_DEADLINE_MS}ms, saw ${transport.invocations.length}.`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, DRAIN_POLL_MS));
    }
  };

  beforeAll(async () => {
    transport = new FakeSmtpTransport();
    app = await createE2eApp({
      overrides: [
        { token: MAIL_TRANSPORT, value: transport },
        { token: MAIL_RETRY_BACKOFF_MS, value: [] },
      ],
    });
    // `POST /contact` is keyed on the trusted client IP; without this every request shares the one
    // 127.0.0.1 bucket. Set on THIS suite's own Express instance — each suite builds its own app and
    // e2e runs --runInBand, so it never leaks.
    (app.getHttpAdapter().getInstance() as TrustProxyApp).set(
      'trust proxy',
      true,
    );

    db = createPrismaClient(process.env.DATABASE_URL ?? '');

    const login = await request(httpServer(app))
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', nextLoginIp())
      .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD })
      .expect(200);
    ownerToken = envelopeData<{ accessToken: string }>(login).accessToken;

    const replier = await createPrincipal('replier', [
      'messages.read',
      'messages.reply',
    ]);
    replierToken = replier.token;
    replierId = replier.id;

    const replierB = await createPrincipal('replier-b', [
      'messages.read',
      'messages.reply',
    ]);
    replierBToken = replierB.token;
    replierBId = replierB.id;

    const reader = await createPrincipal('reader', ['messages.read']);
    readerToken = reader.token;
    readerId = reader.id;

    const replyOnly = await createPrincipal('reply-only', ['messages.reply']);
    replyOnlyToken = replyOnly.token;
    replyOnlyId = replyOnly.id;

    // Deliberately a permission from an unrelated module: authenticated, and holding nothing that
    // touches messages.
    const outsider = await createPrincipal('outsider', ['categories.read']);
    outsiderToken = outsider.token;
  }, 60_000);

  afterAll(async () => {
    await db.$disconnect();
    await app.close();
  });

  beforeEach(() => {
    transport.reset();
  });

  // ===================================================================================
  // Preconditions — the two things every assertion below rests on
  // ===================================================================================
  describe('the harness', () => {
    // A silently-unapplied override would leave the REAL transport provider, which builds a
    // Nodemailer client from the (now enabled) SMTP group — so this is asserted on the FAKE's own
    // counters, which only move if the fake is the object in the graph.
    it('routes mail through the fake transport and never through SMTP', async () => {
      const messageId = await createMessage();
      await postReply(messageId, `key-seam-${unique}`, replierToken).expect(
        201,
      );

      expect(transport.invocations).toHaveLength(1);
      expect(transport.externalSends).toBe(1);
    });

    // The config half. Without this the notification path throws on a null destination before it
    // reaches the transport, and §§15–16 would pass while proving nothing. Asserted against the
    // exported values rather than re-typed literals, so the two cannot drift.
    it('resolved the real SMTP config group, so the notification path can run', () => {
      const mail = app.get(AppConfigService).mail;

      expect(mail.enabled).toBe(true);
      expect(mail.from).toBe(E2E_MAIL_ENV.SMTP_FROM);
      expect(mail.ownerNotificationTo).toBe(
        E2E_MAIL_ENV.CONTACT_NOTIFICATION_TO,
      );
    });
  });

  // ===================================================================================
  // §9 — stale PENDING over HTTP, and §10's boundary at the HTTP layer
  // ===================================================================================
  describe('a PENDING attempt whose provider window has expired', () => {
    // The deadline is `createdAt + 24h` and the comparison is `<`, so this row — a full minute past
    // it — is unambiguously outside. A deterministic offset from a captured `now`, never a real
    // timer and never a sleep.
    it('is returned unchanged, is never re-sent, and keeps its original owner', async () => {
      const messageId = await createMessage();
      const key = `key-stale-${unique}`;
      const createdAt = new Date(Date.now() - DAY_MS - 60_000);

      const stale = await db.contactMessageReply.create({
        data: {
          contactMessageId: messageId,
          body: 'An attempt whose outcome was never resolved.',
          idempotencyKey: key,
          initiatedByUserId: replierId,
          createdAt,
        },
      });

      // MAIL first (§4): this is the assertion the negative control must reach, so it is ordered
      // ahead of everything a mutation would trip earlier. Past the window the provider may have
      // forgotten the key, so a re-send could mail a real person a second time.
      const res = await postReply(
        messageId,
        key,
        // A DIFFERENT operator replays it, so the ownership assertion below is not satisfied by
        // the same principal simply being everywhere.
        replierBToken,
      ).expect(200);

      expect(transport.invocations).toHaveLength(0);
      expect(transport.externalSends).toBe(0);

      const body = envelopeData<Reply>(res);
      expect(body.id).toBe(stale.id);
      // Not FAILED, not SENT, not some new state: the outcome is permanently unknown and the API
      // does not invent one.
      expect(body.status).toBe('PENDING');
      expect(body.sentAt).toBeNull();
      expect(body.failedAt).toBeNull();
      // The initiating operator is unchanged — a replay by someone else does not take the record.
      expect(body.initiatedByUserId).toBe(replierId);

      // DB: the same single row, untouched in every column the response reports.
      const rows = await db.contactMessageReply.findMany({
        where: { contactMessageId: messageId },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]!.id).toBe(stale.id);
      expect(rows[0]!.status).toBe('PENDING');
      expect(rows[0]!.sentAt).toBeNull();
      expect(rows[0]!.failedAt).toBeNull();
      expect(rows[0]!.initiatedByUserId).toBe(replierId);
      expect(rows[0]!.body).toBe(
        'An attempt whose outcome was never resolved.',
      );
    });

    // The other side of the boundary, at the HTTP layer, and it is NOT ceremony.
    //
    // `src/modules/contact/provider-idempotency.spec.ts` already pins the predicate to the millisecond on both
    // sides plus the backwards clock, and the stale test above proves the service honours a `false`
    // result end to end. What neither proves is that the service compares against the REAL window:
    // The delivery suite's recovery test uses a freshly-created row (elapsed ≈ 0), so it would still pass if the
    // window were one second. A row 23 hours old that IS recovered is what discriminates — it fails
    // for any window shorter than a day, and the stale test fails for any window longer than one.
    // Together the three make an exact-boundary HTTP test redundant, which is why there isn't one.
    it('is still recovered one hour before the deadline, under its original provider key', async () => {
      const messageId = await createMessage();
      const key = `key-fresh-pending-${unique}`;

      const pending = await db.contactMessageReply.create({
        data: {
          contactMessageId: messageId,
          body: 'An attempt claimed 23 hours ago.',
          idempotencyKey: key,
          initiatedByUserId: replierId,
          createdAt: new Date(Date.now() - DAY_MS + 60 * 60 * 1000),
        },
      });

      const body = envelopeData<Reply>(
        await postReply(messageId, key, replierToken).expect(200),
      );

      expect(body.id).toBe(pending.id);
      expect(body.status).toBe('SENT');
      expect(transport.invocations).toHaveLength(1);
      // Derived from the row id, so the provider recognises it as the same logical send.
      expect(transport.lastSent.providerKey).toBe(
        `contact-reply/${pending.id}`,
      );
      expect(transport.externalSends).toBe(1);
    });
  });

  // ===================================================================================
  // §11 — recipient smuggling at the public HTTP boundary
  // ===================================================================================
  describe('an attempt to name the recipient', () => {
    // Every one of these carries a VALID `body` alongside the smuggled field. A request with only
    // the extra property would 422 on the missing `body` rule and would pass even with the
    // whitelist switched off — it would prove nothing about `forbidNonWhitelisted`.
    it.each(['to', 'cc', 'bcc', 'recipient', 'email'])(
      'is rejected when supplied as `%s`, and reaches the transport zero times',
      async (field) => {
        const messageId = await createMessage({ email: 'real@example.com' });

        await request(httpServer(app))
          .post(`/api/v1/admin/messages/${messageId}/replies`)
          .set(bearer(replierToken))
          .set('Idempotency-Key', `key-smuggle-${field}-${unique}`)
          .send({ body: 'Hello.', [field]: 'attacker@example.com' })
          .expect(422);

        // Both halves (§20): the status alone would not exclude a row written before validation.
        expect(transport.invocations).toHaveLength(0);
        await expect(
          db.contactMessageReply.count({
            where: { contactMessageId: messageId },
          }),
        ).resolves.toBe(0);
      },
    );
  });

  // ===================================================================================
  // §7 — the Idempotency-Key header contract, re-proved at the client boundary
  // ===================================================================================
  describe('the Idempotency-Key header', () => {
    // Each case isolates ONE rule. The pipe rejects in order — non-string/empty, then length, then
    // the character class — so a 3-character whitespace value would fail on LENGTH and prove
    // nothing about the whitespace rule. The whitespace case is therefore 8+ characters long.
    const invalid: ReadonlyArray<readonly [string, string | null]> = [
      ['missing', null],
      ['too short', 'abc'],
      ['too long', 'k'.repeat(201)],
      ['containing whitespace', 'key with spaces'],
      ['non-ASCII', 'key-with-émoji-ø'],
      // A NEWLINE case is deliberately absent, and its absence is a finding rather than an
      // oversight. Attempting it fails inside the HTTP CLIENT — Node refuses to serialize a header
      // whose value contains CR/LF (`TypeError: Invalid character in header content`) — so no such
      // request can be put on the wire by any conforming client, and a test asserting a 422 would be
      // measuring superagent rather than this API. The pipe's `OPAQUE_KEY` regex still excludes
      // CR/LF as defence in depth, and `idempotency-key.pipe.spec.ts` pins that directly at the unit
      // level, where the value can be handed to the pipe without a transport in between. That is the
      // cheapest layer which can prove it (§22), and it is the only layer which can.
    ];

    it.each(invalid)('is rejected when %s', async (_label, key) => {
      const messageId = await createMessage();

      const req = request(httpServer(app))
        .post(`/api/v1/admin/messages/${messageId}/replies`)
        .set(bearer(replierToken));
      if (key !== null) {
        req.set('Idempotency-Key', key);
      }

      const res = await req.send({ body: 'Hello.' }).expect(422);

      // The rejected value is never echoed back — it is client-chosen and travels into a log line
      // and a provider header, so reflecting it would put unvalidated input on a response.
      if (key !== null) {
        expect(JSON.stringify(res.body)).not.toContain(key);
      }
      // The provider's own key naming is an internal detail and must not surface to a client.
      expect(JSON.stringify(res.body)).not.toContain('contact-reply/');
      expect(JSON.stringify(res.body)).not.toContain(
        PROVIDER_IDEMPOTENCY_HEADER,
      );

      expect(transport.invocations).toHaveLength(0);
      await expect(
        db.contactMessageReply.count({
          where: { contactMessageId: messageId },
        }),
      ).resolves.toBe(0);
    });

    // The contract is an OPAQUE bounded value, not a UUID. Pinning the permissive cases stops a
    // future change from quietly narrowing it to a format clients were never promised.
    it.each([
      ['a UUID', '3f1a5b6c-0000-4000-8000-0000000000ff'],
      ['exactly the minimum length', 'k'.repeat(8)],
      ['exactly the maximum length', 'k'.repeat(200)],
      ['a base64url token', 'abcDEF-123_xyz'],
    ])('is accepted when it is %s', async (_label, key) => {
      const messageId = await createMessage();

      await postReply(messageId, key, replierToken).expect(201);

      expect(transport.invocations).toHaveLength(1);
    });
  });

  // ===================================================================================
  // §12 — the permission matrix, against genuinely restricted roles
  // ===================================================================================
  describe('the permission matrix', () => {
    it('refuses an unauthenticated POST with 401 and sends nothing', async () => {
      const messageId = await createMessage();

      await request(httpServer(app))
        .post(`/api/v1/admin/messages/${messageId}/replies`)
        .set('Idempotency-Key', `key-anon-${unique}`)
        .send({ body: 'Hello.' })
        .expect(401);

      expect(transport.invocations).toHaveLength(0);
      await expect(
        db.contactMessageReply.count({
          where: { contactMessageId: messageId },
        }),
      ).resolves.toBe(0);
    });

    it('refuses an unauthenticated GET with 401', async () => {
      const messageId = await createMessage();

      await request(httpServer(app))
        .get(`/api/v1/admin/messages/${messageId}/replies`)
        .expect(401);
    });

    it('refuses an authenticated principal holding neither permission', async () => {
      const messageId = await createMessage();

      await postReply(
        messageId,
        `key-outsider-${unique}`,
        outsiderToken,
      ).expect(403);
      await getReplies(messageId, outsiderToken).expect(403);

      expect(transport.invocations).toHaveLength(0);
      await expect(
        db.contactMessageReply.count({
          where: { contactMessageId: messageId },
        }),
      ).resolves.toBe(0);
    });

    it('lets `messages.read` alone read history but never send', async () => {
      const messageId = await createMessage();

      await getReplies(messageId, readerToken).expect(200);

      await postReply(messageId, `key-reader-${unique}`, readerToken).expect(
        403,
      );

      expect(transport.invocations).toHaveLength(0);
      await expect(
        db.contactMessageReply.count({
          where: { contactMessageId: messageId },
        }),
      ).resolves.toBe(0);
    });

    // The asymmetry that matters, and the reason a single all-permissions operator cannot prove
    // this matrix: `messages.reply` must NOT become an implicit read grant. The controller guards
    // GET on `messages.read` deliberately — reading who answered a message is an inspection of the
    // inbox — so a send-only principal is forbidden the history even of a reply it just created.
    it('lets `messages.reply` alone send but never read history', async () => {
      const messageId = await createMessage();

      await postReply(
        messageId,
        `key-reply-only-${unique}`,
        replyOnlyToken,
      ).expect(201);
      expect(transport.invocations).toHaveLength(1);

      await getReplies(messageId, replyOnlyToken).expect(403);
    });

    // OWNER holds the `'*'` wildcard rather than the enumerated keys, so it is asserted separately
    // — a matrix proved only through OWNER would say nothing about either key.
    it('lets the OWNER wildcard do both', async () => {
      const messageId = await createMessage();

      await postReply(messageId, `key-owner-${unique}`, ownerToken).expect(201);
      await getReplies(messageId, ownerToken).expect(200);
    });
  });

  // ===================================================================================
  // §13 — unknown message, POST
  // ===================================================================================
  describe('a POST against a message that does not exist', () => {
    it('404s sanitized, claims no key, and never reaches the transport', async () => {
      const absent = '3f1a5b6c-0000-4000-8000-0000000000aa';
      const before = await db.contactMessageReply.count();

      const res = await postReply(
        absent,
        `key-unknown-${unique}`,
        replierToken,
      ).expect(404);

      // The sanitized body — no Prisma text, no model name, no raw error.
      expect(JSON.stringify(res.body)).not.toContain('Prisma');
      expect(JSON.stringify(res.body)).not.toContain('contactMessage');

      // No row was created ANYWHERE: the 404 is resolved before the key is claimed, so a client
      // cannot burn an idempotency key on a message it was never able to reply to.
      await expect(db.contactMessageReply.count()).resolves.toBe(before);
      expect(transport.invocations).toHaveLength(0);
    });

    // A malformed id is a different client mistake, answered by `ParseUUIDPipe` ahead of any
    // database read — and it answers **400**, not the 422 the body and header pipes produce.
    //
    // MEASURED, NOT ASSUMED, AND NOT A DEFECT. `ParseUUIDPipe` is Nest's built-in and throws
    // `BadRequestException`; every admin route in this API takes its `:id` through the same pipe, so
    // 400-for-a-malformed-path-parameter is repository-wide behaviour rather than anything this
    // feature chose. D10-21(c) enumerates 404/409/422/401/403 and is silent on a malformed id, so
    // there is no contract to contradict. Pinned here so the observed answer is frozen rather
    // than an assumed one.
    it('400s a malformed id without touching the transport', async () => {
      await postReply(
        'not-a-uuid',
        `key-malformed-${unique}`,
        replierToken,
      ).expect(400);

      expect(transport.invocations).toHaveLength(0);
    });
  });

  // ===================================================================================
  // §14 — GET history: unknown message, and the empty case it must NOT be confused with
  // ===================================================================================
  describe('GET history', () => {
    // The governed answer, and it is 404 rather than `[]`. D10-21(c) states 404 for an unknown
    // message; D10-21(f)'s "returns an empty list" is about a message that EXISTS but carries no
    // address. Code agrees — `list()` resolves the message before the query, precisely so that
    // "no replies" and "no such message" cannot share a response — and so does the controller's
    // `@ApiProblemResponse(NOT_FOUND)`. No conflict to resolve; pinned so it stays observed.
    it('404s for a message that does not exist', async () => {
      const absent = '3f1a5b6c-0000-4000-8000-0000000000bb';

      const res = await getReplies(absent, readerToken).expect(404);
      expect(JSON.stringify(res.body)).not.toContain('Prisma');
    });

    // The distinct case that must not be collapsed into the one above: a real message with no
    // address can never be replied to, and its history is an empty list, not a 404. Reading is a
    // property of the message; sending is a property of the address.
    it('returns an empty list for a real phone-only message', async () => {
      const messageId = await createMessage({
        email: null,
        phone: '+201234567890',
      });

      const res = await getReplies(messageId, readerToken).expect(200);
      expect(envelopeData<Reply[]>(res)).toEqual([]);

      // And that message genuinely cannot be replied to — 409, so the empty list above is the
      // empty state of a repliable-history view rather than an accident.
      await postReply(messageId, `key-phone-${unique}`, replierToken).expect(
        409,
      );
    });

    // ===================================================================================
    // §15 — message scoping and ordering
    // ===================================================================================
    it('returns only the requested message’s replies, oldest first', async () => {
      const messageA = await createMessage({ subject: 'Message A' });
      const messageB = await createMessage({ subject: 'Message B' });

      // Three replies on A with explicit, separated timestamps, INSERTED OUT OF ORDER so a
      // response that merely echoed insertion order would fail. `createdAt` ascending is what
      // D10-21(f) means by chronological, and `id` breaks a same-millisecond tie.
      const base = Date.now() - 60 * 60 * 1000;
      const second = await db.contactMessageReply.create({
        data: {
          contactMessageId: messageA,
          body: 'Second.',
          idempotencyKey: `order-2-${unique}`,
          initiatedByUserId: replierId,
          createdAt: new Date(base + 2_000),
          status: 'SENT',
          sentAt: new Date(base + 2_100),
        },
      });
      const first = await db.contactMessageReply.create({
        data: {
          contactMessageId: messageA,
          body: 'First.',
          idempotencyKey: `order-1-${unique}`,
          initiatedByUserId: replierId,
          createdAt: new Date(base + 1_000),
          status: 'SENT',
          sentAt: new Date(base + 1_100),
        },
      });
      const third = await db.contactMessageReply.create({
        data: {
          contactMessageId: messageA,
          body: 'Third.',
          idempotencyKey: `order-3-${unique}`,
          initiatedByUserId: replierId,
          createdAt: new Date(base + 3_000),
        },
      });

      // B gets its own reply, whose body is distinctive enough that a leak is unmistakable.
      const leaked = await db.contactMessageReply.create({
        data: {
          contactMessageId: messageB,
          body: 'BELONGS-TO-B.',
          idempotencyKey: `order-b-${unique}`,
          initiatedByUserId: replierBId,
          createdAt: new Date(base + 1_500),
        },
      });

      const rows = envelopeData<Reply[]>(
        await getReplies(messageA, readerToken).expect(200),
      );

      // Structural, not a substring check: the exact id sequence. `not.toContain(leaked.id)` alone
      // would pass against an empty response, which is why the length and the order are pinned too.
      expect(rows.map((row) => row.id)).toEqual([
        first.id,
        second.id,
        third.id,
      ]);
      expect(rows.every((row) => row.contactMessageId === messageA)).toBe(true);
      expect(rows.map((row) => row.id)).not.toContain(leaked.id);

      // B's own history is likewise exactly its own.
      const bRows = envelopeData<Reply[]>(
        await getReplies(messageB, readerToken).expect(200),
      );
      expect(bRows.map((row) => row.id)).toEqual([leaked.id]);
    });

    // ===================================================================================
    // §16 — the represented states and the published field set
    // ===================================================================================
    it('exposes exactly the approved fields for SENT, FAILED and PENDING', async () => {
      const messageId = await createMessage({ subject: 'States' });

      // SENT and FAILED are produced through the REAL send flow rather than written directly, so
      // the states under test are the ones the service actually persists.
      await postReply(messageId, `state-sent-${unique}`, replierToken).expect(
        201,
      );

      transport.rejectConclusively();
      await postReply(messageId, `state-failed-${unique}`, replierToken).expect(
        201,
      );
      transport.accept();

      // PENDING has no first-send path that leaves it behind (a refused FIRST send is FAILED by
      // design), so the ambiguous state is written directly — it is what a crashed finalize leaves.
      await db.contactMessageReply.create({
        data: {
          contactMessageId: messageId,
          body: 'Ambiguous.',
          idempotencyKey: `state-pending-${unique}`,
          initiatedByUserId: replierBId,
          createdAt: new Date(),
        },
      });

      const rows = envelopeData<Reply[]>(
        await getReplies(messageId, readerToken).expect(200),
      );
      expect(rows).toHaveLength(3);

      const byStatus = new Map(rows.map((row) => [row.status, row]));
      expect([...byStatus.keys()].sort()).toEqual([
        'FAILED',
        'PENDING',
        'SENT',
      ]);

      // The published shape, asserted as the EXACT key set (D10-21(e)). An `expect(...).toBeDefined`
      // per field would not catch an added one, and an added transport field is the failure mode
      // this assertion exists for.
      for (const row of rows) {
        expect(Object.keys(row).sort()).toEqual([
          'body',
          'contactMessageId',
          'createdAt',
          'failedAt',
          'id',
          'initiatedByUserId',
          'sentAt',
          'status',
        ]);
      }

      const sent = byStatus.get('SENT')!;
      expect(sent.sentAt).not.toBeNull();
      expect(sent.failedAt).toBeNull();

      const failed = byStatus.get('FAILED')!;
      expect(failed.failedAt).not.toBeNull();
      expect(failed.sentAt).toBeNull();

      const pending = byStatus.get('PENDING')!;
      expect(pending.sentAt).toBeNull();
      expect(pending.failedAt).toBeNull();

      // `providerMessageId` is internal (D10-21(e)) — and it is asserted in BOTH directions, so the
      // absence cannot pass merely because the column was never written.
      const stored = await db.contactMessageReply.findUniqueOrThrow({
        where: { id: sent.id },
      });
      expect(stored.providerMessageId).not.toBeNull();
      expect(JSON.stringify(rows)).not.toContain(stored.providerMessageId!);

      // No transport text, no relay code, no provider name anywhere in the history.
      const serialized = JSON.stringify(rows);
      expect(serialized).not.toContain('550');
      expect(serialized).not.toContain('Mailbox unavailable');
      expect(serialized).not.toContain('Resend');
      expect(serialized).not.toContain(E2E_MAIL_ENV.SMTP_PASSWORD);
      expect(serialized).not.toContain(E2E_MAIL_ENV.SMTP_HOST);
    });

    // §16 (history operator identity). Attribution comes from the verified JWT principal, and a
    // replay by a different operator does not rewrite it.
    it('attributes each reply to the operator that initiated it', async () => {
      const messageId = await createMessage();
      const keyA = `owner-a-${unique}`;

      const created = envelopeData<Reply>(
        await postReply(messageId, keyA, replierToken).expect(201),
      );
      expect(created.initiatedByUserId).toBe(replierId);

      // A second operator sends their own reply under their own key…
      const createdB = envelopeData<Reply>(
        await postReply(messageId, `owner-b-${unique}`, replierBToken).expect(
          201,
        ),
      );
      expect(createdB.initiatedByUserId).toBe(replierBId);

      // …and replaying operator A's key does not move A's reply to B.
      const replayed = envelopeData<Reply>(
        await postReply(messageId, keyA, replierBToken).expect(200),
      );
      expect(replayed.id).toBe(created.id);
      expect(replayed.initiatedByUserId).toBe(replierId);

      const rows = envelopeData<Reply[]>(
        await getReplies(messageId, readerToken).expect(200),
      );
      const owners = new Map(
        rows.map((row) => [row.id, row.initiatedByUserId]),
      );
      expect(owners.get(created.id)).toBe(replierId);
      expect(owners.get(createdB.id)).toBe(replierBId);
      // Neither is attributed to a principal that merely READ the history.
      expect([...owners.values()]).not.toContain(readerId);
      expect([...owners.values()]).not.toContain(replyOnlyId);
    });
  });

  // ===================================================================================
  // §15/§16 — the public contact notification path, which is a DIFFERENT reliability model
  // ===================================================================================
  describe('public contact submission', () => {
    const contactBody = (subject: string): Record<string, unknown> => ({
      name: 'Alex Morgan',
      email: 'alex@example.com',
      subject,
      body: 'I would like to discuss a Nuxt build.',
      elapsedMs: 8200,
    });

    // The distinction this suite must not let erode: a visitor's submission is authoritative once
    // the DATABASE commit lands, and notification mail is detached and best-effort. A reply is the
    // opposite — an operator deliberately asked for it and the API awaits the provider's verdict.
    it('commits the message and dispatches notification mail detached from the request', async () => {
      const subject = `B2 contact ok ${unique}`;

      await submitContact(contactBody(subject)).expect(200);

      // The authoritative act, checked without waiting on mail at all.
      const row = await db.contactMessage.findFirstOrThrow({
        where: { subject },
      });
      expect(row.email).toBe('alex@example.com');

      // Then, and only then, the mail: an owner notification and a visitor acknowledgement.
      await drainMail(2);
      expect(
        transport.sentTo(E2E_MAIL_ENV.CONTACT_NOTIFICATION_TO),
      ).toHaveLength(1);
      expect(transport.sentTo('alex@example.com')).toHaveLength(1);
    });

    // §16's control. A transport failure on the notification path must not reach the visitor: the
    // request still succeeds and the row still commits, because the row is the authoritative
    // record and mail is a side effect of a write that already landed.
    it('still succeeds and still commits when the notification send fails', async () => {
      const subject = `B2 contact mail-fail ${unique}`;
      transport.rejectConclusively();

      await submitContact(contactBody(subject)).expect(200);

      const row = await db.contactMessage.findFirstOrThrow({
        where: { subject },
      });
      expect(row.subject).toBe(subject);
      expect(row.email).toBe('alex@example.com');

      // The transport really was reached and really did refuse — otherwise this test would pass
      // against a path that never attempted to send at all.
      await drainMail(1);
      expect(transport.externalSends).toBe(0);

      // Reply-style FAILED persistence must not leak into this domain: a contact submission has no
      // reply row and records no delivery state of its own.
      await expect(
        db.contactMessageReply.count({ where: { contactMessageId: row.id } }),
      ).resolves.toBe(0);

      transport.accept();
    });

    // A phone-only submission has no address to acknowledge, so exactly one mail goes out. Pinned
    // because the count differs from the case above and a drain that expected the wrong number
    // would either hang or pass early.
    it('sends only the owner notification for a phone-only submission', async () => {
      const subject = `B2 contact phone ${unique}`;

      await submitContact({
        name: 'Alex Morgan',
        phone: '+201234567890',
        subject,
        body: 'Please call me about a Nuxt build.',
        elapsedMs: 8200,
      }).expect(200);

      await drainMail(1);
      // Drained to exactly one; a second would have to arrive within the drain window to be seen,
      // so this is re-checked after a further poll below.
      expect(
        transport.sentTo(E2E_MAIL_ENV.CONTACT_NOTIFICATION_TO),
      ).toHaveLength(1);
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(transport.invocations).toHaveLength(1);
    });
  });

  // ===================================================================================
  // §16 — the structural proof, against the production MailService and the fake transport
  // ===================================================================================
  describe('the message the production MailService actually builds', () => {
    it('carries the configured sender, the server-derived recipient and the provider key', async () => {
      const messageId = await createMessage({
        email: 'visitor@example.com',
        subject: 'Nuxt migration',
      });
      const body = 'Happy to help — shall we talk on Tuesday?';

      const reply = envelopeData<Reply>(
        await postReply(
          messageId,
          `key-structural-${unique}`,
          replierToken,
          body,
        ).expect(201),
      );

      const sent = transport.lastSent;

      // Sender: the configured envelope sender, not a per-message override.
      expect(sent.from).toBe(E2E_MAIL_ENV.SMTP_FROM);
      // Recipient: read from the STORED row, and there is no request field that could change it.
      expect(sent.to).toBe('visitor@example.com');
      // Subject: normalized server-side, never taken from the request.
      expect(sent.subject).toBe('Re: Nuxt migration');
      // Body: the operator's text, verbatim — not templated, not decorated.
      expect(sent.text).toBe(body);
      // The provider header, with the exact stable key derived from the row id.
      expect(sent.providerKey).toBe(`contact-reply/${reply.id}`);
      expect(sent.headerNames).toEqual([PROVIDER_IDEMPOTENCY_HEADER]);

      // No HTML representation exists (D02-13e), no CC/BCC, and no reply-to override on this path.
      expect(sent.replyTo).toBeUndefined();
      expect(Object.keys(sent)).not.toContain('cc');
      expect(Object.keys(sent)).not.toContain('bcc');
    });

    // §16-B. The notification path must NOT inherit the reply's provider header — the key is
    // scoped to one logical reply attempt, and a notification carrying a reply's key could be
    // suppressed by the provider as a duplicate. `MailService` spreads the header only when the
    // message defines one, so a notification produces an object with NO `headers` property at all;
    // this asserts that structurally, and asserts it AFTER a reply has already been sent through
    // the same service instance so a leaked-state defect would be visible.
    it('gives an ordinary contact notification no provider idempotency header', async () => {
      const messageId = await createMessage();
      await postReply(messageId, `key-leak-${unique}`, replierToken).expect(
        201,
      );
      expect(transport.lastSent.headerNames).toEqual([
        PROVIDER_IDEMPOTENCY_HEADER,
      ]);

      const before = transport.invocations.length;
      const subject = `B2 header leak ${unique}`;
      await submitContact({
        name: 'Alex Morgan',
        email: 'alex@example.com',
        subject,
        body: 'I would like to discuss a Nuxt build.',
        elapsedMs: 8200,
      }).expect(200);

      await drainMail(before + 2);

      const notifications = transport.invocations.slice(before);
      expect(notifications).toHaveLength(2);
      for (const mail of notifications) {
        // Structural: no header object at all, not merely an empty key.
        expect(mail.headerNames).toEqual([]);
        expect(mail.providerKey).toBeUndefined();
        // And the sender is still the configured one.
        expect(mail.from).toBe(E2E_MAIL_ENV.SMTP_FROM);
      }

      // The owner notification carries the visitor's address as `replyTo` — a deliberate, separate
      // behaviour that must not be confused with the reply path's absent replyTo.
      const owner = notifications.find(
        (mail) => mail.to === E2E_MAIL_ENV.CONTACT_NOTIFICATION_TO,
      )!;
      expect(owner.replyTo).toBe('alex@example.com');
    });

    // §19. The provider's own refusal text is operational detail: it belongs in a server log and
    // on no response, in either domain.
    it('keeps the provider’s refusal text off the reply response entirely', async () => {
      const messageId = await createMessage();
      transport.rejectConclusively();

      const res = await postReply(
        messageId,
        `key-no-leak-${unique}`,
        replierToken,
      ).expect(201);
      transport.accept();

      const serialized = JSON.stringify(res.body);
      expect(serialized).not.toContain('550');
      expect(serialized).not.toContain('Mailbox unavailable');
      expect(serialized).not.toContain('fake transport');
      expect(serialized).not.toContain(E2E_MAIL_ENV.SMTP_HOST);
      expect(serialized).not.toContain(E2E_MAIL_ENV.SMTP_USER);
      expect(serialized).not.toContain(E2E_MAIL_ENV.SMTP_PASSWORD);
      // The attempt itself is still reported, with its outcome as data rather than as an error.
      expect(envelopeData<Reply>(res).status).toBe('FAILED');
    });
  });
});
