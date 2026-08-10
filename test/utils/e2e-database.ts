// Per-run e2e database isolation (doc 18 §2, D18-8).
//
// THE INVARIANT: `npm run test:e2e` must never write into `eslammuatamed_dev`, whatever the
// developer's `.env` says. Historically the suite simply used the configured `DATABASE_URL`, so a
// bare run against a normal development `.env` seeded and mutated the developer's own database.
//
// THE SHAPE: derive → generate → create → migrate/seed → run → drop. From the configured DSN the
// harness keeps only the SERVER coordinates (host, port, credentials, query parameters) and throws
// its database pathname away; the run then owns a freshly generated database of its own. A fixed
// `eslammuatamed_test` was rejected deliberately: two e2e runs from two worktrees would share it,
// and the first to finish would drop it under the second.
//
// This module is pure — no I/O, no process mutation — so every rule below is unit-tested directly
// (`e2e-database.spec.ts`) instead of being inferred from a suite that happened to pass.
import { randomUUID } from 'node:crypto';

/** Carries the generated database name from `globalSetup` to `globalTeardown` and the specs. */
export const E2E_DATABASE_NAME_ENV = 'E2E_DATABASE_NAME';

/** Every database this harness creates starts here, so a stray one is obvious in `\l`. */
export const E2E_DATABASE_PREFIX = 'eslammuatamed_e2e_';

// The run id is 24 lowercase hex characters: 96 bits of collision resistance, and short enough that
// the derived names below stay well inside PostgreSQL's 63-byte identifier limit
// (18 prefix + 24 id = 42, leaving room for a suffix).
const RUN_ID_LENGTH = 24;

/**
 * The ONLY database name shape the application is allowed to boot against. Anchored, so
 * `eslammuatamed_dev`, `postgres`, `template0`, `template1` and any inherited name fail it by
 * construction rather than by being listed.
 */
export const E2E_DATABASE_NAME_PATTERN = new RegExp(
  `^${E2E_DATABASE_PREFIX}[0-9a-f]{${RUN_ID_LENGTH}}$`,
);

/**
 * Names the harness may hand to `CREATE DATABASE` / `DROP DATABASE`. A database name cannot be a
 * bind parameter — it is an identifier, not a value — so this anchored check, not quoting, is what
 * makes the interpolation in `e2e-database-admin.ts` safe. It is deliberately wider than
 * `E2E_DATABASE_NAME_PATTERN` because a suite may own a suffixed database of its own
 * (see `deriveSuiteDatabaseName`), but it still admits nothing outside this harness's prefix.
 */
export const E2E_CREATABLE_NAME_PATTERN = new RegExp(
  `^${E2E_DATABASE_PREFIX}[0-9a-f]{${RUN_ID_LENGTH}}(?:_[a-z0-9_]{1,20})?$`,
);

/**
 * Databases that must never be reached through this harness, checked by name before the anchored
 * pattern above. The pattern already excludes them; naming them buys a diagnostic that says what
 * actually went wrong instead of "did not match a regex".
 */
const FORBIDDEN_DATABASE_NAMES: readonly string[] = [
  'eslammuatamed_dev',
  'postgres',
  'template0',
  'template1',
];

const SUPPORTED_PROTOCOLS: readonly string[] = ['postgresql:', 'postgres:'];

/** A fresh, collision-resistant database name for one e2e invocation. */
export function generateDatabaseName(): string {
  const runId = randomUUID().replace(/-/g, '').slice(0, RUN_ID_LENGTH);
  return `${E2E_DATABASE_PREFIX}${runId}`;
}

/**
 * A database owned by a single suite that provisions its own (currently only the content
 * synchronization e2e). Derived from the run's name so two concurrent invocations cannot collide —
 * a fixed name would let one run's `DROP DATABASE` destroy the other's mid-test.
 */
export function deriveSuiteDatabaseName(
  runDatabaseName: string,
  suite: string,
): string {
  if (!E2E_DATABASE_NAME_PATTERN.test(runDatabaseName)) {
    throw new Error(
      `e2e: cannot derive a suite database from "${runDatabaseName}" — not an e2e run database.`,
    );
  }
  if (!/^[a-z0-9_]{1,20}$/.test(suite)) {
    throw new Error(
      `e2e: suite name "${suite}" must be 1-20 characters of [a-z0-9_].`,
    );
  }
  return `${runDatabaseName}_${suite}`;
}

/**
 * Parses the configured DSN, keeping ONLY what identifies the server. Throws on anything that is
 * not a supported PostgreSQL DSN, so a malformed value fails here rather than becoming a confusing
 * connection error later.
 */
export function parseServerDsn(raw: string | undefined): URL {
  if (raw === undefined || raw.trim() === '') {
    throw new Error(
      'e2e: DATABASE_URL is not set. The harness needs a PostgreSQL server to create its scratch database on.',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`e2e: DATABASE_URL is not a valid URL: "${raw}".`);
  }

  if (!SUPPORTED_PROTOCOLS.includes(parsed.protocol)) {
    throw new Error(
      `e2e: DATABASE_URL must use postgresql:// or postgres://, got "${parsed.protocol}//".`,
    );
  }
  return parsed;
}

/**
 * Connection string for the maintenance database. `CREATE DATABASE` and `DROP DATABASE` cannot run
 * from inside the database they target, so the harness administers from `postgres`. This is the one
 * place a forbidden name is used on purpose, and it never reaches the application.
 */
export function buildAdminUrl(configuredDsn: string | undefined): string {
  const url = parseServerDsn(configuredDsn);
  url.pathname = '/postgres';
  return url.toString();
}

/**
 * Connection string for a database this run owns. The configured DSN's pathname is discarded — that
 * discard IS the isolation — while host, port, credentials and query parameters are preserved so the
 * scratch database lives on the same server the developer or CI configured.
 */
export function buildScratchUrl(
  configuredDsn: string | undefined,
  databaseName: string,
): string {
  if (!E2E_CREATABLE_NAME_PATTERN.test(databaseName)) {
    throw new Error(
      `e2e: refusing to build a connection string for "${databaseName}" — not an e2e scratch database name.`,
    );
  }
  const url = parseServerDsn(configuredDsn);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

/** The database name a connection string points at, without its leading slash. */
export function databaseNameOf(dsn: string): string {
  return parseServerDsn(dsn).pathname.replace(/^\//, '');
}

/**
 * FAIL-CLOSED gate, run in `setupFiles` before any test file imports the module graph — that is,
 * before `ConfigModule` reads `.env` and before Prisma opens a connection.
 *
 * Absence is a FAILURE, not a pass. At this point `.env` has not been read yet, so an unset
 * `DATABASE_URL` means `globalSetup` did not run or did not finish; letting that through would boot
 * the application, let `ConfigModule` fall back to `.env`, and land the suite on
 * `eslammuatamed_dev` — precisely the bug this harness exists to make impossible.
 *
 * Returns the validated URL so a caller can use it without re-reading the environment.
 */
export function assertE2eDatabase(dsn: string | undefined): string {
  if (dsn === undefined || dsn.trim() === '') {
    throw new Error(
      'e2e: DATABASE_URL is not set at test start. The e2e harness must provision its own database ' +
        'in globalSetup; refusing to boot rather than falling back to the configured .env database.',
    );
  }

  const name = databaseNameOf(dsn);

  if (FORBIDDEN_DATABASE_NAMES.includes(name)) {
    throw new Error(
      `e2e: refusing to run against "${name}". The e2e suite may only touch a database it created ` +
        `for this run (${E2E_DATABASE_PREFIX}…).`,
    );
  }

  if (!E2E_DATABASE_NAME_PATTERN.test(name)) {
    throw new Error(
      `e2e: refusing to run against "${name}" — it is not a database this run generated. ` +
        `Expected a name matching ${E2E_DATABASE_NAME_PATTERN.source}.`,
    );
  }

  return dsn;
}
