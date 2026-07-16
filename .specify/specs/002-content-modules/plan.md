# Plan 002 — Content Modules (API)

Architecture is already decided in the governing docs — this plan binds them to the feature.
Feature 002 is mostly **module build-out on a schema that already exists** (the four content
entities were defined in the M1 init migration), plus **two additive fields**.

## Bindings (decision IDs are law)

- Layering & modules: doc 07 §1–2 (D07-1/2) — thin controllers, services own logic,
  `PrismaService` direct (no repository layer). Folder shape doc 08 §2 (D08-2/3), admin
  controllers co-located per module (`*.admin.controller.ts`).
- Schema: doc 09 verbatim for the existing entities. Two additions (see below) via **one new
  migration**, authored the same way as M1 (`prisma migrate diff`/`dev`), `migration_lock.toml`
  already present. Fix-forward (doc 09 §6).
- Contract: doc 10 (D10-1…6) — `{data, meta}` envelope, RFC 7807 errors, offset pagination,
  `?locale=` resolved (public) vs full map (admin), all via the existing `common/` primitives.
- Authorization: doc 19 §3 (D19-8) — `@RequirePermission` + `PermissionsGuard`, code-defined
  catalog; every new protected route declares a key. Default-deny; public reads `@Public()`.
- Testing: doc 18 §2 — Jest unit (services, Prisma mocked) + supertest e2e with jest-openapi
  contract assertions; no cross-repo CI coupling (D18-3).

## Decision — where `careerStartDate` lives (owner asked to inspect first)

**`SiteSettings`.** The domain has **no Owner/Profile entity** (models verified: Locale, User,
Role, RolePermission, RefreshToken, Article, Category, Tag, Project, Skill, Experience,
Testimonial, MediaAsset, PageSeo, SlugRedirect, ContactMessage, SiteSettings — plus their
translations). `SiteSettings` is the existing single-row global config that already holds
owner-level profile facts (`profileLinks`, `availabilityStatus`, `resumeAssetId`). Creating a
dedicated Owner/Profile entity for a single date would add a table, module, and endpoints for
one field — a violation of principles 10 (simplicity) and 15 (no premature structure). So
`careerStartDate` is a nullable `DateTime` on `SiteSettings`, seeded `2023-11-01`, exposed on
the existing settings contract. If a real Owner/Profile aggregate is ever justified by more
fields, migrating this one column is trivial.

## Decision — `employmentType`

New Prisma enum `EmploymentType { FULL_TIME PART_TIME CONTRACT FREELANCE }` + a non-null
`Experience.employmentType` (the `experiences` table has no rows, so NOT NULL needs no
backfill). Code enum only — the frontend renders localized labels, matching how `SkillGroup`
and `ContentStatus` are handled; **no per-record translated labels** (owner directive).

## New dependencies

**None.** Every primitive this feature needs (Prisma, class-validator/-transformer, Swagger,
throttler, jest-openapi, pagination/locale DTOs, envelope/filter/guards) already exists from
M1. Adding a dependency here would fail the doc 16 §4 gate.

## Module build order

`docs revision (doc-first)` → `schema + migration + seed` → `skills` → `projects`
(references skills via `ProjectTechnology`) → `experiences` → `testimonials` →
`settings` extension (`careerStartDate`) → contract export → e2e + CI.

## Structure (doc 08 §2)

New: `src/modules/{skills,projects,experiences,testimonials}` — each with
`*.controller.ts` (public), `*.admin.controller.ts`, `*.service.ts`, `dto/`, `*.module.ts`,
and unit specs beside sources. Settings extension edits the existing `src/modules/settings`.
Permission keys added to the existing code-defined catalog
(`src/modules/access-control/permissions.ts`). E2e specs in `test/`.

## Cross-repo & doc-first sequencing

1. **Docs repo first** — revise docs 09/02/10 (decision-log entries + version bumps) for the
   two fields. This is the doc-first gate (principle 1); code that outruns it is a defect.
2. **API repo** — schema + migration + modules + contract export.
3. **Contract adoption** — after `openapi.json` re-exports, the web repo regenerates types in
   its own atomic commit (doc 16 §3) — a separate `eslammuatamed-web` change, not part of this
   API feature.

## Verification

Lint + typecheck + unit pass with **no database** (`contract:export` stays DB-free). E2e + seed
+ migrate run against `eslammuatamed_test` in the integration step (tasks T10–T11) — happy path,
422 validation shape, 401/403 authz, contract assertions per module. Contract re-exported and
committed. Both-repo CI stays independent (D18-3).
