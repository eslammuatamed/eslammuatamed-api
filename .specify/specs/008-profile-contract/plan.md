# Plan 008 — Profile Pages Data Contract (API)

## Approach

Extend `settings` and `experiences` in place. Both already own the patterns this needs — the
résumé asset is an existing nullable media FK with RESTRICT and a resolved public descriptor,
and `ProjectTechnology` is an existing Skill-registry join. Mirroring them keeps one way of
doing each thing rather than inventing a second.

## Key decisions

| Decision | Why |
|---|---|
| About on Site Settings, not a new module | One record, one operator; a module would add CRUD, permissions and dashboard surface for a singleton (D02-8) |
| Reuse `PublicMediaImageDescriptor` for the portrait | A portrait-specific media shape would fork the media contract; variants/dimensions/BlurHash/alt semantics come free (D10-13) |
| No `ExperienceTechnology.order` column | `Skill.order` already gives deterministic order and keeps Experience consistent with Projects (D09-17) |
| Reject unknown/duplicate Skill ids in the service | An FK violation or a silent de-duplication both hide a caller mistake; a 422 names it |
| Represent `search_vector` as `Unsupported("tsvector")? @default(dbgenerated(...))` | Empirically eliminates the destructive drift on the pinned Prisma 6.19.x; see the experiment record below |
| Two-layer FTS guard | Migration text and replayed-database catalog fail differently; text alone cannot catch a wrong column shape |

## Prisma FTS representation experiment (bounded, isolated)

Run in a throwaway worktree against a disposable database on the **pinned** Prisma 6.19.3
(D16-6 — Prisma 7 is a separate deferred upgrade and was not used).

- **Baseline (no schema field):** `migrate dev --create-only` emits `DROP INDEX` +
  `DROP COLUMN search_vector`. Reproduced.
- **`Unsupported("tsvector")?` alone:** emits `ALTER COLUMN … DROP DEFAULT`, which PostgreSQL
  **rejects** on a generated column (`ERROR: … is a generated column`). Rejected.
- **`db pull` introspection:** round-trips to an empty migration, but rewrites the entire
  schema — every `@map`/`@@map` lost, models renamed snake_case (464/611 line churn),
  violating D09-1. Rejected as a wholesale adoption.
- **Surgical (introspection's exact escaped expression, conventions preserved):** validates,
  and `migrate dev --create-only` produces an **empty migration**. Adopted.

All seven acceptance conditions verified: STORED generated column intact, expression
unchanged, GIN index unchanged, no-op diff, Client create/update/upsert working (generated
column auto-populated on insert), generation/typecheck/396 tests unaffected, from-zero replay
reproduces the objects.

**Known limitation, recorded deliberately:** the representation declares a `DEFAULT` where the
database has `GENERATED ALWAYS … STORED`. Prisma cannot express the latter. The database stays
correct because the raw-SQL migration creates it; the schema representation exists only to stop
the diff engine proposing a drop. The guard is the real protection.

## Risks

| Risk | Mitigation |
|---|---|
| A future migration silently drops the FTS objects | `npm run guard:fts` in CI + catalog invariant e2e |
| Prisma version change alters the diff outcome | Guard fails loudly; Prisma 7 is a separate reviewed upgrade (D16-6) |
| Portrait resolution introduces N+1 | Include-based resolution with an explicit query-count assertion |
| About sections render empty | Nullability = readiness gate; Web omits absent sections (doc 02 §9) |
