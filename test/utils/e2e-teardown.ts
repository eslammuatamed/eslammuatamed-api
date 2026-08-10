import { rmSync } from 'node:fs';
import { dropDatabase } from './e2e-database-admin';
import { E2E_DATABASE_NAME_ENV } from './e2e-database';
import { E2E_STORAGE_DIR_ENV } from './e2e-storage';

// Removes the per-run temp storage directory and the per-run scratch database after the whole e2e
// run. Runs in the parent process, so it reads the names `globalSetup` recorded there.
export default async function globalTeardown(): Promise<void> {
  const dir = process.env[E2E_STORAGE_DIR_ENV];
  if (dir) {
    rmSync(dir, { recursive: true, force: true });
  }

  const databaseName = process.env[E2E_DATABASE_NAME_ENV];
  if (databaseName === undefined) {
    // Not a benign skip: `globalSetup` records the name the instant the database exists, so a
    // missing name here means the harness itself is broken and a database may have leaked unnamed.
    throw new Error(
      `e2e: teardown found no ${E2E_DATABASE_NAME_ENV}. The scratch database was not recorded — check globalSetup.`,
    );
  }

  try {
    // Exactly the one database this invocation created. Never a prefix sweep: a concurrent run from
    // another worktree owns its own `eslammuatamed_e2e_*` database and must survive this teardown.
    await dropDatabase(process.env.DATABASE_URL, databaseName);
  } catch (error) {
    console.error(
      `e2e: FAILED TO DROP scratch database "${databaseName}". It is still on the server; ` +
        `drop it manually with: DROP DATABASE "${databaseName}" WITH (FORCE);`,
    );
    throw error;
  }
}
