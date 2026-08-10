import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request, { Response } from 'supertest';
import {
  createE2eApp,
  httpServer,
  OWNER_EMAIL,
  OWNER_PASSWORD,
} from './utils/e2e-app';

// Proves rotation atomicity against a real PostgreSQL, not a mocked `count: 0` branch
// (doc 19 §2, D19-2). A mocked test can assert the loser BRANCH behaves; only the database
// can decide there is a loser at all.
//
// The barrier is a row lock, not a sleep. The test opens its own transaction, takes
// `SELECT … FOR UPDATE` on the presented token, and only releases once BOTH rotations are
// observably blocked on it. That forces the exact interleaving the bug needs: both requests
// have already read `revokedAt = null` and are queued at their write. Under a read → check →
// update implementation both writes then succeed and two successors are minted; under a
// conditional claim the second UPDATE re-evaluates its predicate after the winner commits
// and matches nothing.
//
// Both blocked rotations sit inside the app's own interactive transaction, whose Prisma
// timeout is 5 s — hence the deliberately short barrier deadline below. A slow barrier would
// surface as P2028 and look like a correctness failure it is not.
const BARRIER_DEADLINE_MS = 2_000;
const BARRIER_POLL_MS = 25;

// Counts backends this database is currently making wait. pg_blocking_pids is the reliable
// signal: two backends queued on one row produce a mix of granted `tuple` and waiting
// `transactionid` locks, so reading pg_locks by locktype miscounts.
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
    const blocked = rows[0]?.blocked ?? 0;
    if (blocked >= expected) {
      return;
    }
    if (Date.now() - startedAt > BARRIER_DEADLINE_MS) {
      throw new Error(
        `Barrier never formed: ${blocked} of ${expected} rotations reached the row ` +
          `lock within ${BARRIER_DEADLINE_MS} ms. This run proves nothing about concurrency.`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, BARRIER_POLL_MS));
  }
}

describe('Refresh token rotation under concurrency (e2e)', () => {
  let app: INestApplication;
  let lockHolder: PrismaClient;
  let observer: PrismaClient;

  beforeAll(async () => {
    app = await createE2eApp();
    // Separate clients: the lock holder keeps a transaction open, and the observer must be
    // able to query while it does.
    lockHolder = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
    observer = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
  });

  afterAll(async () => {
    await lockHolder.$disconnect();
    await observer.$disconnect();
    await app.close();
  });

  it('lets only one of two simultaneous presentations claim the token', async () => {
    const login = await request(httpServer(app))
      .post('/api/v1/auth/login')
      .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD })
      .expect(200);

    const refreshCookie = (login.headers['set-cookie'] as unknown as string[])
      .map((cookie) => cookie.split(';')[0] ?? '')
      .find((cookie) => cookie.startsWith('refresh_token='));
    if (refreshCookie === undefined) {
      throw new Error('Login set no refresh_token cookie; nothing to race.');
    }

    // The raw token cannot be looked up by hash without the pepper, so identify the row the
    // login just issued. uuid(7) ids are time-ordered, which breaks same-millisecond ties.
    const owner = await observer.user.findUniqueOrThrow({
      where: { email: OWNER_EMAIL },
    });
    const presented = await observer.refreshToken.findFirstOrThrow({
      where: { userId: owner.id, revokedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    // Independent requests, not a shared supertest agent: an agent's cookie jar mutates on
    // response, so the winner's Set-Cookie could rewrite the loser's request mid-flight.
    const rotate = async (): Promise<Response> =>
      request(httpServer(app))
        .post('/api/v1/auth/refresh')
        .set('Cookie', refreshCookie);

    const inFlight: Promise<Response>[] = [];

    await lockHolder.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM refresh_tokens WHERE id = ${presented.id} FOR UPDATE`;
        inFlight.push(rotate(), rotate());
        await waitUntilBlocked(observer, 2);
      },
      { timeout: 10_000 },
    );

    const outcomes = await Promise.all(inFlight);

    // Exactly one claim succeeds; the loser is answered like any replayed revoked token.
    expect(outcomes.map((res) => res.status).sort()).toEqual([200, 401]);

    const family = await observer.refreshToken.findMany({
      where: { familyId: presented.familyId },
    });
    // The original plus exactly ONE successor. A read → check → update rotation leaves three
    // rows here, which is the defect this spec exists to catch.
    expect(family).toHaveLength(2);
    // Presenting one token twice is the D19-2 theft signal, so the loser revokes the family —
    // including the successor the winner had just minted. Nothing in it stays usable.
    expect(family.filter((token) => token.revokedAt === null)).toHaveLength(0);
  });
});
