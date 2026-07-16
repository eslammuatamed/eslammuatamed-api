# Feature Map — eslammuatamed-api (planning levels)

**L1 — Product & architecture:** `../eslammuatamed-docs/` (docs 00–24, all Approved).
**L2 — Features (this file):** numbered SpecKit features mapped to roadmap milestones
(doc 24). **L3 — Execution:** each feature's `spec.md` / `plan.md` / `tasks.md` under
`.specify/specs/NNN-*/`, implemented by Opus.

| # | Feature | Milestone | Scope (docs) | Status |
| --- | --- | --- | --- | --- |
| 001 | m1-foundation | M1 | Config, full Prisma schema + seed, common infra, auth, locales, settings (incl. FR-DSH-052 fields), articles + minimal taxonomy, scheduler, Swagger + contract export, CI | Planned |
| 002 | content-modules | M2 | Projects (case studies, gallery, technologies), experiences, skills, testimonials + employmentType + careerStart + related-articles — docs 02 §4/§5, 09 §3 | ✅ Shipped (v0.1.0/v0.1.1, deployed 2026-07-16) |
| 003 | media-pipeline | M2 | Upload pipeline, sharp variants, StorageAdapter (local/S3), alt-text per locale — docs 07 §6, 19 §5 | Not started |
| 004 | redirects-contact-preview | M2 | SlugRedirect + resolve endpoint (D10-7), contact intake + inbox, HMAC preview tokens (D10-8/D19-7) | Not started |
| 005 | api-hardening | M2→M5 | Full throttle tiers, audit pass, backup workflow (D23-5), latency smoke (NFR-006) | Not started |

Rules: features execute in order inside a milestone; a feature is done when its tasks
are checked, tests green, and the contract re-exported (doc 16 §3). New features enter
only through doc 24's backlog triggers + the doc 01 §7 gate.
