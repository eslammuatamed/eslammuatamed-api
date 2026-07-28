// E2E media uploads go through the real local StorageAdapter, which writes actual files. Left at
// the `.env` default (`./storage`, doc 07 §6) every e2e run drops binaries inside the repository,
// leaving the working tree dirty and risking a committed test artifact.
//
// The directory is created once in `globalSetup` (parent process) rather than per test file:
// jest gives each test file its own `process.env` copy, so a per-file `mkdtemp` would leak one
// directory per suite and `globalTeardown` — which runs in the parent — could not find them.
// Values set in `globalSetup` DO propagate to the test environments.
//
// This keeps the repo clean without touching a developer's real local `./storage`, and without a
// broad `storage/` ignore rule that would also hide legitimate operational files.
export const E2E_STORAGE_DIR_ENV = 'E2E_STORAGE_DIR';
