import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createDatabase,
  dropDatabase,
  migrateAndSeed,
} from './e2e-database-admin';
import {
  buildScratchUrl,
  E2E_DATABASE_NAME_ENV,
  generateDatabaseName,
} from './e2e-database';
import { E2E_STORAGE_DIR_ENV } from './e2e-storage';

// Runs once, in the parent process, before any test environment is created. Values assigned to
// `process.env` here DO propagate into the test environments and are still readable in
// `globalTeardown`, which is what lets one place own both provisioning and cleanup.
//
// Order: derive → generate → create → migrate/seed. Nothing that follows may touch the configured
// database, so the scratch `DATABASE_URL` is published only once the database is actually ready.
export default async function globalSetup(): Promise<void> {
  process.env[E2E_STORAGE_DIR_ENV] = mkdtempSync(
    join(tmpdir(), 'eslammuatamed-e2e-storage-'),
  );

  // Nothing has read `.env` yet: `ConfigModule` loads it when a test file imports the module graph,
  // which is later than this. Load it now so the harness can see the configured SERVER, and so the
  // migrate/seed child processes inherit the full environment `prisma/seed.ts` validates. Node's
  // loader never overwrites a variable already set, so CI's explicit values still win.
  if (existsSync('.env')) {
    process.loadEnvFile();
  }

  const configuredDsn = process.env.DATABASE_URL;
  const databaseName = generateDatabaseName();

  await createDatabase(configuredDsn, databaseName);
  // Recorded immediately after creation so teardown — and a human reading the log after a SIGKILL —
  // knows exactly which database this run owns, even if the steps below throw.
  process.env[E2E_DATABASE_NAME_ENV] = databaseName;
  console.log(`e2e: provisioned scratch database "${databaseName}"`);

  try {
    migrateAndSeed(configuredDsn, databaseName);
  } catch (error) {
    // jest does not run `globalTeardown` when `globalSetup` throws, so the database created moments
    // ago would leak. Drop it here, then let the original failure surface.
    await dropDatabase(configuredDsn, databaseName).catch(() => {
      console.error(
        `e2e: STALE DATABASE LEFT BEHIND after a failed setup: "${databaseName}". Drop it manually.`,
      );
    });
    throw error;
  }

  process.env.DATABASE_URL = buildScratchUrl(configuredDsn, databaseName);
}
