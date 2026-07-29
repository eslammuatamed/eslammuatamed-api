import { rmSync } from 'node:fs';
import { E2E_STORAGE_DIR_ENV } from './e2e-storage';

// Removes the single per-run temp storage directory after the whole e2e run.
export default function globalTeardown(): void {
  const dir = process.env[E2E_STORAGE_DIR_ENV];
  if (dir) {
    rmSync(dir, { recursive: true, force: true });
  }
}
