# Plan 005 — API Hardening (API)

**Branch**: `feature/005-api-hardening` (git) · spec dir `005-api-hardening` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)
**Base**: API `dev` @ `c1493a1`. **Status**: 📝 Draft — scope defined autonomously (Feature-005 autonomous-execution authorization). **Release Freeze active** (D17-5 / D23-18): `feature → PR → dev` only.

> Per the project's established format (003/004 `plan.md`), the design lives in this single `plan.md` (+ `tasks.md`) — no separate `research.md`/`data-model.md`/`contracts/`. Architecture is already decided in the governing docs; this plan **binds** them. Like Feature 002/004 this is a **change over the existing schema** — **one additive nullable column + migration**, **no new runtime dependency** (`@nestjs/schedule` + `@nestjs/throttler` already wired). The audit portion is **verify + regression-cover**, not a rewrite (per the authorization).

## Summary

Two behaviours over existing infra plus a durable audit: (1) **retention** — a nullable `ContactMessage.archivedAt` (set/cleared on the archive transition) + an in-process daily `@Cron` purge that hard-deletes messages archived > 12 months ago (doc 19 §6); (2) **NFR-006 latency smoke** — a coarse warmup-discarded p95 e2e check (generous env-budget tripwire; the deterministic query-count is deferred — D20-7) running in the existing `ci.yml` Postgres lane (doc 20 §5/§7); (3) **audit pass** — regression assertions that lock the already-shipped doc 19 controls (throttle tiers, RFC 7807, redaction, trust-proxy IP, health) plus the one evidenced fix, the doc 19 §5 body limit (AD-7). The only contract change is the additive `archivedAt` field → minor `openapi.json` bump (D10-1). Backup workflow is deferred (D23-5 superseded by D23-12; freeze-blocked, D23-18).

## Technical Context

**Language/Version**: TypeScript 5.7 strict (no `any`), Node (`.nvmrc`). **Framework**: NestJS 11 + Prisma 6.19 + PostgreSQL 16. **Storage**: existing `contact_messages` + **one additive nullable column** (`archived_at`) via a new Prisma migration. **Testing**: Jest unit (Prisma mocked) beside sources + supertest e2e in `test/` against `eslammuatamed_test`; a new latency-smoke e2e in the same lane. **Target**: Contabo Ubuntu-24 VPS (single instance, no Docker) → in-process cron (D07-3) + in-memory throttler storage are correct. **Project Type**: modular-monolith REST API (`/api/v1`). **Performance/Constraints**: `contract:export` DB-free; latency smoke must be deterministic (warmup + query-count) and not trip the public throttle. **Scale/Scope**: single operator; **no new module** — additive edits to `contact`, a new scheduler, one migration, one e2e spec, `ci.yml`, and regression specs.

## Constitution Check

*GATE — evaluated against `.specify/memory/constitution.md`. All pass; no Complexity-Tracking entries.*

- **Repo independence (rule 1):** no code/types shared with web; only channel is the additive `openapi.json`. ✅
- **Detachable modules (rule 2):** the purge lives inside `contact` (its own scheduler provider); no cross-module reach; `common/` unchanged except optionally a shared retention constant. ✅
- **Layering (rule 3, D07-2):** the scheduler is a thin `@Cron` wrapper delegating to `ContactService`; service owns the delete + transition logic; `PrismaService` direct. ✅
- **Contract discipline (rule 4):** `archivedAt` carries `@nestjs/swagger` + validation; `contract:export` stays DB-free. ✅
- **Security defaults (rule 5, doc 19):** purge logs no PII; retention honours §6; the audit *strengthens* (never weakens) §4/§6/§9 controls; no test-only production branch. ✅
- **Locale semantics (rule 6):** unaffected (messages are locale-agnostic). ✅
- **Readable/teachable (rule 7):** strict TS, decision-ID comments only where load-bearing (D07-3 cron, D09-14 column, D19-10 retention, D20-7 smoke). ✅
- **Tests (rule 8):** the trust-critical paths here (PII deletion; latency/N+1 guard; tier 429s) never merge untested — unit + e2e per the spec matrices. ✅
- **Official docs over habit (rule 9):** `@nestjs/schedule` `@Cron` + `@nestjs/throttler` extension points from current docs (load `nestjs-mentor`); Prisma `deleteMany` with a date filter. ✅

## Bindings (decision IDs are law)

- **Retention column:** doc 09 **+D09-14** (additive nullable `archivedAt`). **Retention behaviour:** doc 19 §6 **+D19-10** (scheduled hard-delete keyed on `archivedAt`, in-process single-instance D07-3, no PII in logs). **Latency smoke:** doc 20 §5/§7 **+D20-7** (coarse p95 + query-count, not a load test). **Contract:** doc 10 D10-1 (additive), D10-9/RFC 7807, 429+Retry-After. **Throttle tiers:** doc 19 §6 (verify). **Trust-proxy:** doc 19 §11. **Testing:** doc 18 §2/§7. **Doc-first:** principle 1 / doc 16 §3. **Freeze:** D17-5 / D23-18. **Backup deferral:** D23-12 (supersedes D23-5) + D23-18.

## Decision — Retention: `archivedAt` + scheduled purge (D09-14, D19-10)

- **Schema (D09-14):** `ContactMessage.archivedAt DateTime? @map("archived_at")`. Additive, nullable — existing rows and the existing intake path are unaffected (new messages have `archivedAt = null`). New Prisma migration `add_contact_message_archived_at` (additive `ALTER TABLE … ADD COLUMN archived_at TIMESTAMP NULL`); applied on `eslammuatamed_test` + dev, **production deferred under the freeze**. No new index (small table; the daily purge full-scan is negligible — principle 15).
- **Archive-transition logic:** in the existing `PATCH /admin/messages/{id}` path (`ContactService.update` / `messages.admin.controller.ts`), when the incoming `isArchived` transitions the stored value:
  - `false → true` ⇒ set `archivedAt = new Date()`.
  - `true → false` ⇒ set `archivedAt = null`.
  - unchanged ⇒ leave `archivedAt` as-is.
  Implemented by reading the current row (already loaded for the update) and computing the `archivedAt` field in the `data` payload only when `isArchived` is present and differs. Keeps the controller thin (logic in the service).
- **Purge job (D19-10):** `src/modules/contact/contact-purge.scheduler.ts` — a `@Injectable` `ContactPurgeScheduler` with a `Logger`, constructor-injecting `ContactService`, and `@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT) async purgeArchived()` that computes `cutoff = now − RETENTION_MONTHS` (12) and calls `ContactService.purgeArchivedOlderThan(cutoff)`; logs `Purged N archived contact message(s) older than 12 months.` only when `N > 0` (mirrors `articles.scheduler.ts`). `@nestjs/schedule` auto-wraps `@Cron` handlers in try/catch, so a transient DB error is logged and retried next tick (D07-3). Registered as a provider on `ContactModule` (ScheduleModule discovers it, as with `ArticlesScheduler`).
- **Service method:** `ContactService.purgeArchivedOlderThan(cutoff: Date): Promise<number>` → `this.prisma.contactMessage.deleteMany({ where: { isArchived: true, archivedAt: { not: null, lt: cutoff } } })` returning `result.count`. Pure, unit-testable (Prisma mocked): asserts the exact `where` (isArchived + archivedAt lt cutoff), returns the count.
- **Retention constant:** `RETENTION_MONTHS = 12` (doc 19 §6) as a named const near the scheduler; the cutoff is computed with date arithmetic (12 months back) — implemented via a small helper so the boundary is unit-tested (13mo → purged, 11mo → retained, exactly-12mo → retained, strict `<`).

## Decision — NFR-006 latency smoke (D20-7)

- **Placement:** a dedicated e2e spec `test/latency.e2e-spec.ts` (or a `test:e2e:latency` script) that boots its own Nest app (fresh in-memory throttle bucket) against the migrated + seeded `eslammuatamed_test`. Runs in `ci.yml`'s existing `e2e` job as an added step (Postgres + seed already present).
- **Measurement (coarse p95):** for each sampled public read endpoint (`GET /api/v1/health` liveness, `GET /api/v1/articles`, `GET /api/v1/projects`, plus one detail read) — a **warmup pass** (a few requests, discarded, absorbs cold-start/JIT), then **N steady-state samples** (bounded so total requests stay < the public 120/min tier per app instance — e.g. warmup 5 + 30 measured per endpoint). Compute p95 = the 95th-percentile latency across steady-state samples; assert `p95 < LATENCY_SMOKE_P95_MS`. **Budget:** env-overridable `LATENCY_SMOKE_P95_MS`, **generous default (e.g. 400–500 ms)** — a regression tripwire, explicitly **not** the literal 200 ms prod SLO on shared CI hardware (doc 20 §5 "coarse guard, not a load test"; rationale recorded in D20-7). Every sampled response asserted 2xx.
- **Deterministic anti-N+1 (doc 20 §7) — deferred (D20-7).** The advisor-recommended per-request query-count gate was **not** shipped: the app's `PrismaService` is constructed without query-event logging, so counting the app's queries would require either a production change (adding `log:['query']`) or a heavy test-only override, and the current seed has **no multi-row relational public read** to make an N+1 count meaningful (locales are 2 rows without relations; articles/projects lists are empty). N+1 remains prevented **structurally** and caught **at review** (doc 20 §7); the coarse p95 additionally trips on a gross blow-up. Recorded as a future enhancement once seeded relational fixtures exist.
- **Throttle interaction:** the smoke's bounded sample volume (warmup 3 + 12 samples × 4 paths = 72 requests) in its own app instance stays under the public tier (120/min) — **no throttle-config change** (AD-3). If a larger sample is ever wanted, `LATENCY_SMOKE_P95_MS` and sample counts are env-tunable without touching production throttle config.
- **CI wiring:** `test/latency.e2e-spec.ts` is a standard `.e2e-spec.ts`, so `npm run test:e2e` (the CI `e2e` job) already runs it — **no ci.yml change needed**.

## Decision — Audit pass: verify + regression-lock (US3, no rewrite)

The controls below are **already shipped** (evidence in the spec/§Problem). F005 adds the assertion that fails if each is weakened; where an equivalent assertion already exists, the audit **records it** rather than duplicating:

- **Throttle tiers (doc 19 §6):** add an e2e that exceeds the **login** tier (>5/15 min) → `429` + `Retry-After` (the highest-value tier to lock; auth is the credential-stuffing surface). Confirm existing coverage for the admin/public tiers and the media/contact route-local guards (F003/F004 specs already assert these) — reference, don't duplicate.
- **Trust-proxy IP (doc 19 §11):** a unit assertion that the throttler's IP resolution (the `getTracker`/trusted-IP path shared with `upload-user-ip-throttler.guard.ts`) returns the proxy-resolved client IP under `trust proxy`, not a spoofable header — so per-IP tiers key correctly behind Caddy.
- **RFC 7807 (doc 19 §4 / doc 10 §9):** assert an induced 5xx renders `application/problem+json` with **no internal detail** (stack/driver message) leaked — locks `all-exceptions.filter.ts` sanitisation.
- **Redaction (doc 07 §5, D07-5):** assert `pino-logger.config.ts` redacts/masks `authorization`, `cookie`, and `?token=` (the F004 `maskUrlToken` path) — a unit assertion over the serializer/redact config.
- **Health (doc 10 §9):** assert liveness returns **without** a DB round-trip and readiness reflects DB reachability.
- **Body-size limit (doc 19 §5, AD-7) — evidenced gap:** `main.ts` sets no JSON body limit → the framework default (~100 kB) is stricter than the documented 1 MiB. Verify empirically (an e2e POST of a body >100 kB and <1 MiB must not 413); if confirmed, set `app.use(express.json({ limit: '1mb' }))` + `express.urlencoded({ extended: true, limit: '1mb' })` in bootstrap (or the Nest `bodyParser` option) so the documented 1 MiB is enforced, and assert a >1 MiB body → 413. Multipart (`ParseFilePipe`, media 10 MiB) is a separate parser — unaffected. This is the one audit item that changes production code, and it *aligns* the implementation to an already-approved doc value (no doc amendment needed).

**Fix only an evidenced defect.** No defect is assumed; the security + code reviews (Phase 5, separate lane) may surface one, which then becomes a scoped fix + regression test. If a reviewer proposes a control *change* without a doc/requirement basis, it is rejected with recorded rationale (authorization).

## Module build order

`doc-first (docs 09 +D09-14, 19 +D19-10, 20 +D20-7 + feature-map correction) [T1 gate]` →
`migration: ContactMessage.archivedAt (additive, nullable)` →
`archive-transition logic in ContactService.update + unit tests` →
`ContactService.purgeArchivedOlderThan + ContactPurgeScheduler + unit tests` →
`archivedAt on ContactMessageEntity + Swagger + contract:export (additive)` →
`NFR-006 latency smoke (test/latency.e2e-spec.ts) + ci.yml wiring` →
`audit regression coverage (login-tier 429, trust-proxy IP, RFC 7807 5xx, redaction, health)` →
`e2e for purge + transition (contact.e2e / messages.e2e)` →
`integration verification (all gates DB-free + e2e on eslammuatamed_test)`.

## Structure (doc 08 §2)

**New files:**
- `prisma/migrations/<ts>_add_contact_message_archived_at/migration.sql` — additive `ADD COLUMN archived_at TIMESTAMP` (generated by `prisma migrate dev --create-only`, reviewed).
- `src/modules/contact/contact-purge.scheduler.ts` (+ `contact-purge.scheduler.spec.ts`).
- `test/latency.e2e-spec.ts` (NFR-006 smoke) + a `test:e2e:latency` script (or a tagged run).
- Audit regression specs (some added to existing e2e files; a `test/hardening.e2e-spec.ts` for the login-tier 429 + RFC 7807 5xx if not already covered).

**Additive edits to existing files:**
- `prisma/schema.prisma` (+`archivedAt` on `ContactMessage`).
- `src/modules/contact/contact.service.ts` (+`purgeArchivedOlderThan`; archive-transition sets/clears `archivedAt` in `update`).
- `src/modules/contact/contact.module.ts` (+`ContactPurgeScheduler` provider).
- `src/modules/contact/entities/contact-message.entity.ts` (+`archivedAt` nullable ISO, `@ApiProperty`).
- `src/modules/contact/dto/update-message.dto.ts` — unchanged (still `{isRead?, isArchived?}`; `archivedAt` is server-managed, never client-set).
- `src/main.ts` (+ explicit 1 MiB JSON/urlencoded body limit — AD-7, doc 19 §5; empirical check confirmed the default is stricter) + `test/utils/e2e-app.ts` mirrors it so e2e exercises the real limit.
- **No `.github/workflows/ci.yml` change** — the latency smoke is a `.e2e-spec.ts` already run by the `e2e` job's `npm run test:e2e`; `LATENCY_SMOKE_P95_MS` is read test-locally with a generous default (owner can override in CI later).
- `src/contract/openapi.config.ts` — unchanged tags; re-export `openapi.json` (additive `archivedAt`).
- `test/` — purge/transition assertions in the contact/messages e2e; latency smoke.

**Config:** optionally surface `LATENCY_SMOKE_P95_MS` as a **test-only** env read directly in the smoke spec (not a boot-validated app config — it is a CI knob, not runtime behaviour), so `env.validation.ts` / `.env.example` need no change. (If a boot config is preferred by review, revisit — but keeping it test-local is smaller and avoids adding a production env var for a test budget.)

**No changes:** auth/cookies/CORS/helmet/health/logging **code** (verified correct; only tests added), `permissions.ts`, other modules.

## Cross-repo & doc-first sequencing

1. **Docs repo first (T1 gate, principle 1):** on a docs feature branch off `main` @ `7a790a6` — **doc 09** (+D09-14, §3 `ContactMessage` gains `archivedAt`, version bump), **doc 19** (+D19-10, §6 concretises the retention purge; version bump), **doc 20** (+D20-7, §5 concretises the latency smoke as a coarse warmup p95 tripwire — query-count deferred; version bump), and the **feature-map** 005 row correction (backup → D23-12 deferred under D23-18; status → in-progress/dev). Decision-log entries + version bumps. Committed **before** any API code.
2. **API repo:** the build order above, on `feature/005-api-hardening` off `dev` @ `c1493a1`.
3. **Contract adoption:** the `archivedAt` field is additive; the web repo adopts during M3 dashboard (doc 16 §3) — **not** part of this API feature. No Web change now.

## Complexity Tracking

*No constitution violations — table intentionally empty.* The two judgment calls both choose the doc-faithful, lower-risk option: `archivedAt` column over an `updatedAt` proxy (correctness of a PII-retention control > migration-avoidance — AD-1), and a coarse p95 + deterministic query-count over a flaky literal-200 ms assertion or a load test (AD-3). The backup deferral (AD-5) avoids untested prod-credential automation.

## Verification

Lint + typecheck + unit pass with **no database** (`contract:export` DB-free + idempotent; Prisma + `AppConfigService` mocked in unit). E2e + `migrate deploy` (no destructive reset) + `db:seed` on `eslammuatamed_test`: purge deletes 13-month-archived rows and retains 11-month / unarchived / un-archived rows; the archive-transition sets/clears `archivedAt` via `PATCH`; the NFR-006 smoke passes (coarse p95 + bounded query-count, warmup-discarded, no 429); login-tier 429+Retry-After; RFC 7807 5xx sanitisation; redaction of authorization/cookie/`?token=`; health liveness DB-free + readiness. `openapi.json` re-exported **additively** (0 removed paths/schemas/props; only `archivedAt` added — D10-1). Final: `npm run lint && npx tsc --noEmit && npm test && npm run contract:export` green with no DB; `git diff --check` clean; `.env` byte-identical (sha256 `7948a1841945…`, mode 600, untracked). Verification/review is a **separate lane** (verifier / security-reviewer / code-reviewer), never self-approval in the authoring context.
