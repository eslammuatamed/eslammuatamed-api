# Tasks: Admin Testimonials Pagination

## Phase 1 — Contract and tests

- [x] T001 Add focused unit coverage for defaults, shared predicate, ordering, skip/take, metadata, and public isolation.
- [x] T002 Add E2E coverage for pagination, invalid queries, authorization, and public regressions.

## Phase 2 — Implementation

- [x] T003 Add `AdminTestimonialListQueryDto` extending `PaginationQueryDto`.
- [x] T004 Convert only the existing admin collection to a `PaginatedResult` service response.
- [x] T005 Prove and restore the id tie-breaker negative control.

## Phase 3 — Contract and verification

- [x] T006 Regenerate and assert the authoritative OpenAPI operation.
- [x] T007 Run all focused verification and review the final diff.
