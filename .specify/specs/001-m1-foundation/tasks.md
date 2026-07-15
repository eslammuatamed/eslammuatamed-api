# Tasks 001 — M1 Foundation (API)

Executor: Opus. Each task cites its governing doc; check off only with its verification
done. `[P]` = parallelizable with siblings.

- [x] T1 — Dependencies + tooling baseline
  - Install plan.md dependency set; `.nvmrc` (24) + `engines`; lint-staged pre-commit
    (D15-1). No Docker in this project (owner directive) — native Postgres only.
  - **Verify:** `npm run lint`, `npx tsc --noEmit` still green on scaffold.
- [x] T2 — Config module (doc 07 §3)
  - Typed namespaces + class-validator env schema; boot fails on invalid env; no raw
    `process.env` elsewhere. **Verify:** unit test for schema rejection.
- [x] T3 — Prisma schema + offline migration + seed (doc 09; FR-DSH-052 fields)
  - Full schema (all entities), `@map` snake_case, UUIDv7; migration via
    `migrate diff` + handwritten FTS SQL (D09-6); idempotent `seed.ts`.
  - **Verify:** `prisma validate`; `prisma format` clean; migration SQL reviewed.
- [x] T4 — Common infra (docs 10, 19, 15)
  - problem+json filter (Prisma known-error mapping), envelope interceptor, decorators,
    global JWT + permissions guards (default-deny, D19-8), pagination/locale DTOs, pino + redaction,
    helmet, cookie-parser, throttler, `/api/v1` versioning, main.ts bootstrap.
  - **Verify:** unit tests for filter mapping + envelope shapes.
- [x] T5 — Locales module (D09-5)
  - Enabled-locale lookup + `LocaleQueryDto` validation. **Verify:** unit test.
- [x] T6 — Auth + users (doc 19 §2)
  - Login/refresh/logout, argon2id, rotation + family reuse detection, cookie
    `/api/v1/auth` path, login throttle tier.
  - **Verify:** unit tests — rotation invalidates old, reuse revokes family, logout
    revokes; cookie flags asserted.
- [x] T7 [P] — Settings module (FR-DSH-052)
  - Public resolved read; admin full-map read/PATCH (`settings.read` /
    `settings.update` permissions — D19-8). **Verify:** unit test locale resolution +
    permission denial.
- [x] T8 [P] — Taxonomy (minimal) + Articles (docs 02 §3, 07 §4–5, D10-6)
  - Public list/by-slug (published only), filters, pagination; admin CRUD with
    translations, per-locale unique slugs, schedule/publish transitions; cron promoter.
  - **Verify:** unit tests — visibility (draft 404), locale resolution, idempotent
    promotion, slug-collision 422.
- [x] T8b — Access control: dynamic RBAC (FR-DSH-090; D09-7, D19-8, D10-9)
  - `Role`/`RolePermission` tables + `User.roleId` (fold into the single regenerated
    init migration); OWNER system role seeded with the reserved `*` wildcard grant;
    code-defined permission catalog (one file, `resource.action` CRUD verbs + named
    actions); `@RequirePermission` + `PermissionsGuard` (per-request grant resolution,
    `*` matches all; replaces `@Roles`/`RolesGuard`); `access-control` module:
    `GET /admin/permissions`, roles CRUD (system-role edits → 422, in-use delete → 422),
    users list/create/role-assign.
  - **Verify:** guard unit tests (grant, deny, `*` wildcard, immediate grant changes);
    metadata-scan test proving every non-`@Public` endpoint declares a permission.
- [x] T9 — Swagger + contract export (doc 10 §1)
  - Exhaustive decorators + realistic examples; `/docs` UI; `contract:export` script
    (no DB — lazy Prisma). **Verify:** script emits valid `openapi.json` with DB down.
- [x] T10 — E2e suites + CI + README quickstart (docs 18 §2, 23 §3)
  - Supertest e2e for auth/settings/articles incl. jest-openapi contract assertions;
    GitHub Actions (lint→typecheck→unit; e2e job with Postgres service container);
    README: setup, scripts, provisioning commands.
  - **Verify:** unit-tier CI steps green locally; e2e compiles.
- [x] T11 — Database bring-up (coordinator; needs provisioned role/DBs)
  - `prisma migrate deploy` + `db:seed` against `eslammuatamed_dev`.
  - **Verify:** re-running seed is a no-op; `/health` OK.
- [x] T12 — Integration verification (coordinator)
  - Full e2e run green against the test DB; contract re-exported and committed.

## Deferred (recorded 2026-07-15, convergence audit)

- s3/R2 storage env vars are unpinned in `.env.example` + `env.validation.ts` — pin when
  the media bucket lands (pre-launch; D23-3/D23-12).
- The CI verify lane uploads `openapi.json` but does not diff it against the committed
  copy — contract currency is convention-enforced (doc 16 §3); consider a CI guard.
- `route-permissions.spec.ts` CONTROLLERS list is hand-maintained — consider deriving it
  from the app graph.
