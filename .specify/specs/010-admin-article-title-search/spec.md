# Feature Specification: Admin Article Title Search

**Feature Branch**: `feature/frontend-v1-acceptance-api`
**Created**: 2026-09-01
**Status**: Complete

## User Scenario & Testing

### User Story 1 — Find an article by either authored title (Priority: P1)

An authorized dashboard operator can supply `q` to `GET /api/v1/admin/articles`
and receive the matching paginated article records when an English or Arabic
translation title contains that value.

**Why this priority**: This is the owner-approved prerequisite for Dashboard
Articles search.

**Independent Test**: Create bilingual articles, request the admin collection
with partial English and Arabic title terms, and verify the expected records,
metadata, authorization, and exclusions.

**Acceptance Scenarios**:

1. Given an article has an Arabic title containing a term, when an authorized
   user supplies that term as `q`, then the article is returned without a locale
   parameter.
2. Given a term occurs only in an excerpt or slug, when an authorized user
   supplies it as `q`, then the article is not returned because only titles are
   searched.
3. Given `q` and `status`, when both are supplied, then only articles matching
   both predicates are counted and returned.

### Edge Cases

- An absent, empty, or whitespace-only `q` applies no title predicate.
- A `q` longer than 120 characters is rejected by the existing validation
  boundary.
- Equal `createdAt` values are ordered by ascending article id after the
  existing descending `createdAt` order.
- An out-of-range page returns an empty page with metadata for the filtered
  collection.

## Requirements

- **FR-001**: `GET /api/v1/admin/articles` MUST accept optional `q` in addition
  to `page`, `perPage`, and `status`.
- **FR-002**: `q` MUST be an optional string of at most 120 characters.
- **FR-003**: The service MUST trim `q`; absent or blank values MUST not filter.
- **FR-004**: A nonblank `q` MUST be a case-insensitive substring predicate on
  `ArticleTranslation.title` across all translations of an article.
- **FR-005**: The predicate MUST NOT search excerpts, bodies, slugs, taxonomy,
  or other metadata.
- **FR-006**: `q` and `status` MUST be combined with AND, and both the rows and
  count MUST use the same predicate.
- **FR-007**: Admin ordering MUST remain `createdAt DESC` and append `id ASC`.
- **FR-008**: The endpoint MUST retain JWT authentication and `articles.read`.
- **FR-009**: The generated OpenAPI document MUST publish the new query field.

## Success Criteria

- **SC-001**: Partial English and Arabic authored-title queries each return the
  correct admin article records.
- **SC-002**: Excerpt-only and slug-only values never produce a title-search
  result.
- **SC-003**: Pagination metadata accurately reflects the filtered collection.
- **SC-004**: Existing public article search behavior is unchanged.

## Assumptions

- PostgreSQL/Prisma `mode: insensitive` is the established supported convention
  for this bounded admin substring search.
- This contract change does not require a schema or migration change.
