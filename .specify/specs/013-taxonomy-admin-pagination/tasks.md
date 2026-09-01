# Tasks: Taxonomy Admin Pagination

## Phase 1 — Contract and tests

- [x] T001 Add independent Category and Tag unit coverage for pagination, metadata, deterministic ordering, shared predicates, and public isolation.
- [x] T002 Add focused E2E coverage for each admin route and its public regression behavior.

## Phase 2 — Implementation

- [x] T003 Add `AdminCategoryListQueryDto` and `AdminTagListQueryDto` extending `PaginationQueryDto`.
- [x] T004 Convert only the two existing admin list services/controllers to `PaginatedResult`.
- [x] T005 Prove and restore deterministic `id ASC` tie-breaker negative controls.

## Phase 3 — Contract and verification

- [x] T006 Regenerate and assert the authoritative OpenAPI operations.
- [x] T007 Run focused verification and review the final taxonomy-only diff.
