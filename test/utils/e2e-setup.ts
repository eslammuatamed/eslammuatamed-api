import { assertE2eDatabase } from './e2e-database';
import { E2E_STORAGE_DIR_ENV } from './e2e-storage';

// Runs before each e2e test file's module graph is imported — that is, before `ConfigModule` reads
// `.env` and before Prisma opens a connection. The last moment at which a misdirected run can still
// be stopped rather than merely detected.
//
// FAIL-CLOSED: an unset `DATABASE_URL` throws here instead of being ignored. Ignoring it would let
// `ConfigModule` fall back to the developer's `.env` and put the suite on `eslammuatamed_dev`, the
// exact defect D18-8 exists to prevent.
assertE2eDatabase(process.env.DATABASE_URL);

// The directory itself is created in globalSetup.
const dir = process.env[E2E_STORAGE_DIR_ENV];
if (dir) {
  process.env.STORAGE_LOCAL_DIR = dir;
}
