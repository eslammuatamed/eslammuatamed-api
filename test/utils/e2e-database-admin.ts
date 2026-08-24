// The I/O half of the per-run e2e database. The rules live in
// `e2e-database.ts`; this file only performs them.
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createPrismaClient } from '../../src/prisma/standalone-client';
import {
  buildAdminUrl,
  buildScratchUrl,
  E2E_CREATABLE_NAME_PATTERN,
} from './e2e-database';

// `CREATE DATABASE` runs from the maintenance database over a short-lived client. Prisma is used
// rather than talking to `pg` directly purely for the harness; `content-sync.e2e-spec.ts` has done
// the same since it started provisioning its own database.
async function withAdminClient<T>(
  configuredDsn: string | undefined,
  work: (admin: PrismaClient) => Promise<T>,
): Promise<T> {
  const admin = createPrismaClient(buildAdminUrl(configuredDsn));
  try {
    return await work(admin);
  } finally {
    await admin.$disconnect();
  }
}

// A database name is an SQL IDENTIFIER, so it cannot be a bind parameter. The anchored pattern is
// therefore the control that makes this interpolation safe, and it is re-checked here rather than
// trusted from the caller.
function assertCreatable(databaseName: string): void {
  if (!E2E_CREATABLE_NAME_PATTERN.test(databaseName)) {
    throw new Error(
      `e2e: refusing to administer "${databaseName}" — not an e2e scratch database name.`,
    );
  }
}

export async function createDatabase(
  configuredDsn: string | undefined,
  databaseName: string,
): Promise<void> {
  assertCreatable(databaseName);
  await withAdminClient(configuredDsn, (admin) =>
    admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`),
  );
}

/**
 * Drops exactly the one database named. `WITH (FORCE)` (PostgreSQL 13+) closes any connection the
 * suite left open, so a lingering Prisma pool cannot turn teardown into a leaked database. There is
 * deliberately NO prefix sweep: dropping "every `eslammuatamed_e2e_*`" would destroy a concurrent
 * run's database, which is the failure mode a per-run name exists to prevent.
 */
export async function dropDatabase(
  configuredDsn: string | undefined,
  databaseName: string,
): Promise<void> {
  assertCreatable(databaseName);
  await withAdminClient(configuredDsn, (admin) =>
    admin.$executeRawUnsafe(
      `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`,
    ),
  );
}

// Migrations and seed run through the Prisma CLI with an ARGUMENT ARRAY and an explicit `env`:
// no shell is spawned, so nothing in the connection string can be interpreted as a command. The
// child needs the WHOLE environment, not just `DATABASE_URL` — `prisma/seed.ts` calls the same
// `validate()` the application boots with and aborts on a missing `JWT_ACCESS_SECRET`.
//
// `stdio: 'inherit'` on purpose: with `'pipe'`, a failing `migrate deploy` or `db seed` leaves the
// real Prisma error unread on `error.stderr` and surfaces only "Command failed: npx prisma …", so
// the first CI failure would arrive with no diagnosis. Provisioning must fail loudly.
function runPrismaCli(args: readonly string[], scratchUrl: string): void {
  execFileSync('npx', ['prisma', ...args], {
    env: { ...process.env, DATABASE_URL: scratchUrl },
    stdio: 'inherit',
  });
}

/**
 * Brings a freshly created database to the state the suite expects: the real migration history
 * applied from zero (which doubles as migration validation), then the canonical seed. `db seed`
 * rather than a direct `ts-node prisma/seed.ts` so `prisma.config.ts`'s `migrations.seed` entry
 * stays the one definition of what seeding means. (Prisma 7 moved that entry out of
 * `package.json#prisma`, which no longer exists; the seed is also explicit now, because
 * `migrate reset` no longer runs it.)
 *
 * That entry runs the COMPILED seed from `dist-ops/`, which is why `npm run test:e2e`
 * builds it first. The gain is that this suite exercises the exact seed binary a production
 * release runs, instead of a `ts-node` path that only ever worked from a source checkout.
 */
export function migrateAndSeed(
  configuredDsn: string | undefined,
  databaseName: string,
): void {
  const scratchUrl = buildScratchUrl(configuredDsn, databaseName);
  runPrismaCli(['migrate', 'deploy'], scratchUrl);
  runPrismaCli(['db', 'seed'], scratchUrl);
}
