# Tasks: Admin Article Title Search

## Phase 1 — Contract and tests

- [x] T001 Add focused service assertions for no-`q`, normalized title-only
  relation predicates, status conjunction, filtered pagination meta, and total
  ordering in `src/modules/articles/articles.service.spec.ts`.
- [x] T002 Add real-PostgreSQL E2E coverage for English/Arabic partial titles,
  cross-locale behavior, exclusion of excerpt/slug matches, `q` with status and
  pagination, blank/oversized input, 401, and 403 in `test/articles.e2e-spec.ts`.

## Phase 2 — Implementation

- [x] T003 Add validated, documented `q` to
  `src/modules/articles/dto/article-query.dto.ts`.
- [x] T004 Implement normalized multilingual title filtering and stable
  `createdAt DESC, id ASC` ordering in
  `src/modules/articles/articles.service.ts`.
- [x] T005 Run the Arabic-title negative control against a temporary
  English-only predicate; record the expected failure, restore the exact
  implementation, and rerun the focused test.

## Phase 3 — Contract and verification

- [x] T006 Export `openapi.json` through `npm run contract:export` and verify
  its admin Articles operation exposes the validated `q` parameter.
- [x] T007 Run focused unit, E2E, contract, lint, typecheck/build, format check,
  and `git diff --check`; review scope and authorization.

## Phase 4 — Handoff

- [x] T008 Record verified task completion and scope exclusions in these
  SpecKit artifacts; no seed change is needed because this changes only a
  collection query over existing data.
