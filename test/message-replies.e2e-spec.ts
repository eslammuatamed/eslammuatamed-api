import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaClient } from '../src/generated/prisma/client';
import { createPrismaClient } from '../src/prisma/standalone-client';
import {
  createE2eApp,
  envelopeData,
  httpServer,
  OWNER_EMAIL,
  OWNER_PASSWORD,
} from './utils/e2e-app';

// Reply-by-email, end to end against a real PostgreSQL (D02-13, D10-21, D19-12).
//
// Two things here genuinely need a database rather than a mock. The first is the idempotency
// invariant: a mocked `create` can assert the loser BRANCH behaves, but only the database can
// decide there is a loser at all. The second is the recipient invariant, which is a claim about
// what the whole request pipeline — pipe, guard, controller, service — will accept.
//
// NO MAIL IS SENT BY THIS SUITE. 11A persists a PENDING attempt and stops, `SMTP_ENABLED` is off in
// the e2e environment, and every assertion below is about persistence and contract. Nothing here
// contacts a relay, a provider, or a real address.

const BARRIER_DEADLINE_MS = 2_000;
const BARRIER_POLL_MS = 25;

// Counts backends this database is currently making wait. `pg_blocking_pids` rather than counting
// `pg_locks` rows: two backends queued on one unique index produce a mix of lock types, so reading
// pg_locks by locktype miscounts. Borrowed from refresh-token-rotation.e2e-spec.ts, which
// established the technique.
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
      // Throws rather than proceeding. A barrier that never formed would let the test pass by
      // luck — the two inserts would simply run in sequence — and a race test that can pass
      // without racing proves nothing. This is the instrument's own self-check.
      throw new Error(
        `Barrier never formed: expected ${expected} blocked backend(s) within ${BARRIER_DEADLINE_MS}ms.`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, BARRIER_POLL_MS));
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

describe('Message replies (e2e)', () => {
  let app: INestApplication;
  let db: PrismaClient;
  let ownerToken: string;
  const unique = Date.now();

  const owner = (): Record<string, string> => ({
    Authorization: `Bearer ${ownerToken}`,
  });

  // Creates a stored message through the PUBLIC intake, the only way one can exist.
  const createMessage = async (
    overrides: { email?: string | null; phone?: string; subject?: string } = {},
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

  beforeAll(async () => {
    app = await createE2eApp();
    db = createPrismaClient(process.env.DATABASE_URL ?? '');
    const login = await request(httpServer(app))
      .post('/api/v1/auth/login')
      .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
    ownerToken = envelopeData<{ accessToken: string }>(login).accessToken;
  });

  afterAll(async () => {
    await db.$disconnect();
    await app.close();
  });

  describe('creating a reply', () => {
    it('creates a PENDING attempt with 201 and attributes it to the caller', async () => {
      const messageId = await createMessage();

      const res = await request(httpServer(app))
        .post(`/api/v1/admin/messages/${messageId}/replies`)
        .set(owner())
        .set('Idempotency-Key', `key-create-${unique}`)
        .send({ body: 'Thanks for reaching out.' })
        .expect(201);

      const reply = envelopeData<Reply>(res);
      expect(reply.contactMessageId).toBe(messageId);
      expect(reply.body).toBe('Thanks for reaching out.');
      // Truthful state: nothing was sent, so nothing claims to have been.
      expect(reply.status).toBe('PENDING');
      expect(reply.sentAt).toBeNull();
      expect(reply.failedAt).toBeNull();
      expect(reply.initiatedByUserId).toEqual(expect.any(String));
      // Internal fields never reach a response (D10-21e).
      expect(Object.keys(reply)).not.toContain('providerMessageId');
      expect(JSON.stringify(reply)).not.toContain('smtp');
    });

    // 201 vs 200 is contract, not cosmetics: a client must be able to tell a real second attempt
    // from a retried first one (D10-21c).
    it('replays the same attempt with 200, creating exactly one row', async () => {
      const messageId = await createMessage();
      const key = `key-replay-${unique}`;

      const first = await request(httpServer(app))
        .post(`/api/v1/admin/messages/${messageId}/replies`)
        .set(owner())
        .set('Idempotency-Key', key)
        .send({ body: 'First body.' })
        .expect(201);

      const second = await request(httpServer(app))
        .post(`/api/v1/admin/messages/${messageId}/replies`)
        .set(owner())
        .set('Idempotency-Key', key)
        // A DIFFERENT body under the same key. Same logical key means same logical attempt — a
        // replay is not an edit, and the stored attempt must win.
        .send({ body: 'Second body, deliberately different.' })
        .expect(200);

      expect(envelopeData<Reply>(second).id).toBe(
        envelopeData<Reply>(first).id,
      );
      expect(envelopeData<Reply>(second).body).toBe('First body.');
      await expect(
        db.contactMessageReply.count({
          where: { contactMessageId: messageId },
        }),
      ).resolves.toBe(1);
    });

    // A deliberate second reply is a NEW key, and it must produce a NEW row — otherwise the
    // idempotency guarantee would silently forbid answering twice.
    it('creates a second attempt under a different key', async () => {
      const messageId = await createMessage();

      for (const key of [`key-a-${unique}`, `key-b-${unique}`]) {
        await request(httpServer(app))
          .post(`/api/v1/admin/messages/${messageId}/replies`)
          .set(owner())
          .set('Idempotency-Key', key)
          .send({ body: `Body for ${key}.` })
          .expect(201);
      }

      await expect(
        db.contactMessageReply.count({
          where: { contactMessageId: messageId },
        }),
      ).resolves.toBe(2);
    });

    // The uniqueness is scoped to the message (D09-23b). A key reused against a DIFFERENT message
    // must create a fresh attempt there — never return the other message's row.
    it('scopes the key to its message rather than globally', async () => {
      const [first, second] = [await createMessage(), await createMessage()];
      const key = `key-shared-${unique}`;

      const a = await request(httpServer(app))
        .post(`/api/v1/admin/messages/${first}/replies`)
        .set(owner())
        .set('Idempotency-Key', key)
        .send({ body: 'To the first message.' })
        .expect(201);

      const b = await request(httpServer(app))
        .post(`/api/v1/admin/messages/${second}/replies`)
        .set(owner())
        .set('Idempotency-Key', key)
        .send({ body: 'To the second message.' })
        .expect(201);

      expect(envelopeData<Reply>(b).id).not.toBe(envelopeData<Reply>(a).id);
      expect(envelopeData<Reply>(b).contactMessageId).toBe(second);
      // The load-bearing assertion: the second call did NOT read back the first message's reply.
      expect(envelopeData<Reply>(b).body).toBe('To the second message.');
    });
  });

  describe('the recipient can never be chosen by the client', () => {
    // D19-12b, at the HTTP boundary rather than at the DTO. The global pipe is fail-closed, so a
    // recipient-shaped field is REJECTED — not stripped — and this asserts the guarantee this
    // repository actually makes rather than the weaker one that would also be safe.
    it.each([['to'], ['cc'], ['bcc'], ['from'], ['replyTo']])(
      'rejects a body carrying `%s` with 422 and stores nothing',
      async (field) => {
        const messageId = await createMessage();

        await request(httpServer(app))
          .post(`/api/v1/admin/messages/${messageId}/replies`)
          .set(owner())
          .set('Idempotency-Key', `key-${field}-${unique}`)
          .send({ body: 'Hello.', [field]: 'attacker@example.com' })
          .expect(422);

        await expect(
          db.contactMessageReply.count({
            where: { contactMessageId: messageId },
          }),
        ).resolves.toBe(0);
      },
    );

    // The negative control for the block above: the identical request minus the extra field must
    // succeed. Without it, that block would still pass if the endpoint rejected everything.
    it('accepts the same request once the recipient field is removed', async () => {
      const messageId = await createMessage();

      await request(httpServer(app))
        .post(`/api/v1/admin/messages/${messageId}/replies`)
        .set(owner())
        .set('Idempotency-Key', `key-control-${unique}`)
        .send({ body: 'Hello.' })
        .expect(201);
    });
  });

  describe('the Idempotency-Key header', () => {
    it('rejects a request with no key, and stores nothing', async () => {
      const messageId = await createMessage();

      await request(httpServer(app))
        .post(`/api/v1/admin/messages/${messageId}/replies`)
        .set(owner())
        .send({ body: 'Hello.' })
        .expect(422);

      await expect(
        db.contactMessageReply.count({
          where: { contactMessageId: messageId },
        }),
      ).resolves.toBe(0);
    });

    it.each([
      ['too short', 'short'],
      ['containing whitespace', 'key with spaces'],
    ])('rejects a key %s', async (_label, key) => {
      const messageId = await createMessage();

      await request(httpServer(app))
        .post(`/api/v1/admin/messages/${messageId}/replies`)
        .set(owner())
        .set('Idempotency-Key', key)
        .send({ body: 'Hello.' })
        .expect(422);
    });
  });

  describe('messages that cannot be replied to', () => {
    // D02-10 permits a phone-only submission, so this is designed behaviour surfacing, not a gap.
    it('409s a phone-only message and claims no idempotency key', async () => {
      const messageId = await createMessage({
        email: null,
        phone: '+201002785408',
      });
      const key = `key-phoneonly-${unique}`;

      await request(httpServer(app))
        .post(`/api/v1/admin/messages/${messageId}/replies`)
        .set(owner())
        .set('Idempotency-Key', key)
        .send({ body: 'Hello.' })
        .expect(409);

      // The key must be UNSPENT — a client cannot burn a key on a message it can never reply to.
      await expect(
        db.contactMessageReply.count({ where: { idempotencyKey: key } }),
      ).resolves.toBe(0);
    });

    it('404s an unknown but well-formed message id, creating nothing', async () => {
      // A well-formed UUID that does not exist — a malformed one would be rejected by
      // ParseUUIDPipe and would test the pipe rather than this handler.
      const absent = '0192f3a0-dead-7000-8000-000000000000';

      await request(httpServer(app))
        .post(`/api/v1/admin/messages/${absent}/replies`)
        .set(owner())
        .set('Idempotency-Key', `key-absent-${unique}`)
        .send({ body: 'Hello.' })
        .expect(404);

      await expect(
        db.contactMessageReply.count({
          where: { idempotencyKey: `key-absent-${unique}` },
        }),
      ).resolves.toBe(0);
    });
  });

  describe('reply history', () => {
    it('returns this message’s replies oldest-first and no other message’s', async () => {
      const [subject, other] = [await createMessage(), await createMessage()];

      for (const n of [1, 2, 3]) {
        await request(httpServer(app))
          .post(`/api/v1/admin/messages/${subject}/replies`)
          .set(owner())
          .set('Idempotency-Key', `key-hist-${n}-${unique}`)
          .send({ body: `Reply number ${n}.` })
          .expect(201);
      }
      await request(httpServer(app))
        .post(`/api/v1/admin/messages/${other}/replies`)
        .set(owner())
        .set('Idempotency-Key', `key-other-${unique}`)
        .send({ body: 'Belongs to the other message.' })
        .expect(201);

      const res = await request(httpServer(app))
        .get(`/api/v1/admin/messages/${subject}/replies`)
        .set(owner())
        .expect(200);

      const history = envelopeData<Reply[]>(res);
      expect(history.map((r) => r.body)).toEqual([
        'Reply number 1.',
        'Reply number 2.',
        'Reply number 3.',
      ]);
      // Structural, not a `not.toContain` over a blob: assert the count AND that every row belongs
      // here, so a leak from the other message cannot hide behind a passing substring check.
      expect(history).toHaveLength(3);
      expect(history.every((r) => r.contactMessageId === subject)).toBe(true);
    });

    // Reading is not gated on repliability — the dashboard must render an empty state for a
    // phone-only message it can plainly display.
    it('returns an empty list for a phone-only message', async () => {
      const messageId = await createMessage({
        email: null,
        phone: '+201002785408',
      });

      const res = await request(httpServer(app))
        .get(`/api/v1/admin/messages/${messageId}/replies`)
        .set(owner())
        .expect(200);

      expect(envelopeData<Reply[]>(res)).toEqual([]);
    });

    it('404s history for an unknown message rather than returning an empty list', async () => {
      await request(httpServer(app))
        .get(
          '/api/v1/admin/messages/0192f3a0-dead-7000-8000-000000000000/replies',
        )
        .set(owner())
        .expect(404);
    });
  });

  describe('authorization', () => {
    // Restricted roles, never OWNER — an OWNER proof would pass through the '*' wildcard and
    // demonstrate nothing about the capability being tested.
    const buildOperator = async (
      permissions: string[],
      label: string,
    ): Promise<Record<string, string>> => {
      const roleRes = await request(httpServer(app))
        .post('/api/v1/admin/roles')
        .set(owner())
        .send({ name: `${label} ${unique}`, permissions })
        .expect(201);
      const roleId = envelopeData<{ id: string }>(roleRes).id;

      const email = `${label.toLowerCase()}-${unique}@example.com`;
      const password = 'change-me-minimum-12';
      await request(httpServer(app))
        .post('/api/v1/admin/users')
        .set(owner())
        .send({ email, password, roleId })
        .expect(201);

      const login = await request(httpServer(app))
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);
      return {
        Authorization: `Bearer ${envelopeData<{ accessToken: string }>(login).accessToken}`,
      };
    };

    it('401s an unauthenticated request on both routes', async () => {
      const messageId = await createMessage();

      await request(httpServer(app))
        .get(`/api/v1/admin/messages/${messageId}/replies`)
        .expect(401);
      await request(httpServer(app))
        .post(`/api/v1/admin/messages/${messageId}/replies`)
        .set('Idempotency-Key', `key-401-${unique}`)
        .send({ body: 'Hello.' })
        .expect(401);
    });

    // The separation that matters: reading an answered conversation is an inspection; sending is
    // an action a third party outside the platform can see.
    it('lets messages.read view history but refuses the send with 403', async () => {
      const messageId = await createMessage();
      const auth = await buildOperator(['messages.read'], 'MsgReader');

      await request(httpServer(app))
        .get(`/api/v1/admin/messages/${messageId}/replies`)
        .set(auth)
        .expect(200);

      await request(httpServer(app))
        .post(`/api/v1/admin/messages/${messageId}/replies`)
        .set(auth)
        .set('Idempotency-Key', `key-403-${unique}`)
        .send({ body: 'Hello.' })
        .expect(403);

      await expect(
        db.contactMessageReply.count({
          where: { contactMessageId: messageId },
        }),
      ).resolves.toBe(0);
    });

    it('lets messages.reply send, and attributes the row to that operator', async () => {
      const messageId = await createMessage();
      const auth = await buildOperator(
        ['messages.read', 'messages.reply'],
        'MsgReplier',
      );

      const res = await request(httpServer(app))
        .post(`/api/v1/admin/messages/${messageId}/replies`)
        .set(auth)
        .set('Idempotency-Key', `key-granted-${unique}`)
        .send({ body: 'Hello.' })
        .expect(201);

      const row = await db.contactMessageReply.findUniqueOrThrow({
        where: { id: envelopeData<Reply>(res).id },
        include: { initiatedByUser: true },
      });
      // Attribution comes from the verified JWT principal, not from anything the client sent.
      expect(row.initiatedByUser.email).toBe(
        `msgreplier-${unique}@example.com`,
      );
    });

    // Pins NON-IMPLICATION, not a usable role. Capabilities in this catalog are independent and
    // never hierarchical (D19-8), so messages.reply confers no read — which also means a role
    // holding only messages.reply is grantable but not useful: it can send, yet cannot open the
    // inbox to compose against. That is deliberate (D19-12e); the alternative — reply silently
    // conferring read — would be a permission hierarchy this model does not have. In practice
    // messages.reply is granted ALONGSIDE messages.read, which the test above exercises.
    it('does not let messages.reply imply messages.read on any inbox route', async () => {
      const messageId = await createMessage();
      const auth = await buildOperator(['messages.reply'], 'ReplyOnly');

      await request(httpServer(app))
        .get(`/api/v1/admin/messages/${messageId}/replies`)
        .set(auth)
        .expect(403);
      await request(httpServer(app))
        .get('/api/v1/admin/messages')
        .set(auth)
        .expect(403);
    });
  });

  // §29 — the idempotency invariant against real concurrency.
  describe('concurrent duplicate requests', () => {
    it('creates exactly ONE row when two inserts race on the same key', async () => {
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

      // The barrier is the unique index itself, not a sleep. This transaction INSERTs the key and
      // holds; a second INSERT on the same key must then WAIT on the index until this commits or
      // rolls back. That is the exact interleaving two simultaneous POSTs produce, forced
      // deterministically.
      const held = blocker.$transaction(
        async (tx) => {
          await tx.contactMessageReply.create({
            data: {
              contactMessageId: messageId,
              body: 'Held by the barrier transaction.',
              idempotencyKey: key,
              initiatedByUserId: (
                await tx.user.findFirstOrThrow({
                  where: { email: OWNER_EMAIL },
                })
              ).id,
            },
          });
          // Signal only AFTER the insert exists (uncommitted). Signalling earlier would let the
          // request fire first, win the race outright, and prove nothing about contention.
          inserted();
          await blockerReleased;
        },
        { timeout: 15_000 },
      );

      try {
        await blockerInserted;

        // Fire the real request. It cannot see the uncommitted row (READ COMMITTED), so it
        // proceeds exactly as in the unguarded case and queues at its own INSERT.
        // `.then()` is what DISPATCHES a supertest request — a `Test` builds lazily and issues no
        // HTTP until it is subscribed to. Without it `pending` is an unsent request object, the
        // barrier check below never sees a blocked backend, and the race under test never happens.
        // (This is not hypothetical: the first version of this test failed exactly there, which is
        // the barrier assertion earning its place.)
        const pending = request(httpServer(app))
          .post(`/api/v1/admin/messages/${messageId}/replies`)
          .set(owner())
          .set('Idempotency-Key', key)
          .send({ body: 'From the racing request.' })
          .then((res) => res);

        // Confirm the contention actually formed. Without this the test could pass by running the
        // two inserts in sequence — a race test that can pass without racing proves nothing.
        await waitUntilBlocked(observer, 1);

        releaseBlocker();
        await held;

        // The request now loses the unique index and replays the committed attempt.
        const res = await pending;
        expect(res.status).toBe(200);
        expect(envelopeData<Reply>(res).body).toBe(
          'Held by the barrier transaction.',
        );
      } finally {
        releaseBlocker();
        await held.catch(() => undefined);
        await Promise.all([blocker.$disconnect(), observer.$disconnect()]);
      }

      // THE assertion: one logical key, one persistent row.
      await expect(
        db.contactMessageReply.count({ where: { idempotencyKey: key } }),
      ).resolves.toBe(1);
    });
  });
});
