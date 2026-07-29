# Tasks 008 — Profile Pages Data Contract (API)

Each task cites its governing doc(s); check off only with its **Verify** done. Verification is a
separate lane from authoring. **Dependency spine:** T1 → T2 → T3 → { T4 [P], T5 [P] } → T6 → T7 → T8 → T9(FINAL gate).

- [x] **T1 — Doc-first contract revisions (docs repo) [gate]**
  - Docs PR #20 → merged `fdf7bd6`: D02-8/D02-9 (About source, Experience technologies),
    D09-17/D09-18 (join + About columns), D10-13 (additive fields, no new routes), D11-6
    (dashboard surface), D18-7 (tests + seed policy), D22-8 (ProfilePage/Person), D24-7
    (slice order, `/uses` deferred). Versions 02→1.5.0, 09→1.8.0, 10→1.7.0, 11→1.1.0,
    18→1.2.0, 22→1.3.0, 24→1.4.0.
  - **Verify:** merged before any API code; diff limited to the seven contract documents.

- [x] **T2 — Additive migration (doc 09 D09-17/D09-18)** *(needs T1)*
  - Three nullable columns on `site_settings`, three on `site_settings_translations`,
    `experience_technologies` join (composite PK, `skill_id` index, CASCADE/RESTRICT),
    portrait FK RESTRICT. **Hand-authored**: `migrate dev` output included `DROP INDEX` +
    `DROP COLUMN search_vector`, which was removed following the
    `add_contact_message_archived_at` precedent.
  - **Verify:** `migrate deploy` clean from zero; `search_vector` still `attgenerated='s'`
    with its GIN index; no backfill; `media_assets` untouched.

- [x] **T3 — Schema-level FTS drift elimination (D09-6, D16-6)** *(needs T2)*
  - Bounded experiment in a throwaway worktree + disposable DB on pinned Prisma 6.19.3;
    adopted the surgical `Unsupported("tsvector")? @default(dbgenerated(...))` + `@@index(type: Gin)`
    representation. Full record in `plan.md`.
  - **Verify:** `migrate dev --create-only` produces an empty migration; all seven acceptance
    conditions met; schema conventions (`@map`/`@@map`, PascalCase models) preserved.

- [x] **T4 — Settings: portrait, emails, About fields [P]** *(needs T2)*
  - Entities, DTO, service. Portrait resolved via the existing `PublicMediaImageDescriptor`
    inside the settings include. IMAGE-only guard (422). Emails trimmed/`@IsEmail()`/max 254,
    not lowercased. `settings-portrait` added to media usages.
  - **Verify:** 31 unit tests incl. the N+1 assertion; e2e covers IMAGE accept, PDF/missing 422,
    usages, 409, clear-without-delete, alt locale semantics, email validation.

- [x] **T5 — Experiences: ExperienceTechnology [P]** *(needs T2)*
  - Join model, public `technologies` reusing the `{id,label}` shape, admin `technologyIds`,
    transactional replace, unknown/duplicate rejection.
  - **Verify:** unit tests for ordering, locale resolution, rejection paths, transactional
    replace; e2e for RESTRICT on Skill delete and CASCADE on Experience delete.

- [x] **T6 — Permanent FTS guard (two layers)** *(needs T3)*
  - `scripts/check-fts-migration-safety.mjs` (migration text, no bypass — only an explicit
    `APPROVED_FTS_CHANGES` allowlist) wired as `npm run guard:fts` in the CI unit job;
    `test/fts-invariants.e2e-spec.ts` (pg_catalog/pg_indexes invariants) in the e2e job.
  - **Verify:** guard passes clean and fails on an injected `DROP COLUMN`; invariant suite
    green against a replayed database.

- [x] **T7 — Deterministic seeds (D16-9, D18-7)** *(needs T4, T5)*
  - Base + dev seeds set the approved addresses and the experience↔skill links.
    `portraitAssetId` stays `null`; About prose deliberately unseeded pending owner-reviewed
    EN/AR copy.
  - **Verify:** fresh database, migrate + base seed ×2 + dev seed ×2 → identical row counts;
    `media_assets` = 0; full EN/AR parity.

- [x] **T8 — Contract export + compatibility** *(needs T4, T5)*
  - `npm run contract:export`; verified byte-identical across repeated runs; compared against
    `origin/dev`.
  - **Verify:** 48 paths unchanged; no schema/property removed; no request DTO field made
    required; `ExperienceTechnologyEntity` is the only added schema.

- [x] **T9 — Documentation & Handoff Gate (D16-8) [FINAL]**
  - Arabic module docs (`settings`, `experiences`, `media`, `prisma`); this SpecKit trio;
    feature-map row; central docs + OpenAPI already synced via T1/T8; verification report;
    clean worktree, no stashes, no secrets.
  - **Verify:** every component present and listed in the final report.
