# Feature 002 — Content Modules (API)

**Feature Branch:** `002-content-modules`
**Milestone:** M2 — API Complete (doc 24 §2). **Status:** Draft — awaiting owner review.
**Governing docs:** 02 §4/§5, 07, 08, 09, 10, 15, 16, 18, 19.
**Requirements carried:** FR-CNT-020 (Projects), FR-CNT-030 (Experience) + employment type,
FR-CNT-040 (Skill), FR-CNT-060 (Testimonial, S), FR-PUB-012/030–033 (projects/case studies),
FR-PUB-021 (experience timeline), FR-PUB-011 (tech stack), FR-PUB-016 (testimonials, S),
FR-DSH-010/011/015 (CRUD + translations + slugs), FR-DSH-070 (settings) + career start date,
NFR-005/006/008. Owner decisions 2026-07-16 (owner-profile v1.3.1 §10).

## Problem

M1 shipped the backend spine and two content surfaces (settings, articles). The four
remaining public/CMS content types — **projects (case studies), experiences, skills,
testimonials** — are **schema-complete but have no modules** (`prisma/schema.prisma` marks
them so). M2 turns them into real admin + public API surfaces, and adds the two owner-approved
career-fact fields the honest experience timeline needs.

## Scope (what ships)

1. **Skills module** — public `GET /skills` (grouped by `SkillGroup`, `order`, `brandColor`;
   resolved locale + `availableLocales`); admin CRUD (`label` translations, `group`, `order`,
   `brandColor`). Built first: `ProjectTechnology` references skills.
2. **Projects module** — public `GET /projects` (featured-first `@@index([featured, order])`,
   `technology` filter, pagination) and `GET /projects/{slug}` (the structured case-study
   sections of `ProjectTranslation` — overview/businessProblem/solution/role/architecture/
   challenges/features/lessonsLearned, all opaque Markdown — plus gallery and technologies);
   admin CRUD with translations, per-locale unique slugs (D04-2/F-P5), gallery-item ordering,
   and technology links to skills. **Projects have no draft/published status in the approved
   schema** — see Open Questions.
3. **Experiences module** — public `GET /experiences` (reverse-chronological; includes the new
   `employmentType`); admin CRUD (`startDate`/`endDate`/`isCurrent`/`order`/**`employmentType`**,
   `role`/`company`/`location`/`impact` translations).
4. **Testimonials module** — public `GET /testimonials` (`isVisible` only, `order`); admin CRUD
   (`quote`/`authorName`/`authorRole` translations, `avatar`, `isVisible`, `order`).
5. **`employmentType` on Experience** (owner decision R2) — new Prisma enum
   `EmploymentType { FULL_TIME PART_TIME CONTRACT FREELANCE }` + `Experience.employmentType`.
   Stable code in the API; the frontend maps it to localized labels — **no translated labels
   stored per record** (same pattern as `SkillGroup`/`ContentStatus`).
6. **`careerStartDate` on SiteSettings** (owner decision R3) — canonical professional career
   start (**2023-11-01**), stored **once** on the existing single-row `SiteSettings` (see
   plan.md for the "why SiteSettings, not a new Owner/Profile entity" decision). Exposed on
   `GET /settings/site` (public) and `GET|PATCH /admin/settings`. The API exposes the **date**;
   **years of experience is derived on the frontend and never stored.**
7. **Contract + quality rails** — Swagger decorators + realistic examples on every new DTO;
   `npm run contract:export` stays DB-free; unit + e2e (jest-openapi contract assertions) per
   module; permission-catalog keys for all four resources; CI green.

## Model & doc-first changes (doc 01 principle 1)

The two new fields are not yet in the approved docs. Doc-first: revise the docs (decision-log
entries + version bumps) **before** the schema/code lands.

- **doc 09** — add `EmploymentType` enum + `Experience.employmentType`; add
  `SiteSettings.careerStartDate`; new decision-log entries; one new migration.
- **doc 02** — FR-CNT-030 gains employment type; FR-DSH-070 gains career start date;
  FR-PUB-021 shows employment type.
- **doc 10** — `GET /settings/site` and admin settings gain `careerStartDate`; the experience
  shape gains `employmentType`. (Projects/experiences/skills/testimonials endpoints are already
  in the doc 10 §5 catalog.)
- **Migration** — one migration adds the enum, `Experience.employmentType` (NOT NULL — the
  `experiences` table has no rows yet), and `SiteSettings.careerStartDate` (nullable; seed sets
  `2023-11-01`). Fix-forward (doc 09 §6).

## Acceptance criteria

- [ ] Migration adds `EmploymentType` + `Experience.employmentType` + `SiteSettings.careerStartDate`;
      `prisma validate`/`format` clean; `migrate deploy` applies cleanly; `contract:export` green with no DB.
- [ ] `GET /skills?locale=ar` returns groups in `order` with resolved Arabic labels + `availableLocales`.
- [ ] `GET /projects` is featured-first, filters by `technology`, paginates (`{data, meta}`);
      `GET /projects/{slug}` returns the structured case-study sections + gallery + technologies;
      absent slug → 404; admin reads return the full translation map.
- [ ] `GET /experiences` is reverse-chronological and carries `employmentType`; an invalid
      `employmentType` on admin write → 422.
- [ ] `GET /testimonials` returns only `isVisible` rows in `order`.
- [ ] Admin CRUD for all four modules: 401 without token; 403 on permission violation; 422 on
      validation incl. per-locale project slug collision; translations editable per locale.
- [ ] `GET /settings/site` exposes `careerStartDate` as an ISO date; admin PATCH sets it; seed
      seeds `2023-11-01`; no years-count is stored or returned.
- [ ] Every new protected route declares a permission-catalog key; `route-permissions.spec` passes.
- [ ] e2e per module green with jest-openapi contract assertions; `openapi.json` re-exported;
      `npm run lint && npx tsc --noEmit && npm test` green with no database.
- [ ] docs 09/02/10 revised and committed (doc-first) with decision-log entries + version bumps.

## Out of scope (owner-confirmed)

- **Profile / stat metrics** (Clients/Projects/Websites) — deferred, possible future capability
  only, gated by the doc 01 §7 feature gate (owner-profile §10). No `ProfileMetric` model, CRUD,
  API, translations, dashboard, or public counters.
- **Media upload pipeline** → feature 003 (gallery/avatar/og image references exist; the upload
  endpoint + storage adapter are 003). Projects/testimonials reference `MediaAsset`s that 003
  populates; 002 wires the relations and read shapes only. **Exit state:** after 002 these
  modules are text- and contract-complete but **image-incomplete** — project galleries,
  testimonial avatars, and OG images can be *referenced* but not *populated* until 003 ships
  uploads.
- **Redirects `resolve` endpoint, contact intake, preview tokens** → feature 004. (Per-locale
  project slugs exist here; the slug-rename→301 record + public `resolve` land with 004, matching
  how articles were handled.)
- **API hardening** (full throttle audit, backup workflow, latency smoke) → feature 005.
- **Dashboard UI** for these modules → web feature 002 (M3).
- **Derived years-of-experience wording/display** ("nearly 3 years" / "since 2023") → frontend
  concern (web M4); the API only exposes `careerStartDate`.

## Open questions (for review)

1. **`GET /articles/{slug}/related`** — cataloged in doc 10 §5 but unbuilt; not one of the four
   002 modules. Recommend a small add here (articles module exists; exercises the doc 18
   related-articles ranking test) **or** defer to a later articles pass. Owner to decide.
2. **Projects have no draft/published status** — a project is public the moment it is created.
   doc 02 FR-DSH-012 reads "publish/draft status _where applicable_; scheduled publishing _for
   articles_", so this reads as **intentional** (projects are curated and always-live), not an
   oversight. Please **confirm** that is intended; if draft case studies are ever wanted, that
   is a separate doc 09 change, not this feature.

## Revisions

- **2026-07-16** — Initial draft for owner review (Feature 002). Incorporates owner decisions of
  2026-07-16: `employmentType` on Experience, `careerStartDate` on SiteSettings; `ProfileMetric`
  explicitly excluded.
