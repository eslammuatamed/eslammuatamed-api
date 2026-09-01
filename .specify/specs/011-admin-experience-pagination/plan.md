# Implementation Plan: Admin Experiences Pagination

**Branch**: `feature/frontend-v1-acceptance-api` | **Date**: 2026-09-01
**Spec**: [spec.md](spec.md)

## Summary

Apply the established Projects/Articles pagination path to the existing admin Experiences collection: a module-local DTO extends `PaginationQueryDto`; the thin controller delegates it to `listAdmin`; the service queries rows and count in one Prisma transaction and returns `PaginatedResult`. Public controller and service paths are not modified.

## Constitution Check

- The controller → service → Prisma layering remains unchanged.
- The existing shared pagination DTO, page metadata, envelope interceptor, and Swagger decorator are reused.
- No schema, migration, route, permission, or public API change is introduced.
- The OpenAPI artifact is generated through the repository export command.

## Files

```text
src/modules/experiences/
├── dto/experience.dto.ts
├── experiences.admin.controller.ts
├── experiences.service.ts
└── experiences.service.spec.ts
test/experiences.e2e-spec.ts
openapi.json
.specify/specs/011-admin-experience-pagination/
├── spec.md
├── plan.md
└── tasks.md
```

## Design

`AdminExperienceListQueryDto` inherits the canonical validation, defaults, `skip`, and `take` getters. `listAdmin(query)` calls `findMany` and `count` with the same empty `where` predicate in a transaction. The admin `findMany` uses `[{ isCurrent: 'desc' }, { startDate: 'desc' }, { order: 'asc' }, { id: 'asc' }]` before `skip`/`take`; it returns `PaginatedResult` with `buildPageMeta`. The existing public JS ordering remains untouched.

## Verification Plan

1. Pin the exact admin Prisma query and metadata in unit tests.
2. Add E2E page/metadata, 422, 401, 403, and public-isolation assertions.
3. Run the required negative control by temporarily removing the id tie-breaker, verify the focused unit test fails, restore it, then rerun.
4. Export OpenAPI and run focused unit/E2E/contract, typecheck/build, format check, and diff check.
