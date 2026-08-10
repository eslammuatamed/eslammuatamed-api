import { defineConfig } from 'prisma/config';

// ============================================================================
// Prisma CLI configuration — this is NOT the application's configuration.
// ----------------------------------------------------------------------------
// Two different things read a database URL, and they are deliberately separate:
//
//   1. This file  → the Prisma CLI (`migrate`, `db seed`, `generate`, `studio`).
//      It runs in a terminal or in CI, before/outside the NestJS application.
//   2. AppConfigService (src/config) → the running NestJS application.
//      It validates every environment variable at boot and is the only thing
//      application code may read configuration from.
//
// So `PrismaService` still gets its URL from AppConfigService, never from here.
// A CLI command has no Nest container to ask, which is why this file exists.
// ============================================================================

// Prisma 7 no longer auto-loads `.env` (it did in v6). Node 24 can do it
// natively, so we load it here instead of adding a `dotenv` dependency.
// Missing `.env` is not an error: CI and the production server put DATABASE_URL
// straight into the environment, and `prisma generate` needs no database at all.
try {
  process.loadEnvFile();
} catch {
  // No `.env` file — fall through to whatever the environment already provides.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',

  migrations: {
    path: 'prisma/migrations',
    // Prisma 7 only ever runs this from an explicit `prisma db seed`.
    // `migrate reset` no longer seeds on its own — see prisma/README.md.
    seed: 'ts-node --transpile-only prisma/seed.ts',
  },

  datasource: {
    // Deliberately `process.env`, not Prisma's `env()` helper: `env()` throws
    // when the variable is absent, which would break `prisma generate` — a
    // command that never touches the database. CI generates the client right
    // after `npm ci`, before any `.env` exists.
    url: process.env.DATABASE_URL ?? '',
  },
});
