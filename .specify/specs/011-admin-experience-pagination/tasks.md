# Tasks: Admin Experiences Pagination

## Phase 1 — Contract and tests

- [x] T001 Add focused unit assertions for the admin predicate, order, skip/take, count, metadata, and public-path isolation.
- [x] T002 Add E2E coverage for pages, defaults, validation, 401, 403, and public envelope isolation.

## Phase 2 — Implementation

- [x] T003 Add `AdminExperienceListQueryDto` extending `PaginationQueryDto`.
- [x] T004 Convert the existing admin controller/service route to `PaginatedResult` with full Prisma ordering.
- [x] T005 Run and restore the stable-order negative control.

## Phase 3 — Contract and verification

- [x] T006 Export `openapi.json` and verify the existing operation has the canonical paginated schema.
- [x] T007 Run the focused and repository verification commands; review scope.
