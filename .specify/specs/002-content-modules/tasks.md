# Tasks 002 — Content Modules (API)

Executor: Opus (Codex-assisted, coordinator-reviewed). Each task cites its governing doc; check
off only with its verification done. `[P]` = parallelizable with siblings. Tasks run after the
spec + plan are approved.

- [ ] T1 — Doc-first revisions (docs repo; doc 01 principle 1) **[gate]**
  - `eslammuatamed-docs`: doc 09 — add `EmploymentType` enum + `Experience.employmentType` +
    `SiteSettings.careerStartDate` (decision-log entries + version bump); doc 02 — FR-CNT-030
    (+employment type), FR-DSH-070 (+career start date), FR-PUB-021 (+employment type display);
    doc 10 — `careerStartDate` on `/settings/site` + admin settings, `employmentType` on the
    experience shape.
  - **Verify:** docs committed with decision IDs + version bumps before any API code lands.
- [ ] T2 — Schema + migration + seed (doc 09)
  - Add the enum, `Experience.employmentType` (NOT NULL — empty table), `SiteSettings.careerStartDate`
    (nullable); one new migration; seed sets `careerStartDate = 2023-11-01`.
  - **Verify:** `prisma validate` + `prisma format` clean; `migrate deploy` applies; existing
    M1 unit/e2e still green; `contract:export` DB-free green.
- [ ] T3 [P] — Skills module (doc 02 §4 FR-CNT-040, doc 10)
  - Public `GET /skills` (grouped by `SkillGroup`, `order`, `brandColor`, resolved locale +
    `availableLocales`); admin CRUD (label translations, group, order, brandColor).
  - **Verify:** unit (locale resolution, group ordering); e2e + jest-openapi contract assertion.
- [ ] T4 [P] — Projects module (FR-CNT-020, FR-PUB-012/030–033, doc 10)
  - Public `GET /projects` (featured-first, `technology` filter, pagination) + `GET /projects/{slug}`
    (structured case-study sections + gallery + technologies); admin CRUD with translations,
    per-locale unique slugs, gallery-item ordering, `ProjectTechnology` links to skills.
  - **Verify:** unit (slug-collision 422, locale resolution, technology filter); e2e + contract.
- [ ] T5 [P] — Experiences module (FR-CNT-030 + employment type, FR-PUB-021, doc 10)
  - Public `GET /experiences` (reverse-chronological, carries `employmentType`); admin CRUD
    (dates, `isCurrent`, `order`, `employmentType`, role/company/location/impact translations).
  - **Verify:** unit (ordering, `employmentType` enum validation → 422 on invalid); e2e + contract.
- [ ] T6 [P] — Testimonials module (FR-CNT-060/FR-PUB-016 [S], doc 10)
  - Public `GET /testimonials` (`isVisible` only, `order`); admin CRUD (quote/author translations,
    avatar reference, `isVisible`, `order`).
  - **Verify:** unit (visibility filter excludes hidden); e2e + contract.
- [ ] T7 — Settings extension: `careerStartDate` (FR-DSH-070, doc 10)
  - Expose `careerStartDate` (ISO date) on public `GET /settings/site` and admin `GET|PATCH
    /admin/settings`; no derived years number stored or returned.
  - **Verify:** unit (PATCH sets/clears; public read shape); e2e + contract.
- [ ] T8 — Permission guards (D19-8)
  - The code-defined catalog **already declares** `projects.*` / `experiences.*` / `skills.*` /
    `testimonials.*` CRUD keys (verified in `src/modules/access-control/permissions.ts`, 52 keys
    total) — no catalog additions needed; wire each new protected route to its existing key.
  - **Verify:** `route-permissions.spec` (metadata scan) green — no undeclared protected route.
- [ ] T9 — Swagger + contract export (doc 10 §1)
  - Exhaustive decorators + realistic examples on all new DTOs; `contract:export` emits valid
    OpenAPI **without a DB**; re-export `openapi.json`.
  - **Verify:** `contract:export` green with DB down; diff reviewed.
- [ ] T10 — E2e suites + CI (doc 18 §2)
  - Supertest e2e per module (happy, 422 shape, 401/403 authz) with jest-openapi assertions;
    wire into the existing CI e2e job.
  - **Verify:** unit-tier CI green locally; e2e compiles and passes against `eslammuatamed_test`.
- [ ] T11 — Integration verification (coordinator)
  - `migrate deploy` + `db:seed` + full e2e green on the test DB; contract re-exported + committed;
    final `lint`/`typecheck`/`unit` green DB-free.
  - **Verify:** re-run seed is a no-op; all gates green; ready for PR.

## Open scope (decide before/at T4–T5; see spec Open Questions)

- `GET /articles/{slug}/related` — small add here or defer (owner decision).
- Project draft/published status — not in the approved schema; a separate doc 09 change if wanted.

## Not in this feature

Profile/stat metrics (deferred, future-gated); media upload + storage adapter (003);
redirects `resolve` + contact + preview (004); hardening/backup/latency smoke (005); dashboard
UI (web M3); public-site pages + derived-YoE wording (web M4).
