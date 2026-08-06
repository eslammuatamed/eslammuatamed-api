# Spec 008 — Profile Pages Data Contract (API)

**Milestone:** M4 · **Depends on:** docs 02 v1.5.0, 09 v1.8.0, 10 v1.7.0, 11 v1.1.0, 18 v1.2.0, 22 v1.3.0, 24 v1.4.0 (merged `fdf7bd6`) · **Repo:** `eslammuatamed-api`

## Problem

`web-005 Profile pages` needs `/about`, `/experience` and `/resume`. Discovery proved two
genuine contract gaps:

1. **FR-PUB-020 (About, priority `M`) had no content source.** No CMS module, no API field for
   the narrative bio, engineering philosophy, current focus, or the portrait.
2. **FR-PUB-021 required `technologies` on Experience, which doc 09 never modelled.** Two
   approved documents disagreed; the API faithfully implemented doc 09.

Both were resolved Docs-first before any code (D02-8, D02-9, D09-17, D09-18, D10-13).

## Scope

Additive extension of two existing modules. **No new endpoints.**

- `SiteSettings`: `portraitAssetId` (IMAGE `MediaAsset`, RESTRICT), `professionalEmail`,
  `contactEmail` — locale-independent, all nullable.
- `SiteSettingsTranslation`: `aboutBio`, `engineeringPhilosophy` (Markdown), `currentFocus`
  (plain text) — all nullable.
- `ExperienceTechnology`: Experience ↔ Skill join mirroring `ProjectTechnology`.
- Media usages gain `settings-portrait`.

## Out of scope

Web pages; Contact form mail; Nodemailer/Resend; uploading the owner's real portrait;
replacing the résumé PDF; `dev → main`; deployment; Prisma 7 (deferred standalone, D16-6).

## Acceptance

- Public `GET /settings/site?locale=` returns `portraitAssetId` **and** a resolved
  `portrait` using the existing `PublicMediaImageDescriptor` — no portrait-specific schema.
- Requested-locale alt only; `null` (missing) and `""` (decorative) stay distinct.
- Public `GET /experiences?locale=` returns `technologies: [{id, label}]` ordered by
  `Skill.order`, with no cross-locale label fallback.
- Portrait accepts IMAGE only (422 otherwise); RESTRICT + 409 on in-use delete; clearing
  repoints without deleting.
- Emails trimmed, `@IsEmail()`, max 254, never lowercased. No `adminEmail` anywhere.
- Relation membership replaced transactionally; unknown and duplicate Skill ids → 422.
- Contract additive: no endpoint added, no property removed, no request DTO made required.
- Nullability is a content-readiness gate, **not** a publication model — no `aboutReady` flag.

## Non-negotiable constraints

- **`article_translations.search_vector` (D09-6) must survive.** `prisma migrate dev` emits
  `DROP INDEX` + `DROP COLUMN` for it on every run; committing that deletes article search
  (D02-3).
- Deterministic seeds never invent a portrait `MediaAsset` or any storage object.
- About prose is **owner-reviewed copy**, not engineering fill.
