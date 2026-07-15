# Feature 001 — M1 Foundation (API)

**Milestone:** M1 (doc 24 §2). **Governing docs:** 07, 08, 09, 10, 15, 16, 18, 19.
**Requirements carried:** FR-DSH-001…004 (auth), FR-CNT-001/010/050, FR-PUB-045/046,
FR-DSH-052 (settings head/tag fields), NFR-005/006/008.

## Problem

Nothing exists beyond the Nest scaffold. M1 needs the platform's backend spine: schema,
auth, contract plumbing, and the two content surfaces (settings, articles) the walking
skeleton renders — production-grade, not throwaway.

## Scope (what ships)

1. **Config module** — class-validator-validated environment; boot fails on invalid env.
2. **Database** — full Prisma schema per doc 09 (all entities incl. FR-DSH-052 fields on
   `SiteSettings`), snake_case `@map`, UUIDv7 ids; initial migration generated offline
   (`prisma migrate diff`, DB not yet provisioned); FTS generated column + GIN in
   handwritten migration SQL; idempotent `seed.ts` (locales en/ar, OWNER from env,
   SiteSettings, 4 categories).
3. **Common infra** — RFC 7807 exception filter (Prisma error mapping included),
   `{data, meta}` envelope interceptor, `@Public()`/`@Roles()`/`@CurrentUser()`,
   global JWT guard (default-deny) + roles guard, pagination + locale query DTOs,
   nestjs-pino with redaction, helmet, cookie-parser, throttler (login/public tiers),
   URI versioning `/api/v1`.
4. **Auth module** — login/refresh/logout per doc 19 §2: argon2id, 15-min access JWT,
   rotating opaque refresh (hashed, familyId, reuse detection revokes family), httpOnly
   cookie scoped to `/api/v1/auth`, throttled login.
5. **Locales module** — enabled-locales lookup backing `?locale=` validation.
6. **Settings module** — `GET /settings/site` (public, resolved locale) ·
   `GET|PATCH /admin/settings` (full map, incl. verification/analytics/custom-meta
   fields — FR-DSH-052).
7. **Articles + minimal taxonomy** — public `GET /articles` (paginated, category/tag/q
   filters), `GET /articles/{slug}` (published only — drafts 404, FR-PUB-046),
   admin CRUD with translations + per-locale slugs + scheduling (`publishAt`), cron
   promotion job (D07-3); categories/tags: public list + admin CRUD (minimal).
8. **Contract** — Swagger UI at `/docs`, realistic examples on DTOs,
   `npm run contract:export` emitting `openapi.json` **without a DB connection**.
9. **Quality rails** — strict TS, ESLint boundary conventions, unit tests (rotation
   reuse, locale resolution, visibility, scheduling transition), e2e specs authored for
   auth/settings/articles with contract assertions (jest-openapi), CI workflow
   (lint → typecheck → unit; e2e job wired but requires Postgres service), lint-staged
   pre-commit, `.nvmrc`/engines, docker-compose.yml (Postgres, for machines without a
   native instance).

## Acceptance criteria

- [ ] Boot fails fast with a readable message on any missing/invalid env var.
- [ ] `POST /auth/login` → access token + refresh cookie; `POST /auth/refresh` rotates
      (old token invalid); presenting a revoked family member revokes the family (401);
      `POST /auth/logout` revokes; login throttled (429 with Retry-After).
- [ ] `GET /articles?locale=ar` returns resolved Arabic shapes with `availableLocales`;
      missing translation → not listed; draft slug → 404 even when guessed.
- [ ] All 2xx bodies are `{data}` / `{data, meta}`; all errors are
      `application/problem+json`; 422 carries `errors[]` with field paths.
- [ ] `npm run contract:export` produces valid OpenAPI 3.x with no DB running.
- [ ] Admin endpoints 401 without token, 403 for role violations (settings PATCH is
      OWNER-only).
- [ ] Scheduler promotes a due SCHEDULED article exactly once (idempotent query).
- [ ] `npm run lint && npx tsc --noEmit && npm test` green; e2e suite passes once the
      local database exists (verification step in tasks).

## Out of scope (feature 002+)

Projects, experiences, skills, testimonials, media upload, redirects, contact, preview
tokens, related-articles endpoint.
