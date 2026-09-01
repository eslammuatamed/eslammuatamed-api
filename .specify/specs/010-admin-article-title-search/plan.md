# Implementation Plan: Admin Article Title Search

**Branch**: `feature/frontend-v1-acceptance-api` | **Date**: 2026-09-01
**Spec**: [spec.md](spec.md)

## Summary

Extend the existing admin Articles collection DTO with a validated optional
`q`, then add one Prisma relation predicate over `ArticleTranslation.title`.
Keep the controller, authorization, pagination utility, public full-text
search, database schema, and response envelope unchanged. Make the existing
admin order total by appending `id ASC`.

## Technical Context

- **Language**: TypeScript / NestJS 11
- **Storage**: PostgreSQL through Prisma
- **Testing**: Jest unit specs and real-PostgreSQL E2E specs
- **Contract**: Swagger decorators exported with `npm run contract:export`
- **Validation**: global `ValidationPipe` with `whitelist`,
  `forbidNonWhitelisted`, and `transform`

## Constitution Check

- Controller → service → Prisma remains intact.
- The existing module-local list DTO is the natural owner of input validation.
- No repository layer, dependency, schema, migration, public route, or auth
  change is needed.
- The OpenAPI artifact is generated rather than hand-edited.

## Files

```text
src/modules/articles/
├── dto/article-query.dto.ts
├── articles.service.ts
└── articles.service.spec.ts
test/articles.e2e-spec.ts
openapi.json
.specify/specs/010-admin-article-title-search/
├── spec.md
├── plan.md
└── tasks.md
```

## Design

`AdminArticleListQueryDto.q` mirrors the established admin Projects query
validation: optional string, maximum 120 characters. `listAdmin()` will build
one `Prisma.ArticleWhereInput`; when `query.q?.trim()` is nonempty it adds
`translations: { some: { title: { contains: term, mode: insensitive }}}`.
`status` remains a sibling predicate, giving AND semantics. The same `where`
is passed to `findMany` and `count` in the existing transaction. Ordering becomes
`[{ createdAt: 'desc' }, { id: 'asc' }]`.

## Verification Plan

1. Add focused service tests that pin exact Prisma predicates and ordering.
2. Add E2E coverage for bilingual title search, exclusions, status/pagination,
   validation, and authorization.
3. Run one Arabic-title negative control with the predicate temporarily
   constrained to English; prove failure, immediately restore, then rerun.
4. Export OpenAPI and run the focused contract, lint, typecheck/build, format,
   and diff checks.
