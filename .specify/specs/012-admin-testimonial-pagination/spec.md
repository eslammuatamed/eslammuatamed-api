# Feature Specification: Admin Testimonials Pagination

**Feature Branch**: `feature/frontend-v1-acceptance-api`
**Created**: 2026-09-01
**Status**: Complete

## User Scenario & Testing

### User Story — Page the Testimonials administration collection (Priority: P1)

An authorized operator can request pages from the existing `GET /api/v1/admin/testimonials` route and receives ordered rows plus the canonical pagination metadata. The public testimonials collection stays public, visible-only, locale-resolved, and unpaginated.

**Independent Test**: create testimonials spanning page boundaries, including equal-order records; assert the page order, totals, invalid queries, authorization, and unchanged public behavior.

### Edge Cases

- Omitted pagination is page 1 with 12 rows; `perPage` is bounded to 1–50.
- Equal `order` values are resolved by `id ASC` before pagination.
- A page after the final page is empty but retains real metadata.

## Requirements

- **FR-001**: The existing admin list route MUST accept only canonical `page` and `perPage` query fields via `AdminTestimonialListQueryDto extends PaginationQueryDto`.
- **FR-002**: The admin list MUST return the canonical paginated `{ data, meta }` envelope with no compatibility response.
- **FR-003**: Admin rows and total MUST share a single predicate and use `order ASC, id ASC` in Prisma before `skip`/`take`.
- **FR-004**: Authentication and `testimonials.read` authorization MUST remain unchanged.
- **FR-005**: The public controller, public visibility predicate, locale resolution, ordering, serializer, and array envelope MUST remain unchanged.
- **FR-006**: The generated OpenAPI document MUST publish the pagination query and paginated admin response.

## Success Criteria

- **SC-001**: Defaults, explicit page/perPage, totals, and beyond-total metadata are correct.
- **SC-002**: Invalid and unknown query values return the established 422 problem response.
- **SC-003**: Equal-order records retain a deterministic page boundary.
- **SC-004**: Public visible-only and locale behavior retains its non-paginated envelope.
