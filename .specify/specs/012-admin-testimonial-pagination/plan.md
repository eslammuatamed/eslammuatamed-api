# Implementation Plan: Admin Testimonials Pagination

**Branch**: `feature/frontend-v1-acceptance-api` | **Date**: 2026-09-01
**Spec**: [spec.md](spec.md)

## Summary

Apply the established Projects/Articles/Experiences admin pagination path to the existing Testimonials route. The module-local query DTO inherits `PaginationQueryDto`; the existing admin controller delegates it to `listAdmin`; the service reads rows and count in one Prisma transaction and returns `PaginatedResult`.

## Constitution Check

- Controller → service → Prisma remains the existing module layering.
- Existing pagination, page-meta, envelope interceptor, and Swagger helpers are reused.
- No new route, response union, schema migration, permission change, or public source change is introduced.
- `openapi.json` is regenerated through the repository contract exporter.

## Files

```text
src/modules/testimonials/
├── dto/testimonial.dto.ts
├── testimonials.admin.controller.ts
├── testimonials.service.ts
└── testimonials.service.spec.ts
test/testimonials.e2e-spec.ts
src/contract/admin-list-envelope.spec.ts
openapi.json
.specify/specs/012-admin-testimonial-pagination/
├── spec.md
├── plan.md
└── tasks.md
```

## Design

`AdminTestimonialListQueryDto` supplies canonical page defaults and `skip`/`take`. The admin service builds one empty `Prisma.TestimonialWhereInput`, passes it to both `findMany` and `count` in `$transaction`, and orders `[{ order: 'asc' }, { id: 'asc' }]` before taking the requested page. `listPublic()` is left unchanged.

## Verification Plan

1. Unit-test the exact Prisma query and metadata, including the id tie-breaker and public path isolation.
2. E2E-test defaults, explicit pages and size, totals, beyond-total behavior, validation, 401/403, and public visibility/locale/envelope behavior.
3. Remove `id ASC` temporarily; the focused deterministic-order unit test must fail. Restore it immediately.
4. Export OpenAPI; run focused units/E2E/contract, lint, format check, typecheck, build, docs guard, and diff check.
