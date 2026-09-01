# Feature Specification: Admin Experiences Pagination

**Feature Branch**: `feature/frontend-v1-acceptance-api`
**Created**: 2026-09-01
**Status**: Complete

## User Scenario & Testing

### User Story — Page the Experiences administration collection (Priority: P1)

An authorized dashboard operator can page through `GET /api/v1/admin/experiences` and receives the selected rows plus totals, while the public Experiences endpoint remains unchanged.

**Independent Test**: create enough admin Experience fixtures to cross a page boundary, request two pages, and verify the stable ordering, metadata, validation, authorization, and unchanged public array envelope.

### Edge Cases

- Omitted pagination defaults to page 1 and 12 rows; `perPage` is capped at 50.
- Equal `isCurrent`, `startDate`, and `order` values resolve by ascending id.
- An out-of-range page returns an empty data array with correct metadata.

## Requirements

- **FR-001**: The existing `GET /api/v1/admin/experiences` route MUST accept `page` and `perPage` through `PaginationQueryDto`.
- **FR-002**: The admin response MUST be the canonical `{ data, meta }` paginated envelope; no replacement route or legacy response is retained.
- **FR-003**: Rows and total MUST use the same Experience predicate.
- **FR-004**: Admin ordering MUST be `isCurrent DESC`, `startDate DESC`, `order ASC`, `id ASC`, entirely in Prisma before pagination.
- **FR-005**: JWT authentication and `experiences.read` authorization MUST remain unchanged.
- **FR-006**: `GET /api/v1/experiences?locale=` and `ExperiencesService.listPublic()` MUST remain unchanged.
- **FR-007**: The generated OpenAPI document MUST publish the pagination parameters and paginated response.

## Success Criteria

- **SC-001**: Page boundaries are deterministic and metadata reports the full matching total.
- **SC-002**: Invalid or unknown query fields return the established 422 problem response.
- **SC-003**: Unauthorized and unauthorized-permission callers retain 401 and 403 behavior.
- **SC-004**: The public Experience response stays `{ data: PublicExperience[] }` with no pagination metadata.
