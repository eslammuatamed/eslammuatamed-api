# Plan 002 — Content Modules (API)

**Status:** ✅ Shipped 2026-07-16 (released `v0.1.0`/`v0.1.1`, deployed + production-verified). Retained as the executed record.

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

## Decision — where the career start lives, and its precision (owner asked to inspect first)

**`SiteSettings`, as month-precision integers.** The domain has **no Owner/Profile entity**
(models verified: Locale, User, Role, RolePermission, RefreshToken, Article, Category, Tag,
Project, Skill, Experience, Testimonial, MediaAsset, PageSeo, SlugRedirect, ContactMessage,
SiteSettings — plus translations). `SiteSettings` is the existing single-row global config that
already holds owner-level profile facts (`profileLinks`, `availabilityStatus`, `resumeAssetId`).
A dedicated Owner/Profile entity for a couple of fields would add a table, module, and endpoints
for near-nothing — against principles 10 (simplicity) and 15 (no premature structure). If a real
Owner/Profile aggregate is ever justified, migrating these columns is trivial.

**Precision (review C):** the confirmed fact is **November 2023**; the day is unknown and must
not be invented. A single `DATE`/`DateTime` column would force a fabricated day (`2023-11-01`),
so the model is two nullable, validated integers — `careerStartYear` and `careerStartMonth`
(1–12) — the honest month-precision representation Postgres offers without a native year-month
type. Seeded `2023 / 11`. The API exposes year + month; **years-of-experience is derived on the
frontend and never stored.**

## Decision — `employmentType`

New Prisma enum `EmploymentType { FULL_TIME PART_TIME CONTRACT FREELANCE }` + a non-null
`Experience.employmentType` (the `experiences` table has no rows, so NOT NULL needs no
backfill). Code enum only — the frontend renders localized labels, matching how `SkillGroup`
and `ContentStatus` are handled; **no per-record translated labels** (owner directive).

## Decision — Project publication control (review B)

The smallest control that satisfies "curated case studies may be authored before they are
ready": a boolean **`Project.isPublished @default(false)`**. Not a `ContentStatus` enum — projects
need no draft/scheduled/archived lifecycle or scheduling (that machinery belongs to Articles);
copying it would violate principle 10. Public list/detail filter `isPublished = true`; an
unpublished slug 404s on the public surface (same rule as draft articles, FR-PUB-046); the
`technology` filter operates within published projects. Admin controllers see and edit all
projects regardless of state. **Testimonials already have `isVisible`** — that boolean is their
publication control, so no new field is added there (no redundant state).

## Related articles (review A)

`GET /articles/{slug}/related` needs **no schema change** — it reads the existing `Article`,
`Category`, and `Tag`/`ArticleTag` data. Rank by shared category/tags per doc 04 §5, published
only, exclude self, fixed small limit. Lands in the existing `articles` module; scoped strictly
to the ranking behavior and the doc 18 related-articles ranking test.

## New dependencies

**None.** Every primitive this feature needs (Prisma, class-validator/-transformer, Swagger,
throttler, jest-openapi, pagination/locale DTOs, envelope/filter/guards) already exists from
M1. Adding a dependency here would fail the doc 16 §4 gate.

## SpecKit tooling (reconciled 2026-07-16)

`create-new-feature.sh` resolved `specs/` at the repo root, but this project's specs live under
`.specify/specs/` (where `001-m1-foundation` lives). Fixed `SPECS_DIR` → `$REPO_ROOT/.specify/specs`
and pointed `.specify/feature.json` at this feature, so `/speckit.plan`, `/speckit.tasks`, and
`/speckit.implement` all resolve `.specify/specs/002-content-modules`. Verified via `--dry-run`
(now numbers 003) and `check-prerequisites --paths-only` (resolves 002); `001-m1-foundation`
untouched. Committed separately as `fix(speckit): …`.

## Module build order

`docs revision (doc-first)` → `schema + migration + seed` → `skills` → `projects`
(references skills via `ProjectTechnology`; `isPublished` gating) → `experiences`
(`employmentType`) → `testimonials` (`isVisible` gating) → `articles/{slug}/related`
(existing Articles module; no schema change) → `settings` extension
(`careerStartYear`/`careerStartMonth`) → permission guards → contract export → e2e + CI.

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
