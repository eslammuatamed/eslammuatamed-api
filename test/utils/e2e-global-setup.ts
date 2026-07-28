import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { E2E_STORAGE_DIR_ENV } from './e2e-storage';

// Runs once, in the parent process, before any test environment is created.
export default function globalSetup(): void {
  process.env[E2E_STORAGE_DIR_ENV] = mkdtempSync(
    join(tmpdir(), 'eslammuatamed-e2e-storage-'),
  );
}
