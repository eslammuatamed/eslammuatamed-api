# Plan 001 — M1 Foundation (API)

Technology and architecture are already decided in the governing docs — this plan binds
them to the feature; it does not re-litigate them.

## Bindings (decision IDs are law)

- Layering & modules: doc 07 §1–§2 (D07-1/2/3/5), folder shape doc 08 §2 (D08-2/3).
- Schema: doc 09 verbatim (D09-1…6) + `SiteSettings` head/tag fields (FR-DSH-052).
  Migration authored via `prisma migrate diff --from-empty --to-schema-datamodel
  --script` into `prisma/migrations/<ts>_init/migration.sql`, then hand-extended with
  the FTS generated column + GIN index (D09-6). `migration_lock.toml` committed.
- Contract: doc 10 (D10-1…6). Envelope via one global interceptor; problem+json via one
  global filter; both in `common/` with unit-testable pure mapping functions.
- Auth: doc 19 §2 (D19-1/2/3) — access-token verification via a plain `JwtService`-based
  guard, the pattern the current NestJS docs teach (constitution rule 9; passport was the
  superseded original binding). Authorization per doc 19 §3 (D19-8): `PermissionsGuard`
  + code-defined catalog. Refresh tokens are opaque values handled by `AuthService` +
  `RefreshToken` table, hashed SHA-256 with `REFRESH_TOKEN_PEPPER`.
- Prisma connection is **lazy** (no `$connect` in `onModuleInit`) so `contract:export`
  boots the app graph without a database (constitution rule 4). Health check performs an
  explicit query instead.

## New dependencies (doc 16 §4 justifications in one line each)

`prisma`/`@prisma/client` (ORM — doc 09) · `@nestjs/config` (env schema) ·
`@nestjs/jwt` (access-token sign/verify — no passport, per current NestJS docs)
· `argon2` (D19-1) · `@nestjs/swagger` (contract — doc 00 §3) · `@nestjs/throttler`
(doc 19 §6) · `nestjs-pino` + `pino-http` (D07-5) · `class-validator` +
`class-transformer` (validation pipe) · `@nestjs/schedule` (D07-3) · `cookie-parser`
(refresh cookie) · `helmet` (doc 19 §4) · dev: `jest-mock-extended`, `jest-openapi`,
`prisma` CLI. Nothing else without a written justification.

## Module build order

`config` → `prisma` (+schema/migration/seed) → `common` → `locales` → `auth`
(+`users`) → `access-control` (RBAC — T8b) → `settings` → `taxonomy` → `articles`
(+scheduler) → swagger/export → CI.

## Structure

Per doc 08 §2 exactly: `src/config`, `src/common/{filters,interceptors,guards,
decorators,dto,pagination}`, `src/prisma`, `src/modules/{auth,users,locales,settings,
taxonomy,articles,health}`; admin controllers co-located per module
(`articles.admin.controller.ts` — D08-2). Unit specs beside sources; e2e in `test/`.

## Verification

Lint + typecheck + unit tests must pass with no database. E2e + seed + migrate run in
the integration step (tasks T11–T12) once the local Postgres role/databases exist
(coordinator provisions; see repo README quickstart authored in T10).
