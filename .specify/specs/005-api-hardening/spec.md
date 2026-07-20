# Feature 005 — API Hardening (throttle-tier verification, retention purge, NFR-006 latency smoke)

**Feature Branch:** `feature/005-api-hardening` (git) · spec dir `005-api-hardening`
**Milestone:** M2→M5 (doc 24). **Status:** 📝 **Planned** — scope defined autonomously 2026-07-20 under the owner's Feature-005 autonomous-execution authorization. Base API `dev` @ `c1493a1`. **API-only** (no Web implementation; central Docs doc-first amendments only).
**Base:** API `dev` @ `c1493a1` (F004 merged). **Release Freeze active** (D17-5 / D23-18) — this feature flows `feature → PR → dev` only; **no `dev→main`, no deploy**.
**Governing docs:** 00 (principles 5/13/15/16), 02 §7 (NFR-005/006, FR-PUB-051), 07 §3/§5 (D07-3/5), 09 §3/§5 (`ContactMessage`), 10 §1/§9 (D10-1 additive, RFC 7807, 429+Retry-After), 15, 16 §3/§5.1 (D16-8), 17 (D17-5), 18 §2/§7, 19 §4/§6/§11 (throttle tiers, retention, trust-proxy), 20 §5/§7 (NFR-006 smoke, N+1), 23 §4 (D23-12 backups, D23-18 freeze).
**Requirements carried:** NFR-005 (doc-19 controls), **NFR-006** (API p95 < 200 ms public reads), doc 19 §6 **retention** ("inbox entries are purged 12 months after archival"), doc 19 §6 **throttle tiers** (verify), doc 20 §5 **API-PR latency smoke**.

---

## Problem

Feature 005 ("api-hardening", feature-map row 005) is the milestone's consolidation feature. Its feature-map scope line reads *"Full throttle tiers, audit pass, backup workflow (D23-5), latency smoke (NFR-006)"* plus the **12-month archived-message purge** that Feature 004 explicitly deferred here (F004 spec §"Out of scope"; feature-map).

A first-hand audit of API `dev` @ `c1493a1` (recorded in the plan) shows the hardening surface is **already substantially built** across F001/F003/F004 and only **two behaviours are genuinely missing**, while one feature-map item is **out of this feature's safe scope** under the Release Freeze:

1. **Retention purge — MISSING.** doc 19 §6 promises *"inbox entries are purged 12 months after archival"*, but no such job exists (`ScheduleModule` is wired and `articles.scheduler.ts` promotes scheduled articles, yet nothing purges `contact_messages`). Contact messages hold visitor PII (`name`, `email`, `subject`, `body`); keeping them forever contradicts the documented retention promise and minimises no data (doc 19 §10 "no at-rest encryption **because** messages are name/email/message" assumes bounded retention).
2. **NFR-006 latency smoke — MISSING.** doc 20 §5 requires *"a p95 latency smoke on the e2e suite (coarse guard for NFR-006 regressions, not a load test)"* on API PRs. No latency/p95 check exists in `ci.yml` or `test/`. NFR-006 (p95 < 200 ms public reads) is therefore unguarded against regressions (e.g. an accidental N+1, doc 20 §7).
3. **Throttle tiers + transport/error/logging controls — ALREADY IMPLEMENTED.** Every doc 19 §6 tier is defined in `throttle-tiers.ts` and wired (global `ThrottlerGuard` = public 120/min; `@Throttle(admin 300/min)` on all admin controllers; `@Throttle(login 5/15min, refresh 30/hr)` on auth; route-local media + contact guards). `main.ts` has helmet, `trust proxy`, CORS-with-credentials, `enableShutdownHooks`; the health module exposes liveness + readiness; `all-exceptions.filter.ts` renders RFC 7807; nestjs-pino redacts tokens/cookies/passwords and stamps request IDs. Per the authorization ("if an item is already correctly implemented, verify and cover it instead of rewriting it") these are **verified and regression-locked**, not rewritten.
4. **Backup workflow — DEFERRED (out of safe scope).** The feature-map cites *"backup workflow (D23-5)"*, but **D23-5 is superseded by D23-12**: backups are now a **nightly VPS host `pg_dump` cron + a weekly offsite copy to a private production R2 bucket**. That is host/ops + production-secret work; enabling it requires production R2 credentials, VPS access, and activating an external service — all blocked by the hard boundaries and the Release Freeze (D23-18). It is recorded as a **launch/ops deferral**, not implemented here (see §Deferred).

Feature 005 therefore ships the **two missing behaviours** over the existing schema/config, **verifies + regression-covers** the already-shipped hardening, and **records the deferrals** — the "smallest complete" reading of api-hardening (principle 15), not a rewrite.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Visitor PII is purged on a defensible retention schedule (Priority: P1)

The operator archives a contact message in the inbox. Twelve months after that archival, the platform automatically hard-deletes the message so visitor PII is not retained indefinitely, honouring doc 19 §6. A message that is un-archived before the deadline is spared; an active (unarchived) message is never purged.

**Why this priority**: It is the one behaviour that touches user data and a written privacy/retention promise (doc 19 §6/§10). It is independently valuable and testable with no dependency on the other stories.

**Independent Test**: Seed a message archived 13 months ago → the purge job deletes it; a message archived 11 months ago → retained; an unarchived message of any age → retained; a message archived then un-archived → retained (its archival clock is cleared).

**Acceptance Scenarios**:

1. **Given** a `ContactMessage` with `isArchived = true` and `archivedAt` 12 months + 1 day in the past, **When** the purge job runs, **Then** the row is hard-deleted and the deletion count is logged (no PII in the log line).
2. **Given** a `ContactMessage` archived less than 12 months ago, **When** the purge job runs, **Then** it is retained.
3. **Given** a `ContactMessage` with `isArchived = false` (never archived, or un-archived), **When** the purge job runs, **Then** it is retained regardless of age (`archivedAt` is null).
4. **Given** the operator archives a message via `PATCH /admin/messages/{id}` (`isArchived` false→true), **Then** `archivedAt` is set to that instant; **and given** they later un-archive it (true→false), **Then** `archivedAt` is cleared to null.
5. **Given** the purge runs on a single API instance (D07-3), **When** a transient DB error occurs mid-run, **Then** it is logged and retried on the next scheduled tick rather than crashing the process (matching `articles.scheduler.ts`).

### User Story 2 — Latency regressions are caught before merge (Priority: P2)

A change that regresses public-read latency (e.g. an accidental N+1 query) is flagged by the API PR pipeline before it reaches `dev`, realising the doc 20 §5 coarse NFR-006 guard without a load test.

**Why this priority**: Protects NFR-006 (a signed product NFR) cheaply and deterministically. Depends on the existing e2e Postgres lane but is independently testable.

**Independent Test**: Run the latency smoke against the seeded test DB — public read endpoints return within a coarse p95 budget after warmup, and a representative public list endpoint issues a bounded number of DB queries (no N+1).

**Acceptance Scenarios**:

1. **Given** the migrated + seeded `eslammuatamed_test` DB, **When** the latency smoke exercises the public read endpoints with a warmup pass discarded, **Then** the measured p95 is below a coarse, documented budget and every sampled response is 2xx.
2. **Given** a representative public list endpoint (e.g. articles list), **When** the smoke asserts the DB query count for one request, **Then** it is within a fixed ceiling (deterministic anti-N+1 guard, doc 20 §7) — a loop-of-queries regression fails the check.
3. **Given** the smoke runs on shared CI hardware, **When** normal jitter occurs, **Then** it does not spuriously fail (generous budget + warmup) — it is a regression tripwire, not the literal 200 ms SLO on CI hardware.
4. **Given** the API PR pipeline, **When** it runs, **Then** the latency smoke executes in the Postgres e2e lane and its result gates the PR.

### User Story 3 — Shipped security controls are verified and regression-locked (Priority: P3)

The security/hardening controls already shipped (throttle tiers, transport headers, cookie flags, RFC 7807, redaction, trust-proxy, graceful shutdown, health) are proven correct by tests so a future change cannot silently weaken them.

**Why this priority**: Turns the "audit pass" from a one-time read into durable regression coverage, without rewriting working code. Least load-bearing of the three but closes the audit.

**Independent Test**: The throttle tiers, RFC 7807 shape, redaction, and health/readiness each have an assertion that fails if the control is removed or weakened.

**Acceptance Scenarios**:

1. **Given** the doc 19 §6 tiers, **When** the auth login tier is exceeded (>5 in 15 min) in e2e, **Then** `429` + `Retry-After` is returned (regression-locks the login tier); the admin and public tiers are covered by existing/added assertions.
2. **Given** the throttler runs behind `trust proxy` (production), **When** the client IP is read, **Then** it is the proxy-resolved client IP, not a spoofable header (verified) — so per-IP tiers key correctly (doc 19 §11).
3. **Given** an unhandled error, **When** any endpoint 5xx-es, **Then** the response is RFC 7807 `application/problem+json` with **no internal detail leaked** (verified).
4. **Given** a request carrying an `authorization` header / `cookie` / `?token=`, **When** it is logged, **Then** those values are redacted/masked (verified against `pino-logger.config.ts`).
5. **Given** `GET /api/v1/health` (liveness) and the readiness probe, **When** called, **Then** liveness returns without touching the DB and readiness reflects DB reachability.

### Edge cases

- Purge boundary at exactly 12 months (cutoff is `now − 12 months`; a row exactly at the boundary is retained — strict `<`).
- Purge with zero eligible rows → no-op, no error, minimal/no log noise (mirror `articles.scheduler.ts` "log only when count > 0").
- Un-archive after the deadline has passed but before the next purge tick → cleared `archivedAt` spares it.
- Latency smoke when the DB is cold (first query slow) → warmup pass absorbs cold start; only steady-state samples are scored.
- Latency smoke sample volume stays under the public 120/min throttle within its own app instance (bounded N + fresh in-memory bucket) — no throttle-config change needed.

## Scope (what ships)

1. **`archivedAt` retention column (doc 09 +D09-14) [doc-first + additive migration].** Add nullable `archivedAt DateTime?` (`@map("archived_at")`) to `ContactMessage`. Set to `now()` when `PATCH /admin/messages/{id}` flips `isArchived` false→true; cleared to `null` on true→false. Additive, backward-compatible; production migration defers under the freeze (applied on the eventual unfreeze release, like all F004+ dev-pending schema — but F004 had none, so this is the first dev-pending migration). Exposed additively on the admin `ContactMessageEntity` (nullable ISO string). **No new index** — the table is small and the purge is infrequent (principle 15); documented.
2. **Retention purge job (doc 19 §6 +D19-10).** A `ContactPurgeScheduler` (`@Cron`, in-process, single-instance D07-3 — the `articles.scheduler.ts` pattern) that calls a new `ContactService.purgeArchivedOlderThan(cutoff)` which hard-deletes `contact_messages WHERE isArchived = true AND archivedAt IS NOT NULL AND archivedAt < now() − 12 months`. Logs the deleted count only (no PII). Cadence: **daily** (`CronExpression.EVERY_DAY_AT_MIDNIGHT`) — frequent enough for a 12-month window, cheap on a small table. The 12-month window is a named constant.
3. **NFR-006 latency smoke (doc 20 §5 +D20-7).** A `test/latency.e2e-spec.ts` run in the Postgres e2e lane: warms up, then samples public read endpoints and asserts p95 < a **coarse, env-overridable budget** (`LATENCY_SMOKE_P95_MS`, generous default as a regression tripwire — **not** the literal 200 ms prod SLO on CI hardware), **plus** a deterministic **bounded-query-count** assertion on a representative public list endpoint (anti-N+1, doc 20 §7) using Prisma query-event counting. Wired as a step in `ci.yml`'s `e2e` job (its own `npm run test:e2e:latency` or a tagged spec).
4. **Throttle-tier + control regression coverage (doc 19 §6/§11 — verify, US3).** Add the missing regression assertions that lock the already-shipped controls: an auth-login-tier 429+Retry-After e2e (the tier most worth locking); confirm/one-line-cover admin + public tiers; a trust-proxy client-IP unit assertion for the throttler tracker; RFC 7807 5xx sanitisation assertion; redaction assertion for authorization/cookie/`?token=`; health liveness (DB-free) + readiness assertions. **Only genuine gaps become code changes**; where a control is already covered, the audit records the existing test rather than duplicating it.
5. **Body-size limit alignment (doc 19 §5 — evidenced gap fix, AD-7).** `main.ts` configures no JSON body limit, so the effective limit is the framework default (~100 kB), but doc 19 §5 specifies **1 MiB JSON** (sized to hold the 256 KiB markdown fields). Verify empirically (a body >100 kB and <1 MiB must not 413 today), and if the default is confirmed, set the explicit documented limit `express.json({ limit: '1mb' })` (+ matching urlencoded) in bootstrap — a documented, additive hardening-config correction. Multipart/upload (media 10 MiB via `ParseFilePipe`) is a separate parser, unaffected.
6. **Contract + quality rails.** The only contract change is the additive `archivedAt` field on the admin `ContactMessageEntity` → `openapi.json` re-exported **additively** (minor bump, D10-1, no `/api/v2`); `contract:export` stays DB-free + idempotent. Every touched DTO/entity keeps exhaustive `@nestjs/swagger` + `class-validator` decorators. No new runtime dependency (`@nestjs/schedule` + `@nestjs/throttler` already present).

## Functional requirements

- **FR-005-01** — `ContactMessage` gains a nullable `archivedAt`; it is set to the current instant when a message is archived (`isArchived` false→true) and cleared when un-archived (true→false), via `PATCH /admin/messages/{id}`. (doc 09 D09-14)
- **FR-005-02** — A scheduled in-process job hard-deletes archived messages whose `archivedAt` is more than 12 months in the past; unarchived messages and messages archived ≤ 12 months ago are retained. (doc 19 §6, D19-10)
- **FR-005-03** — The purge logs only the deleted **count** (no name/email/subject/body); a transient DB error is logged and retried on the next tick, never crashing the process. (doc 07 §5, D07-5)
- **FR-005-04** — The API PR pipeline runs a coarse p95 latency smoke over public read endpoints (warmup discarded) asserting p95 below a documented, env-overridable budget, and a deterministic bounded-query-count anti-N+1 check on a representative public list endpoint. (doc 20 §5/§7, NFR-006, D20-7)
- **FR-005-05** — The latency smoke is a regression tripwire that does not spuriously fail on CI jitter, and does not require relaxing production throttle configuration (bounded sample volume within its own app instance). (doc 18 §7)
- **FR-005-06** — The doc 19 §6 throttle tiers are regression-locked: exceeding the login tier returns `429` + `Retry-After`; the throttler keys on the proxy-resolved client IP under `trust proxy`. (doc 19 §6/§11)
- **FR-005-07** — Shipped hardening controls are asserted: RFC 7807 `application/problem+json` on 5xx with no internal leak; redaction of `authorization`/`cookie`/`?token=` in logs; health liveness (DB-free) + readiness (DB-reflecting). (doc 19 §4, doc 07 §5, doc 10 §9)
- **FR-005-08** — The only contract change is the additive `archivedAt` field; `openapi.json` re-exports additively (0 removed paths/schemas/props) and `contract:export` runs DB-free + idempotently. (doc 10 §1, doc 16 §3, D10-1)
- **FR-005-09** — The JSON request-body size limit is enforced at the documented **1 MiB** (doc 19 §5), not the framework default; a request body >1 MiB is rejected (413), while a valid body between the old default and 1 MiB is accepted. Multipart uploads keep their own 10 MiB cap (D19-9). (doc 19 §5, AD-7)

## Key entities (existing schema — one additive column)

- **`ContactMessage`** (`contact_messages`): existing `id`, `name`, `email`, `subject`, `body`, `isRead`, `isArchived`, `meta`, `createdAt`, `updatedAt`; **+ `archivedAt DateTime?` (`archived_at`, new — D09-14)**. Retention basis for the purge; set/cleared on the archive transition. Existing index `@@index([isArchived, isRead, createdAt])` unchanged (no new index — small table, infrequent job).
- **Preview token / redirects / other entities** — unchanged (F005 does not touch them).

## Autonomous decisions (2026-07-20 — recorded per the authorization; alternatives + rationale)

- **AD-1 — Retention basis = a dedicated `archivedAt` column, not `updatedAt`.** doc 19 §6 says "12 months **after archival**"; a dedicated archival instant is the precise, auditable, testable basis for a PII-deletion control (priorities: user-data protection, correctness). **Alternative rejected:** reuse `updatedAt` (no migration) — but `@updatedAt` means "last modification" (an `isRead` toggle or un/re-archive moves it), so it silently redefines the retention key and diverges from the approved doc. The additive nullable column is backward-compatible and defers cleanly under the freeze. *Subject to security-review confirmation (Phase 5).*
- **AD-2 — Purge is a hard delete, single-instance in-process cron, daily.** Matches D07-3 (`articles.scheduler.ts`) and doc 19 §10 (minimise retained PII — soft-delete/cold-storage would keep the PII the retention rule exists to remove). **Alternatives rejected:** soft-delete flag (retains PII, defeats the purpose); external cron/host job (adds ops surface, the in-process pattern already exists); hourly (needless churn for a 12-month window).
- **AD-3 — Latency smoke = coarse p95 (generous, warmup-discarded) + deterministic query-count, in the e2e lane.** doc 20 §5 says "coarse guard … not a load test"; a literal 200 ms wall-clock assertion is flaky on shared CI runners, so the wall-clock budget is a generous regression tripwire and the *deterministic* value comes from the bounded-query-count (N+1) check (doc 20 §7). **Alternatives rejected:** literal 200 ms CI assertion (flaky); a real load test (doc 18 §7 "monitored, not load-simulated"); throttle-config relaxation for the smoke (unneeded — bounded samples stay under 120/min in a fresh app instance).
- **AD-4 — Throttler storage stays in-memory.** Single API instance on one VPS (D23-10); a shared store (Redis) contradicts the no-caching-layer / operational-simplicity stance (doc 20 §7, principle 15). Recorded so a reviewer does not flag the in-memory default as a gap.
- **AD-5 — Backup workflow deferred (not implemented).** D23-5 is superseded by D23-12 (VPS host cron + weekly R2 offsite); enabling it needs production R2 secrets + VPS + external-service activation, all blocked by the hard boundaries + Release Freeze (D23-18). Recorded as a launch/ops deferral citing D23-12 + D23-18; the feature-map row is corrected. **Alternative rejected:** author an inert `backup.yml` GitHub Action now — it would hard-code production R2 secret/bucket assumptions the owner must make at launch and could not be tested without R2 (untested prod-credential automation), contradicting reversible-over-irreversible and smallest-complete.
- **AD-6 — No new throttle tiers or middleware.** All doc 19 §6 tiers already exist and are wired; F005 adds regression coverage, not new tiers (authorization: "verify and cover, don't rewrite").
- **AD-7 — Enforce the documented 1 MiB JSON body limit.** `main.ts` sets no body limit → the framework default (~100 kB) is stricter than doc 19 §5's stated **1 MiB** and would 413 a valid large article (256 KiB markdown fields, doc 19 §5). Aligning the implementation to the approved doc is the correct hardening (a bounded, *documented* limit). **Alternatives rejected:** leave the implicit 100 kB (diverges from doc 19 §5; latent 413 on large valid content); pick a different number (the doc already fixed 1 MiB). Verified empirically before changing; multipart uploads unaffected (separate parser). *Surfaced by the Phase-1 audit; confirmed via security review (Phase 5).*

## Assumptions

- `@nestjs/schedule` and `@nestjs/throttler` are already present and wired (verified) — F005 adds **no** runtime dependency.
- The additive `archivedAt` migration applies to `eslammuatamed_test` (e2e) and dev; the **production** migration is part of the eventual unfreeze release (deferred, not run here).
- The e2e latency smoke runs against the already-provisioned Postgres service + seed in `ci.yml`; its sample volume stays under the public throttle tier by design.
- Existing controls (helmet, CORS, cookies, shutdown, health, RFC 7807, redaction) are correct as shipped; the audit adds coverage and fixes only an **evidenced** defect (none assumed a priori; the security/code reviews may surface one).
- No Web change is required (the `archivedAt` field is an admin-only additive read the dashboard is not yet built to consume; M3 dashboard adopts later per doc 16 §3).

## Out of scope / Deferred

- **Backup workflow (D23-12, supersedes D23-5)** — VPS host `pg_dump` cron + weekly R2 offsite. **Deferred to launch/ops** under the Release Freeze (D23-18) + hard boundaries (production R2 secret / external-service activation). Feature-map row corrected accordingly. → "Pending Website/Homepage release-unfreeze production verification".
- **Production cookie-auth verification** (doc 19 §11, roadmap M5 gate) — needs the production domain + deploy. → deferred (freeze).
- **Playwright post-deploy smoke** (doc 23 §5 / D18-3) and **`openapi.json` release-artifact attachment** (doc 17 §4) — release-time concerns; existing backlog, not api-hardening code. → deferred.
- **GHA Node20 deprecation** (`actions/checkout@v4`, `actions/setup-node@v4`, `upload-artifact@v4` → `@v5`) — a separate maintenance chore (kept out to avoid mixing an unrelated CI bump into the security feature).
- **`storage/` gitignore hygiene** (F003 leftover) — separate chore.
- **New throttle tiers / caching layer / Redis / 2FA / WAF** — explicitly not needed (doc 19 §10 non-goals, doc 20 §7).

## Dependencies

- **Existing schema:** `contact_messages` (+ one additive column via a new migration).
- **Existing infra:** `ScheduleModule.forRoot()` (wired), `ThrottlerModule` + guards (wired), Postgres e2e lane in `ci.yml`, `AppConfigService` (for the latency budget env if surfaced there).
- **Doc-first prerequisite:** docs 09 (+D09-14), 19 (+D19-10), 20 (+D20-7) amendments + feature-map correction committed before API code (T1 gate, principle 1 / doc 16 §3).

## Success criteria

- **SC-001** — Archived contact messages are automatically deleted 12 months after archival; active messages are never purged; the deletion logs no PII. (retention promise met — doc 19 §6/§10)
- **SC-002** — An N+1 or gross latency regression on a public read endpoint fails the API PR pipeline before merge, without flaky failures on clean changes. (NFR-006 guarded — doc 20 §5)
- **SC-003** — The shipped doc 19 controls (throttle tiers, RFC 7807, redaction, health, trust-proxy IP) each have an assertion that fails if the control is weakened. (audit pass durable)
- **SC-004** — The API contract grows only additively (`archivedAt`); no shipped `/api/v1` behaviour changes. (D10-1)
- **SC-005** — The backup and production-only items are explicitly recorded as freeze-deferred with the exact unfreeze action, so nothing is silently dropped. (governance intact)

## Revisions

- **2026-07-20 (draft)** — Initial spec. Scope defined autonomously from the feature-map 005 row + a first-hand audit of API `dev` @ `c1493a1`: two genuine gaps (retention purge, NFR-006 latency smoke) implemented over existing schema/config; already-shipped throttle tiers + transport/error/logging controls verified and regression-locked (not rewritten); backup workflow deferred (D23-5 superseded by D23-12; freeze-blocked). Decision IDs D09-14 / D19-10 / D20-7 verified next-free against docs `main` @ `7a790a6`.
