# Feature 002 — Content Modules (API)

**Feature Branch:** `002-content-modules`
**Milestone:** M2 — API Complete (doc 24 §2). **Status:** Draft — revised per owner review 2026-07-16; awaiting final approval.
**Governing docs:** 02 §3/§4/§5, 04 §5, 07, 08, 09, 10, 15, 16, 18, 19.
**Requirements carried:** FR-CNT-020 (Projects) + publication control, FR-CNT-030 (Experience) +
employment type, FR-CNT-040 (Skill), FR-CNT-060 (Testimonial, S), FR-PUB-012/030–033
(projects/case studies), FR-PUB-021 (experience timeline), FR-PUB-011 (tech stack),
FR-PUB-016 (testimonials, S), FR-PUB-044 (related articles, S), FR-DSH-010/011/015 (CRUD +
translations + slugs), FR-DSH-070 (settings) + career start, NFR-005/006/008. Owner decisions
2026-07-16 (owner-profile v1.3.1 §10; review resolutions below).

## Problem

M1 shipped the backend spine and two content surfaces (settings, articles). The four
remaining public/CMS content types — **projects (case studies), experiences, skills,
testimonials** — are **schema-complete but have no modules**. M2 turns them into admin + public
API surfaces, adds the two owner-approved career-fact fields, adds a **publication control for
projects**, and completes the articles public surface with the **related-articles** endpoint.

## Scope (what ships)

1. **Skills module** — public `GET /skills` (grouped by `SkillGroup`, `order`, `brandColor`;
   resolved locale + `availableLocales`); admin CRUD (`label` translations, `group`, `order`,
   `brandColor`). Built first: `ProjectTechnology` references skills.
2. **Projects module** — public `GET /projects` (**published only**, featured-first
   `@@index([featured, order])`, `technology` filter, pagination) and `GET /projects/{slug}`
   (**published only** → 404 if unpublished or absent, mirroring the article draft rule
   FR-PUB-046). Returns the structured case-study sections of `ProjectTranslation` (opaque
   Markdown) + gallery + technologies. Admin CRUD **including unpublished** projects, per-locale
   unique slugs (D04-2/F-P5), gallery-item ordering, technology links to skills. Publication is
   the new boolean `Project.isPublished` (see §5).
3. **Experiences module** — public `GET /experiences` (reverse-chronological; carries the new
   `employmentType`); admin CRUD (`startDate`/`endDate`/`isCurrent`/`order`/**`employmentType`**,
   `role`/`company`/`location`/`impact` translations).
4. **Testimonials module** — public `GET /testimonials` (**`isVisible` only**, `order`); admin
   CRUD (`quote`/`authorName`/`authorRole` translations, `avatar`, `isVisible`, `order`). The
   **existing `isVisible` boolean is the publication control — no new field is added** (review B).
5. **Articles — related endpoint** — public `GET /articles/{slug}/related` (FR-PUB-044, S):
   returns **published** articles sharing category/tags with the given article, ranked per
   doc 04 §5, excluding the article itself, with a small fixed limit. Scoped **strictly** to the
   already-approved ranking behavior and its doc 18 test — no other articles changes.
6. **`employmentType` on Experience** (review R2) — new Prisma enum
   `EmploymentType { FULL_TIME PART_TIME CONTRACT FREELANCE }` + `Experience.employmentType`.
   Stable code in the API; the frontend maps it to localized labels — **no translated labels
   stored per record** (same pattern as `SkillGroup`/`ContentStatus`).
7. **`isPublished` on Project** (review B) — new boolean `Project.isPublished @default(false)`,
   the **smallest** publication control (no scheduling, no status enum — projects are curated
   case studies that may be authored before their content/media are ready). Admin sees and edits
   all; public endpoints expose published only.
8. **`careerStartYear` + `careerStartMonth` on SiteSettings** (review C) — month-precision
   canonical career start (**2023 / 11**). The exact day is unknown and is **not invented** — a
   `DATE` would force a fabricated day, so two validated integers model month precision honestly.
   Exposed on `GET /settings/site` (public) and `GET|PATCH /admin/settings`. The API exposes
   year + month; **years of experience is derived on the frontend and never stored.**
9. **Contract + quality rails** — Swagger decorators + realistic examples on every new DTO;
   `npm run contract:export` stays DB-free; unit + e2e (jest-openapi contract assertions) per
   module; permission-catalog keys already exist for all four resources; CI green.

## Model & doc-first changes (doc 01 principle 1)

Doc-first: revise the docs (decision-log entries + version bumps) **before** the schema/code.

- **doc 09** — `EmploymentType` enum + `Experience.employmentType`; `Project.isPublished`;
  `SiteSettings.careerStartYear` + `careerStartMonth`. Decision-log entries; **one** new migration.
- **doc 02** — FR-CNT-030 gains employment type; FR-CNT-020 / FR-PUB-012 / FR-PUB-030 note
  projects are published-only with an admin `isPublished` control; FR-DSH-070 gains career start
  (year + month); FR-PUB-021 shows employment type.
- **doc 10** — `GET /settings/site` + admin settings gain `careerStartYear`/`careerStartMonth`;
  the experience shape gains `employmentType`; the projects public endpoints are documented as
  published-only (admin sees all). (Projects/experiences/skills/testimonials **and**
  `articles/{slug}/related` are already in the doc 10 §5 catalog.)
- **Related articles** need **no** new doc: FR-PUB-044 + ranking in doc 04 §5 + the doc 18 test +
  the doc 10 catalog entry already define it. Implement to the existing spec.
- **Migration** — one migration adds the enum, `Experience.employmentType` (NOT NULL — empty
  table), `Project.isPublished` (NOT NULL default `false` — empty table), and the two nullable
  `careerStart*` integers; seed sets `careerStartYear = 2023`, `careerStartMonth = 11`.
  Fix-forward (doc 09 §6).

## Acceptance criteria

- [ ] Migration adds `EmploymentType`, `Experience.employmentType`, `Project.isPublished`,
      `SiteSettings.careerStartYear`/`careerStartMonth`; `prisma validate`/`format` clean;
      `migrate deploy` applies; `contract:export` green with no DB.
- [ ] `GET /skills?locale=ar` returns groups in `order` with resolved Arabic labels + `availableLocales`.
- [ ] `GET /projects` returns **only published** projects, featured-first, filters by `technology`
      (the filter applies within published projects), paginates (`{data, meta}`);
      `GET /projects/{slug}` returns published projects only (unpublished/absent → 404); admin
      reads return **all** projects incl. unpublished with the full translation map.
- [ ] Admin can create and edit an unpublished project (`isPublished=false`), then publish it;
      a project is not public until `isPublished=true`.
- [ ] `GET /experiences` is reverse-chronological and carries `employmentType`; an invalid
      `employmentType` on admin write → 422.
- [ ] `GET /testimonials` returns only `isVisible` rows in `order` (no redundant publish field).
- [ ] `GET /articles/{slug}/related` returns published articles sharing category/tags, ranked
      (doc 04 §5), excluding self, within the fixed limit; unknown slug → 404.
- [ ] `GET /settings/site` exposes `careerStartYear` + `careerStartMonth`; admin PATCH sets them
      (month validated 1–12); seed seeds 2023/11; no years-count is stored or returned.
- [ ] Admin CRUD for all four modules: 401 without token; 403 on permission violation; 422 on
      validation incl. per-locale project slug collision; translations editable per locale.
- [ ] Every new protected route declares an existing permission-catalog key; `route-permissions.spec` passes.
- [ ] e2e per module green with jest-openapi contract assertions; `openapi.json` re-exported;
      `npm run lint && npx tsc --noEmit && npm test` green with no database.
- [ ] docs 09/02/10 revised and committed (doc-first) with decision-log entries + version bumps.

## Review resolutions (owner, 2026-07-16)

- **A — Related articles:** included in 002 (endpoint already in the doc 10 contract; small
  coherent completion of the existing Articles module), scoped to the FR-PUB-044 / doc 04 §5
  ranking behavior + doc 18 test only.
- **B — Project publication:** projects are **not** auto-public; add the smallest control — a
  boolean `Project.isPublished` (default unpublished). Public = published only; admin = all; no
  scheduling; slug lookup and technology filter operate on published projects on the public
  surface. Testimonials **reuse the existing `isVisible`** — no redundant state.
- **C — Career start precision:** store **month precision** (`careerStartYear` + `careerStartMonth`),
  not `2023-11-01` — the day is unknown and must not be invented. Frontend derives years.

## Out of scope (owner-confirmed)

- **Profile / stat metrics** (Clients/Projects/Websites) — deferred, future capability only,
  gated by doc 01 §7 (owner-profile §10). No `ProfileMetric` model/CRUD/API/UI.
- **Media upload pipeline** → feature 003. Projects/testimonials reference `MediaAsset`s that 003
  populates; 002 wires relations and read shapes only. **Exit state:** these modules are text- and
  contract-complete but **image-incomplete** — galleries/avatars/OG images are *referenced* but
  not *populated* until 003 ships uploads.
- **Redirects `resolve` endpoint, contact intake, preview tokens** → feature 004. (Per-locale
  project slugs exist here; the slug-rename→301 record + public `resolve` land with 004, matching
  articles.)
- **API hardening** (full throttle audit, backup workflow, latency smoke) → feature 005.
- **Dashboard UI** for these modules → web feature 002 (M3).
- **Derived years-of-experience wording/display** ("nearly 3 years" / "since 2023") → frontend
  (web M4); the API exposes only `careerStartYear`/`careerStartMonth`.

## Revisions

- **2026-07-16 (rev 2)** — Owner review: added related-articles (A), `Project.isPublished`
  publication control with testimonials reusing `isVisible` (B), month-precision career start
  `careerStartYear`/`careerStartMonth` (C); expanded the doc-first task scope; SpecKit tooling
  path reconciled (see plan.md). Open questions resolved.
- **2026-07-16 (rev 1)** — Initial draft for owner review.
