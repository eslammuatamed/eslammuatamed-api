# Implementation Plan: Admin Skills Pagination and Group Filter

**Branch**: `feature/frontend-v1-acceptance-api` | **Date**: 2026-09-01
**Spec**: [spec.md](spec.md)

## Summary

Apply the established admin pagination path to the existing Skills route. The module-local query DTO inherits pagination validation and adds optional `SkillGroup`; the admin service uses one typed predicate in a Prisma batch transaction and orders `group ASC, order ASC, id ASC` before pagination.

## Scope

- Change only existing admin `GET /admin/skills` behavior.
- Leave public `GET /skills` controller and `listPublic()` source untouched.
- Regenerate `openapi.json`; do not synchronize frontend contracts.
- Do not change schema, migrations, routes, permissions, frontend, or release state.

## Verification Plan

1. Unit-test exact filtered/unfiltered Prisma arguments, metadata, deterministic ordering, and public-path isolation.
2. E2E-test all four groups, independent pagination defaults, filter-before-pagination, metadata, 401/403, non-public admin visibility, and public locale/array behavior.
3. Temporarily omit the group predicate from the count query; the focused group metadata test must fail, then restore it.
4. Regenerate OpenAPI and run focused unit/E2E/contract tests, typecheck, build, targeted lint, Prettier, docs guard, and diff check.
