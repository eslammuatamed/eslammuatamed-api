# Implementation Plan: Taxonomy Admin Pagination

**Branch**: `feature/frontend-v1-acceptance-api` | **Date**: 2026-09-01
**Spec**: [spec.md](spec.md)

## Summary

Apply the established admin pagination path independently to Categories and Tags in their shared Taxonomy module. Each list DTO inherits the existing pagination rules; each service uses a shared empty Prisma predicate in a batch transaction, ordered by `createdAt ASC, id ASC` before pagination, and returns `PaginatedResult`.

## Scope

- Change only existing admin `GET /admin/categories` and `GET /admin/tags` behavior.
- Keep public `GET /categories` and `GET /tags` controllers and service paths untouched.
- Regenerate `openapi.json`; do not synchronize frontend contracts.
- Do not change schema, migrations, routes, auth, Skills, frontend, or release state.

## Verification Plan

1. Unit-test each admin service's exact Prisma query, shared predicate, metadata, tie-breaker, and public-path isolation.
2. E2E-test both routes for defaults, explicit pages and sizes, beyond-total metadata, validation, 401/403, deterministic ties, and public locale/array behavior.
3. Temporarily remove `id ASC` from each service; the resource's focused deterministic-order test must fail, then restore it.
4. Regenerate OpenAPI and run focused unit/E2E/contract tests, typecheck, build, targeted lint, Prettier, docs guard, and diff check.
