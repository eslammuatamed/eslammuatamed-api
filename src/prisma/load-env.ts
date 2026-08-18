/**
 * Loads `.env` for scripts that run as their OWN Node process.
 *
 * Under Prisma 6, `new PrismaClient()` read `.env` itself, so `content:sync:plan`,
 * `content:sync:apply` and `db:seed:dev` picked up `DATABASE_URL` with nothing in their own code
 * doing it. Prisma 7 takes its connection string from a driver adapter we construct, and nothing
 * in that path reads `.env` — so those three commands began failing at startup with
 * "createPrismaClient: no connection string" unless the operator had exported the variable by hand.
 *
 * `prisma/seed.ts` was unaffected: it runs as a child of `prisma db seed`, and `prisma.config.ts`
 * has already called `process.loadEnvFile()` in that parent. Only the entrypoints invoked directly
 * through `ts-node` are exposed, which is why no gate caught this — the e2e harness injects
 * `DATABASE_URL` explicitly, so every test passes either way.
 *
 * Node 24's built-in loader, not `dotenv` — that dependency was removed deliberately.
 *
 * Two properties this relies on, both deliberate:
 *   - `loadEnvFile` does NOT overwrite variables that are already set, so a harness or a
 *     deploy environment that exports `DATABASE_URL` still wins over the file.
 *   - a missing `.env` is not an error. Production artifacts carry real environment variables and
 *     ship no `.env` at all; failing here would break the very case that needs no file.
 */
export function loadEnvFileIfPresent(): void {
  try {
    process.loadEnvFile();
  } catch {
    // No .env — the environment is expected to supply the variables directly.
  }
}
