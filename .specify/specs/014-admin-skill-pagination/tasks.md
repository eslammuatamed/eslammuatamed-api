# Tasks: Admin Skills Pagination and Group Filter

## Phase 1 — Contract and tests

- [x] T001 Add focused Skills unit coverage for pagination, group filtering, shared predicates, ordering, metadata, and public isolation.
- [x] T002 Add focused E2E coverage for admin pagination/filtering/security and public regressions.

## Phase 2 — Implementation

- [x] T003 Add `AdminSkillListQueryDto` extending `PaginationQueryDto` with optional `SkillGroup`.
- [x] T004 Convert only the existing admin Skills list to filtered `PaginatedResult` semantics.
- [x] T005 Prove and restore the filtered-count negative control.

## Phase 3 — Contract and verification

- [x] T006 Regenerate and assert the authoritative OpenAPI operation.
- [x] T007 Run focused verification and review the final Skills-only diff.
