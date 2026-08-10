// Unit tests for the e2e database isolation rules (doc 18 §2, D18-8). These run in the UNIT lane,
// not the e2e lane: the properties below are exactly the ones that must hold before a database is
// ever contacted, so proving them from a passing e2e run would be circular.
import {
  assertE2eDatabase,
  buildAdminUrl,
  buildScratchUrl,
  databaseNameOf,
  deriveSuiteDatabaseName,
  E2E_CREATABLE_NAME_PATTERN,
  E2E_DATABASE_NAME_PATTERN,
  E2E_DATABASE_PREFIX,
  generateDatabaseName,
  parseServerDsn,
} from './e2e-database';
import { createDatabase, dropDatabase } from './e2e-database-admin';

const DEV_DSN = 'postgresql://eslammuatamed@localhost:5432/eslammuatamed_dev';
const PRODUCTION_SHAPED_DSN =
  'postgresql://api_user:p%40ss%3Aword@db.internal:6432/eslammuatamed?sslmode=require&connection_limit=10';

describe('generateDatabaseName', () => {
  it('produces a name the fail-closed assertion accepts', () => {
    expect(generateDatabaseName()).toMatch(E2E_DATABASE_NAME_PATTERN);
  });

  it('is unique across invocations, so two concurrent runs cannot share a database', () => {
    const names = new Set(
      Array.from({ length: 500 }, () => generateDatabaseName()),
    );
    expect(names.size).toBe(500);
  });

  it('stays inside PostgreSQL 63-byte identifier limit, suffix included', () => {
    const name = generateDatabaseName();
    expect(name.length).toBeLessThanOrEqual(63);
    expect(
      deriveSuiteDatabaseName(name, 'content_sync').length,
    ).toBeLessThanOrEqual(63);
  });
});

describe('buildScratchUrl — an inherited dev URL becomes a scratch database', () => {
  it('keeps the server but replaces the configured database', () => {
    const name = generateDatabaseName();
    const url = new URL(buildScratchUrl(DEV_DSN, name));

    expect(url.host).toBe('localhost:5432');
    expect(url.username).toBe('eslammuatamed');
    expect(databaseNameOf(url.toString())).toBe(name);
    expect(url.toString()).not.toContain('eslammuatamed_dev');
  });

  it('preserves credentials and query parameters of a production-shaped DSN', () => {
    const name = generateDatabaseName();
    const url = new URL(buildScratchUrl(PRODUCTION_SHAPED_DSN, name));

    expect(url.host).toBe('db.internal:6432');
    expect(url.username).toBe('api_user');
    expect(url.password).toBe('p%40ss%3Aword');
    expect(url.searchParams.get('sslmode')).toBe('require');
    expect(url.searchParams.get('connection_limit')).toBe('10');
    expect(databaseNameOf(url.toString())).toBe(name);
  });

  it('refuses to address a database this harness did not generate', () => {
    expect(() => buildScratchUrl(DEV_DSN, 'eslammuatamed_dev')).toThrow(
      /not an e2e scratch database name/,
    );
  });
});

describe('buildAdminUrl', () => {
  it('targets the maintenance database, since CREATE/DROP cannot run from inside the target', () => {
    expect(databaseNameOf(buildAdminUrl(DEV_DSN))).toBe('postgres');
  });
});

describe('assertE2eDatabase — fail closed', () => {
  it('accepts a database generated for this run', () => {
    const dsn = buildScratchUrl(DEV_DSN, generateDatabaseName());
    expect(assertE2eDatabase(dsn)).toBe(dsn);
  });

  it.each([
    ['eslammuatamed_dev', 'the developer database'],
    ['postgres', 'the maintenance database'],
    ['template0', 'a template database'],
    ['template1', 'a template database'],
  ])('rejects %s (%s)', (database) => {
    expect(() =>
      assertE2eDatabase(
        `postgresql://eslammuatamed@localhost:5432/${database}`,
      ),
    ).toThrow(new RegExp(`refusing to run against "${database}"`));
  });

  it('rejects an arbitrary inherited database name', () => {
    expect(() =>
      assertE2eDatabase(
        'postgresql://eslammuatamed@localhost:5432/eslammuatamed_test',
      ),
    ).toThrow(/not a database this run generated/);
  });

  it('rejects a name that merely resembles the convention', () => {
    expect(() =>
      assertE2eDatabase(
        `postgresql://eslammuatamed@localhost:5432/${E2E_DATABASE_PREFIX}not-hex`,
      ),
    ).toThrow(/not a database this run generated/);
  });

  it('rejects a suite-owned database, which the application must never boot against', () => {
    const suiteDb = deriveSuiteDatabaseName(
      generateDatabaseName(),
      'content_sync',
    );
    expect(() =>
      assertE2eDatabase(`postgresql://eslammuatamed@localhost:5432/${suiteDb}`),
    ).toThrow(/not a database this run generated/);
  });

  // The load-bearing case: at guard time `.env` has not been read, so an unset variable means
  // globalSetup never ran. Treating that as "nothing to check" would let ConfigModule fall back to
  // the developer's `.env` and put the whole suite on eslammuatamed_dev.
  it.each([[undefined], [''], ['   ']])(
    'rejects an absent DATABASE_URL (%p) rather than passing it through',
    (value) => {
      expect(() => assertE2eDatabase(value)).toThrow(
        /is not set at test start/,
      );
    },
  );
});

describe('parseServerDsn — a malformed URL fails safely', () => {
  it.each([
    ['not-a-url', /not a valid URL/],
    ['   ', /is not set/],
    [
      'mysql://user@localhost:3306/db',
      /must use postgresql:\/\/ or postgres:\/\//,
    ],
    // Parses as a URL whose scheme is "localhost:" — caught by the scheme check, not the parser.
    [
      'localhost:5432/eslammuatamed_dev',
      /must use postgresql:\/\/ or postgres:\/\//,
    ],
  ])('rejects %p', (value, expected) => {
    expect(() => parseServerDsn(value)).toThrow(expected);
  });

  it('accepts both supported schemes', () => {
    expect(parseServerDsn(DEV_DSN).protocol).toBe('postgresql:');
    expect(
      parseServerDsn('postgres://eslammuatamed@localhost:5432/x').protocol,
    ).toBe('postgres:');
  });
});

describe('deriveSuiteDatabaseName — teardown targets exactly the owned database', () => {
  it('hangs the suite database off this run, so concurrent runs never collide', () => {
    const runA = generateDatabaseName();
    const runB = generateDatabaseName();

    expect(deriveSuiteDatabaseName(runA, 'content_sync')).toBe(
      `${runA}_content_sync`,
    );
    expect(deriveSuiteDatabaseName(runA, 'content_sync')).not.toBe(
      deriveSuiteDatabaseName(runB, 'content_sync'),
    );
  });

  it('produces a name the admin layer will administer', () => {
    expect(
      deriveSuiteDatabaseName(generateDatabaseName(), 'content_sync'),
    ).toMatch(E2E_CREATABLE_NAME_PATTERN);
  });

  it('refuses to derive from anything that is not a run database', () => {
    expect(() => deriveSuiteDatabaseName('eslammuatamed_dev', 'x')).toThrow(
      /not an e2e run database/,
    );
  });

  it('refuses a suite label that is not a safe identifier fragment', () => {
    const run = generateDatabaseName();
    expect(() =>
      deriveSuiteDatabaseName(run, 'a"; DROP DATABASE x --'),
    ).toThrow(/must be 1-20 characters/);
  });
});

// The pattern tests above prove the RULE; these prove the admin layer actually APPLIES it. Without
// them, deleting `assertCreatable` from `dropDatabase` would break no test. No database is
// contacted: the throw happens before any client is constructed.
describe('the admin layer refuses to administer anything outside the harness', () => {
  it.each([
    ['eslammuatamed_dev'],
    ['postgres'],
    ['template1'],
    ['"; DROP DATABASE eslammuatamed_dev; --'],
  ])('dropDatabase refuses %p', async (name) => {
    await expect(dropDatabase(DEV_DSN, name)).rejects.toThrow(
      /refusing to administer/,
    );
  });

  it.each([['eslammuatamed_dev'], ['postgres']])(
    'createDatabase refuses %p',
    async (name) => {
      await expect(createDatabase(DEV_DSN, name)).rejects.toThrow(
        /refusing to administer/,
      );
    },
  );
});

describe('E2E_CREATABLE_NAME_PATTERN — the control on raw SQL identifier interpolation', () => {
  it.each([
    'eslammuatamed_dev',
    'postgres',
    '"; DROP DATABASE eslammuatamed_dev; --',
    'eslammuatamed_e2e_',
    `${E2E_DATABASE_PREFIX}0123456789abcdef01234567 extra`,
  ])('rejects %p', (candidate) => {
    expect(E2E_CREATABLE_NAME_PATTERN.test(candidate)).toBe(false);
  });
});
