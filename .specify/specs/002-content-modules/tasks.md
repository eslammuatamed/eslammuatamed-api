# Tasks 002 — Content Modules (API)

Executor: Opus (Codex-assisted, coordinator-reviewed). Each task cites its governing doc; check
off only with its verification done. `[P]` = parallelizable with siblings. Tasks run after the
spec + plan are approved. Dependency spine: **T1 → T2 → T3 → {T4…T8} → T9 → T10 → T11 → T12**
(T4 additionally depends on T3; T4–T8 are otherwise parallel).

- [x] T1 — Doc-first revisions (docs repo; doc 01 principle 1) **[gate]**
  - `eslammuatamed-docs`: **doc 09** — add `EmploymentType` enum + `Experience.employmentType`;
    `Project.isPublished`; `SiteSettings.careerStartYear` + `careerStartMonth` (decision-log
    entries + version bump). **doc 02** — FR-CNT-030 (+employment type); FR-CNT-020 / FR-PUB-012 /
    FR-PUB-030 (projects published-only + admin `isPublished` control); FR-DSH-070 (+career start
    year/month); FR-PUB-021 (+employment type display). **doc 10** — `careerStartYear`/`careerStartMonth`
    on `/settings/site` + admin settings; `employmentType` on the experience shape; projects public
    endpoints documented published-only. (Related-articles needs no doc change — already FR-PUB-044
    + doc 04 §5 + doc 10 catalog + doc 18.)
  - **Verify:** docs committed with decision IDs + version bumps **before** any API code lands.
- [x] T2 — Schema + migration + seed (doc 09)
  - Add `EmploymentType` enum; `Experience.employmentType` (NOT NULL — empty table);
    `Project.isPublished` (NOT NULL default `false` — empty table); `SiteSettings.careerStartYear`
    + `careerStartMonth` (nullable). One migration; seed sets `careerStartYear=2023`,
    `careerStartMonth=11`.
  - **Verify:** `prisma validate` + `prisma format` clean; `migrate deploy` applies; existing
    M1 unit/e2e still green; `contract:export` DB-free green.
- [x] T3 — Skills module (doc 02 §4 FR-CNT-040, doc 10)
  - Public `GET /skills` (grouped by `SkillGroup`, `order`, `brandColor`, resolved locale +
    `availableLocales`); admin CRUD (label translations, group, order, brandColor).
  - **Verify:** unit (locale resolution, group ordering); e2e + jest-openapi contract assertion.
- [x] T4 [P] — Projects module (FR-CNT-020 + `isPublished`, FR-PUB-012/030–033, doc 10) — *needs T3*
  - Public `GET /projects` (**published only**, featured-first, `technology` filter, pagination) +
    `GET /projects/{slug}` (**published only** → 404 for unpublished/absent; structured case-study
    sections + gallery + technologies); admin CRUD **incl. unpublished** with translations,
    per-locale unique slugs, gallery-item ordering, `ProjectTechnology` links to skills.
  - **Verify:** unit (published-only filter, unpublished slug → 404, slug-collision 422, technology
    filter within published, locale resolution); e2e + contract.
- [x] T5 [P] — Experiences module (FR-CNT-030 + employment type, FR-PUB-021, doc 10)
  - Public `GET /experiences` (reverse-chronological, carries `employmentType`); admin CRUD
    (dates, `isCurrent`, `order`, `employmentType`, role/company/location/impact translations).
  - **Verify:** unit (ordering, `employmentType` enum validation → 422 on invalid); e2e + contract.
- [x] T6 [P] — Testimonials module (FR-CNT-060/FR-PUB-016 [S], doc 10)
  - Public `GET /testimonials` (`isVisible` only, `order`); admin CRUD (quote/author translations,
    avatar reference, `isVisible`, `order`). **`isVisible` is the publication control — no new field.**
  - **Verify:** unit (visibility filter excludes hidden); e2e + contract.
- [x] T7 [P] — Articles related endpoint (FR-PUB-044 [S], doc 04 §5, doc 10, doc 18)
  - Public `GET /articles/{slug}/related` — published articles sharing category/tags, ranked
    (doc 04 §5), excluding self, fixed small limit. Existing `articles` module; **no schema change**.
    Scoped strictly to the ranking behavior.
  - **Verify:** unit (ranking order, self-excluded, published-only, unknown slug → 404); e2e + contract.
- [x] T8 [P] — Settings extension: career start (FR-DSH-070, doc 10)
  - Expose `careerStartYear` + `careerStartMonth` on public `GET /settings/site` and admin
    `GET|PATCH /admin/settings` (month validated 1–12); no derived years stored or returned.
  - **Verify:** unit (PATCH sets/clears; month range; public read shape); e2e + contract.
- [x] T9 — Permission guards (D19-8)
  - The code-defined catalog **already declares** `projects.*` / `experiences.*` / `skills.*` /
    `testimonials.*` CRUD keys (verified in `src/modules/access-control/permissions.ts`, 52 keys) —
    no catalog additions needed; wire each new protected route to its existing key. Related-articles
    and public reads are `@Public()`.
  - **Verify:** `route-permissions.spec` (metadata scan) green — no undeclared protected route.
- [x] T10 — Swagger + contract export (doc 10 §1)
  - Exhaustive decorators + realistic examples on all new DTOs; `contract:export` emits valid
    OpenAPI **without a DB**; re-export `openapi.json`.
  - **Verify:** `contract:export` green with DB down; diff reviewed.
- [x] T11 — E2e suites + CI (doc 18 §2)
  - Supertest e2e per module (happy, 422 shape, 401/403 authz) with jest-openapi assertions;
    wire into the existing CI e2e job.
  - **Verify:** unit-tier CI green locally; e2e compiles and passes against `eslammuatamed_test`.
- [x] T12 — Integration verification (coordinator)
  - `migrate deploy` + `db:seed` + full e2e green on the test DB; contract re-exported + committed;
    final `lint`/`typecheck`/`unit` green DB-free.
  - **Verify:** re-run seed is a no-op; all gates green; ready for PR.

## Not in this feature

Profile/stat metrics (deferred, future-gated); media upload + storage adapter (003); redirects
`resolve` + contact + preview (004); hardening/backup/latency smoke (005); dashboard UI (web M3);
public-site pages + derived-YoE wording (web M4).
