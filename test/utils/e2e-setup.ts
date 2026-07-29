import { E2E_STORAGE_DIR_ENV } from './e2e-storage';

// Runs before each e2e test file's module graph is imported, so ConfigModule reads the
// redirected path when AppModule boots. The directory itself is created in globalSetup.
const dir = process.env[E2E_STORAGE_DIR_ENV];
if (dir) {
  process.env.STORAGE_LOCAL_DIR = dir;
}
