# Constitution — eslammuatamed-api

The canonical constitution is **`../eslammuatamed-docs/docs/00-engineering-principles.md`**
(16 principles + hard architectural constraints). It binds every decision in this
repository. The full architecture governing this repo lives in
`../eslammuatamed-docs/docs/` — especially 07 (backend architecture), 08 (folders),
09 (database), 10 (API contract), 15/16 (standards/conventions), 18 (testing),
19 (security). Decision IDs (`Dxx-N`) referenced below live in those documents.

## Repo-scoped binding rules

1. **Repository independence (doc 00 §3).** Nothing is ever shared with
   `eslammuatamed-web`: no packages, types, DTOs, schemas, utilities, configs. The
   OpenAPI document exported from this repo is the only interface.
2. **Modules are detachable.** Each `src/modules/<name>` must be liftable into another
   project: module-local DTOs/entities, cross-module access only through exported
   services, never through another module's Prisma models. `common/` holds mechanics
   only, never business logic, and never imports from `modules/`.
3. **Layering (D07-2, D00-3).** Controllers = routing + decorators only. Services own
   business logic, transactions, locale resolution. `PrismaService` is used directly —
   no repository layer.
4. **Contract discipline (API First).** Every endpoint and DTO field carries both
   class-validator and `@nestjs/swagger` decorators; an undecorated field does not
   exist. `npm run contract:export` must work without a database connection.
5. **Security defaults (doc 19).** Default-deny global auth guard + `@Public()` opt-out;
   argon2id; rotating refresh tokens with family reuse detection; RFC 7807 errors;
   validation `whitelist + forbidNonWhitelisted + transform`; no secrets or tokens in
   logs; no raw `process.env` outside the config module.
6. **Locale semantics (D10-6).** Public reads take `?locale=` and return resolved
   single-locale shapes; admin reads return full translation maps. Never silent
   cross-locale fallback. Markdown bodies are opaque strings (D01-5).
7. **Readable, teachable code.** Strict TS, no `any`, explicit return types on exports,
   comments state constraints/why only (with `Dxx-N` references where a decision is
   load-bearing). If a construct needs explaining, simplify it instead.
8. **Tests (doc 18).** Jest; unit specs beside sources; e2e in `test/` against real
   Postgres; contract assertions via the exported OpenAPI document. Trust-critical
   paths (auth, publishing, visibility, locale resolution) never merge untested.
9. **Official docs over habit (doc 00, principle 16).** Every NestJS / Prisma construct
   follows the _current_ official documentation (docs.nestjs.com, prisma.io/docs) —
   consult it before implementing; in agent sessions, load the `nestjs-mentor` skill.
   Superseded idioms are defects even when they work (e.g., passport-jwt strategies
   where current NestJS docs teach a `JwtService`-based guard; sync `jwt.sign` over
   `signAsync`). Latest stable APIs preferred; deviations need a decision-log entry.

## Execution model

Planning is authored with Fable; implementation runs on Opus (executor agents or
`/speckit.implement` sessions). Verification (lint, typecheck, tests, boot) precedes
every commit; commits follow Conventional Commits on trunk `main` (doc 17).
