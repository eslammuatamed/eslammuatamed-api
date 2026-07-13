# eslammuatamed-api

NestJS 11 + Prisma + PostgreSQL 16 REST API for the eslammuatamed platform.
**Read before coding:** `.specify/memory/constitution.md` (binding), then the governing
documentation in `../eslammuatamed-docs/docs/` (00 = constitution, 07/09/10/19 = this
repo's architecture). Current work is tracked in `.specify/specs/` (feature-map in
`.specify/memory/feature-map.md`).

## Hard rules (full text in the constitution)

- Never share code/types/config with `eslammuatamed-web`; the exported OpenAPI document
  is the only interface. `npm run contract:export` must work without a database.
- Controllers thin; services own logic; `PrismaService` direct (no repository layer).
- Default-deny auth (`@Public()` opt-out); RFC 7807 errors; `{data, meta}` envelope;
  every endpoint/DTO fully swagger- and class-validator-decorated.
- Public reads: `?locale=` → resolved shape. Admin reads: full translation map. No
  silent locale fallback. Markdown is an opaque string here.
- Strict TS, no `any`; comments state constraints only, citing decision IDs (`Dxx-N`).
- **Official docs over habit (principle 16):** implement from the current NestJS / Prisma
  docs (load the `nestjs-mentor` skill); superseded idioms are defects — e.g.,
  passport-jwt where current docs teach a `JwtService` guard.

## Commands

`npm run start:dev` (port 3001) · `npm run lint` · `npx tsc --noEmit` · `npm test` ·
`npm run test:e2e` (needs Postgres) · `npm run contract:export` → `openapi.json` ·
`npx prisma migrate deploy` / `db:seed`. Local DB: native Postgres on 5432, databases
`eslammuatamed_dev`/`eslammuatamed_test` (passwordless role `eslammuatamed`); no
Docker in this project (owner directive). Env: copy `.env.example` → `.env` (boot-validated).

## Change discipline

Doc-first: work contradicting an approved doc → revise the doc in
`../eslammuatamed-docs` first (decision log + version bump). Conventional Commits on
`main`. Contract changes follow doc 16 §3 (export → version → web adopts).
