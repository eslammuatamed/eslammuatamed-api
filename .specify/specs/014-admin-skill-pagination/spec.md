# Feature Specification: Admin Skills Pagination and Group Filter

**Feature Branch**: `feature/frontend-v1-acceptance-api`
**Created**: 2026-09-01
**Status**: Complete

## User Scenario & Testing

### User Story — Page and filter the Skills administration collection (Priority: P1)

An authorized operator can request canonical pages from the existing `GET /api/v1/admin/skills` route, optionally filtering by a valid `SkillGroup`. The collection is ordered deterministically by PostgreSQL enum declaration order, dashboard order, then id. Public Skills remains locale-resolved, visible-only, and non-paginated.

**Independent Test**: create all four groups, including same-order and non-public fixtures; assert filtered pages, metadata, deterministic boundaries, validation, authorization, and unchanged public behavior.

## Requirements

- **FR-001**: The existing admin list MUST accept `page`, `perPage`, and optional `group` through `AdminSkillListQueryDto extends PaginationQueryDto`.
- **FR-002**: `group` MUST be validated with the generated `SkillGroup` enum and filter both rows and total server-side.
- **FR-003**: Admin rows and total MUST share one predicate and use `group ASC, order ASC, id ASC` in Prisma before `skip` and `take`.
- **FR-004**: Admin reads MUST retain non-public Skills and existing JWT/`skills.read` authorization.
- **FR-005**: Public controller, locale resolution, visibility predicate, ordering, serialization, and array envelope MUST remain unchanged.
- **FR-006**: Generated OpenAPI MUST publish the three admin query parameters and paginated response while retaining the public operation.

## Owner Decision

The Dashboard's legacy full Skills vocabulary is intentionally incompatible during the accepted backend-first release window. No compatibility mode or picker endpoint will be added. Frontend Skills and project/experience picker integration is deferred until backend Production verification.
