# Feature Specification: Taxonomy Admin Pagination

**Feature Branch**: `feature/frontend-v1-acceptance-api`
**Created**: 2026-09-01
**Status**: Complete

## User Scenario & Testing

### User Story — Page taxonomy administration collections (Priority: P1)

An authorized operator can request canonical pages from the existing `GET /api/v1/admin/categories` and `GET /api/v1/admin/tags` routes and receives deterministically ordered rows plus pagination metadata. The public taxonomy routes remain locale-resolved, publicly accessible, and non-paginated.

**Independent Test**: create same-timestamp taxonomy rows across page boundaries; assert deterministic page order, metadata, validation, authorization, and the unchanged public collection behavior for both resources.

## Requirements

- **FR-001**: Each existing admin collection MUST accept only `page` and `perPage` through a module-local DTO extending `PaginationQueryDto`.
- **FR-002**: Each admin collection MUST return the canonical `{ data, meta }` envelope, with no compatibility response or new route.
- **FR-003**: Admin rows and totals MUST share one predicate and apply `createdAt ASC, id ASC` in Prisma before `skip` and `take`.
- **FR-004**: Existing JWT and `categories.read` / `tags.read` permissions MUST remain unchanged.
- **FR-005**: Public controllers, locale resolution, omission of untranslated entities, ordering, serialization, and array envelopes MUST remain unchanged.
- **FR-006**: The generated OpenAPI document MUST publish canonical pagination for both admin operations while retaining public contracts.

## Owner Decision

Admin pagination intentionally breaks the Dashboard Article editor's legacy full-list selector during the accepted backend-first release window. No compatibility mode or picker-specific endpoint will be added. Frontend integration is deferred until backend Production verification.
