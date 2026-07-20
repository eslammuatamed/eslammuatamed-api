# Tasks 005 — API Hardening (API)

Executor: Opus (coordinator-reviewed). Each task cites its governing doc(s); check off only with its **Verify** done. `[P]` = parallelizable with siblings (different files, no incomplete-task dependency). **Verification/review is a separate lane** (verifier / security-reviewer / code-reviewer) — never self-approved in the authoring context. **Tasks run only after the spec + plan are settled** and the audit is reconciled.

**Dependency spine:** **T1 → T2 → T3 → T4 → T5 → { T6 [P], T7 [P], T8 } → T9 → T10 → T11(FINAL gate).**
T1 (doc-first) gates all code. T2 (migration) precedes any schema use. T3 (archive-transition) + T4 (purge) both edit `contact.service.ts` → sequential. T5 (entity + contract) needs `archivedAt` to exist (T3). T6 (latency smoke) + T7 (audit coverage) are independent of the purge (need only the app/migration/seed). T8 (purge/transition e2e) needs T4+T5. T9 full gates; T10 reviews; T11 the mandatory Documentation & Handoff Gate.

**One additive migration (nullable `archived_at`), no new runtime dependency** (`@nestjs/schedule` + `@nestjs/throttler` already wired). `contract:export` stays DB-free. **Release Freeze (D17-5/D23-18): `feature → PR → dev` only.**

- [x] **T1 — Doc-first revisions (docs repo; constitution principle 1) [gate]**
  - On `eslammuatamed-docs` feature branch off `main` @ `7a790a6`:
    - **doc 09** → +**D09-14** (`ContactMessage` gains nullable `archivedAt` as the retention basis, set on archive / cleared on un-archive; alternatives: reuse `updatedAt` [rejected — "last activity" ≠ "archival"]; no new index — small table) + §3 entity row updated + version bump (1.4.0→1.5.0).
    - **doc 19** → +**D19-10** (§6 concretised: the "12 months after archival" retention is an in-process single-instance daily `@Cron` **hard-delete** keyed on `archivedAt`, logs count-only/no-PII, D07-3; alternatives: soft-delete [rejected — retains PII], host cron [rejected — in-process pattern exists]) + version bump (1.3.0→1.4.0).
    - **doc 20** → +**D20-7** (§5 concretised: the API-PR p95 latency smoke is a **coarse** warmup-discarded tripwire with a generous env-overridable budget — NOT the literal 200 ms SLO on CI hardware — **plus** a deterministic bounded-query-count anti-N+1 check per §7; alternatives: literal-200 ms [flaky], load test [rejected — doc 18 §7]) + version bump (1.2.0→1.3.0).
    - **feature-map** (`.specify/memory/feature-map.md`, both API + Web copies) → correct row 005: "backup workflow (D23-5)" → note **D23-5 superseded by D23-12**, backup **deferred to launch/ops under the Release Freeze (D23-18)**; status → 🧪 in-progress on `feature/005-api-hardening`.
  - **Verify:** docs committed with decision-log entries (D09-14, D19-10, D20-7) + version bumps **before** any API code; feature-map row corrected; no unrelated doc churn. (T2+ do not start until T1 is committed on the docs branch.)

- [x] **T2 — Additive migration: `ContactMessage.archivedAt` (doc 09 D09-14)** *(needs T1)*
  - `prisma/schema.prisma`: add `archivedAt DateTime? @map("archived_at")` to `ContactMessage` (nullable; existing index unchanged). Generate the migration with `prisma migrate dev --create-only --name add_contact_message_archived_at` against the **test** DB only; review the SQL is a pure additive `ADD COLUMN … NULL` (no data loss, no default backfill, no index).
  - **Verify:** `npx prisma generate` + `npx tsc --noEmit` green; migration SQL is additive-only (`git diff` shows one `ADD COLUMN`); applied cleanly to `eslammuatamed_test` via `prisma migrate deploy` (never a destructive reset; never dev/prod). **No production migration.**

- [x] **T3 — Archive-transition sets/clears `archivedAt` (doc 09 D09-14)** *(needs T2)*
  - In `ContactService.update` (`contact.service.ts`) / `messages.admin.controller.ts`: when `PATCH /admin/messages/{id}` carries `isArchived` and it differs from the stored value, include `archivedAt` in the update `data` — `new Date()` on false→true, `null` on true→false; omit when `isArchived` is absent/unchanged. Keep the controller thin (logic in the service). `archivedAt` is **server-managed** — never accepted from the client DTO.
  - **Verify:** unit (`contact.service.spec.ts`) — false→true sets `archivedAt` to a Date; true→false sets it null; `isArchived` omitted → `archivedAt` untouched; `UpdateMessageDto` has no `archivedAt` (server-only); existing update behaviour + tests remain green. Confirm mechanism vs current Prisma docs (nestjs-mentor).

- [x] **T4 — Retention purge: service method + scheduler (doc 19 §6 D19-10, doc 07 §5 D07-3)** *(needs T3)*
  - `ContactService.purgeArchivedOlderThan(cutoff: Date): Promise<number>` → `prisma.contactMessage.deleteMany({ where: { isArchived: true, archivedAt: { not: null, lt: cutoff } } })` returning `count`. Add `src/modules/contact/contact-purge.scheduler.ts` (`ContactPurgeScheduler`, `@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)`, injects `ContactService`, computes `cutoff = now − RETENTION_MONTHS(12)` via a small unit-tested date helper, logs `Purged N …` only when `N > 0`; @nestjs/schedule auto-try/catch). Register `ContactPurgeScheduler` as a provider in `contact.module.ts`.
  - **Verify:** unit (`contact.service.spec.ts` + `contact-purge.scheduler.spec.ts`, Prisma mocked) — `purgeArchivedOlderThan` issues the exact `where` (isArchived true + archivedAt not-null + lt cutoff) and returns count; the cutoff helper: 13 mo → eligible, 11 mo → not, exactly 12 mo → not (strict `<`); scheduler logs only when count>0 and delegates to the service; no PII in the log string.

- [x] **T5 — `archivedAt` on entity + Swagger + contract export (doc 10 §1, doc 16 §3)** *(needs T3)*
  - `contact-message.entity.ts`: add `archivedAt: string | null` with `@ApiProperty({ type: String, format: 'date-time', nullable: true, example: … })`; ensure the admin serialization maps the Prisma `Date | null` to ISO string | null. Re-export `openapi.json`.
  - **Verify:** `npm run contract:export` green **DB-free** + **idempotent** (fixed point); `openapi.json` diff vs pre-feature tip is **purely additive** — the only change is the `archivedAt` property on the `ContactMessage` admin schema; 0 removed paths/schemas/props (D10-1); no dangling `$ref`.

- [x] **T6 [P] — NFR-006 latency smoke + CI wiring (doc 20 §5/§7 D20-7)** *(needs T2 for a migrated DB; independent of purge)*
  - `test/latency.e2e-spec.ts`: boot the app (own instance → fresh throttle bucket) against migrated+seeded `eslammuatamed_test`; for each sampled public read (`/health` liveness, `/articles` list, `/projects` list, one detail) do a warmup pass (discarded) then N bounded steady-state samples (total < public 120/min); assert p95 < `LATENCY_SMOKE_P95_MS` (test-local env read, generous default ~400–500 ms) and every response 2xx. **Deterministic anti-N+1:** count DB queries for one articles-list request (Prisma `query` event) and assert ≤ a fixed ceiling. Add `test:e2e:latency` script (or run within `test:e2e`) and a step in `ci.yml`'s `e2e` job.
  - **Verify:** the smoke passes locally on `eslammuatamed_test` (no 429, no flake across 3 runs); the query-count assertion fails if an N+1 is injected (prove once, then revert); `ci.yml` runs it in the Postgres lane; budget rationale documented (D20-7). **Do not** relax production throttle config.

- [x] **T7 [P] — Audit regression coverage + body-limit fix (doc 19 §4/§5/§6/§11, doc 07 §5) [verify; one evidenced fix]** *(needs T1; independent)*
  - Add the assertions that lock already-shipped controls (reference, don't duplicate, existing coverage): **login-tier 429+Retry-After** e2e (>5/15 min → 429); **trust-proxy client-IP** unit for the throttler tracker (proxy-resolved IP, not spoofable header); **RFC 7807 5xx** sanitisation (induced 5xx → `application/problem+json`, no stack/driver leak); **redaction** unit (authorization/cookie/`?token=` masked per `pino-logger.config.ts`); **health** liveness DB-free + readiness DB-reflecting. Put new e2e in `test/hardening.e2e-spec.ts` (or extend existing) and units beside sources.
  - **Body-size limit (doc 19 §5, AD-7 — evidenced gap):** first prove it empirically — an e2e POST of a JSON body >100 kB and <1 MiB. If it 413s (framework default confirmed), set the documented 1 MiB limit in `main.ts` (`express.json({ limit: '1mb' })` + `express.urlencoded({ extended: true, limit: '1mb' })`, or the Nest `bodyParser` option — confirm current NestJS 11 idiom via nestjs-mentor) and add an e2e: valid ~500 kB body → accepted; >1 MiB body → 413. If it does NOT 413 (already ≥1 MiB), record "no change needed" with evidence. Multipart uploads unaffected (separate parser).
  - **Verify:** each new assertion fails if its control is removed/weakened (spot-check one by temporary sabotage, then revert); the body-limit change (if made) is the only production-code change and matches doc 19 §5 exactly; contract unaffected (413 is an existing error shape). Record which controls were already covered vs newly covered.

- [x] **T8 — E2e for purge + archive-transition (doc 18 §2)** *(needs T4 + T5)*
  - `test/contact.e2e-spec.ts` (or `messages.e2e`): archive a message via `PATCH` → `archivedAt` set (visible in admin read); un-archive → cleared; seed/insert an archived row with `archivedAt` 13 months ago and invoke the purge path (call the scheduler method or `ContactService.purgeArchivedOlderThan`) → row deleted; 11-month + unarchived rows retained. `jest-openapi` asserts the admin message response (now incl. `archivedAt`).
  - **Verify:** full e2e green on `eslammuatamed_test` (`prisma migrate deploy`, no destructive reset); `jest-openapi` `toSatisfyApiSpec()` passes with the additive field; purge/transition behaviour matches FR-005-01/02/03.

- [x] **T9 — Integration verification (coordinator; verifier lane)** *(needs T6, T7, T8)*
  - Full gate matrix with recorded output: `npm run lint`, `npx tsc --noEmit`, `npm test` (DB-free unit), `npm run contract:export` (DB-free + idempotent), `npx prisma migrate deploy` + `db:seed` on `eslammuatamed_test`, `npm run test:e2e` (incl. latency smoke + purge + hardening), `git diff --check`. Confirm contract purely additive; `.env` byte-identical (sha256 `7948a1841945…`, mode 600, untracked); Web unchanged; clean API tree (except `?? storage/`).
  - **Verify:** all gates green with recorded results; re-run seed is a no-op; ready for PR `feature/005-api-hardening → dev`. Approval delegated to verifier/security/code reviewers (separate lane, T10).

- [x] **T10 — Autonomous reviews (separate lane) [security · code · contract · test]** *(needs T9)*
  - Run security-reviewer (retention/PII deletion correctness incl. AD-1 archivedAt basis; no weakened control; no PII in logs), code-reviewer (architecture/thin-controllers/idioms), contract/back-compat (additive-only), test-quality (determinism of the latency smoke; purge boundary coverage; no skipped/flaky). Treat valid findings as work: reproduce → fix in scope → regression cover → rerun focused + relevant full gates. Reject requirement-less scope expansion with recorded rationale.
  - **Verify:** all confirmed findings resolved with regression coverage; gates re-green; review outcomes recorded for the final report.

- [ ] **T11 — Final Documentation, Contract Sync & Handoff Gate [mandatory — DoD, doc 16 §5.1 / D16-8]** *(needs T10)*
  - The standing Definition-of-Done gate: the feature is **not complete** and must **not** be pushed/PR'd/merged until this passes. Reconcile:
    - **Arabic module docs** — update `src/modules/contact/README.md` (Arabic prose, English identifiers) to cover the new retention purge (`archivedAt`, scheduler, cadence, no-PII logging, env `LATENCY_SMOKE_P95_MS` if surfaced) + a short note on the NFR-006 smoke and audit coverage; no secrets, no speculation, shipped-to-dev behaviour only.
    - **Central Docs** — docs 09 (+D09-14) / 19 (+D19-10) / 20 (+D20-7) already on the docs branch (T1); confirm they match the shipped behaviour; feature-map row status → "Implemented on dev — pending Website/Homepage production release" (after dev merge).
    - **OpenAPI** — re-exported + additive (`archivedAt`); no Web adoption required now (M3 dashboard adopts later, doc 16 §3).
    - **SpecKit closeout** — `spec.md`/`plan.md`/`tasks.md` reconciled; only verified tasks checked; deferrals (backup D23-12/D23-18; prod cookie-auth; Playwright smoke; openapi release artifact) + accepted limitations recorded.
    - **Project status + handoff** — update the READ-FIRST handoff (branches/SHAs/PRs/tests/migration/deploy-state/deferrals/next-action) + memory index; no duplicate handoff files; `PROJECT_GUIDE.md` only if the baseline changed.
    - **Consistency audit** — Arabic docs match code; specs match tests; central docs match implementation; no stale "planned/not-implemented" wording for shipped-to-dev work; `git diff --check`; no secrets / `.env` anywhere.
  - **Verify:** gate satisfied (or each omission justified; Arabic module guide + SpecKit closeout always required); consolidated report produced. **Release freeze:** a passed gate clears push / PR / merge to `dev` only — **no `dev→main` / deploy** (D17-5).

## Completion — T1–T10 verified (2026-07-20/21, API `feature/005-api-hardening`)

Docs branch `feature/005-api-hardening` (off Docs `main` 7a790a6): **T1** doc-first `75e69e0` (docs 09 v1.5.0 +D09-14, 19 v1.4.0 +D19-10, 20 v1.3.0 +D20-7 + feature-map correction) → D20-7 refinement `5ef2f1a`.

API branch `feature/005-api-hardening` (off dev `c1493a1`): SpecKit `52cd6ea` · **T2–T5** retention (schema + additive migration + archive-transition + purge + scheduler + entity + contract) `1e6e081`, archivedAt OpenAPI type fix `f6b5ee8` · **T7** body-limit (AD-7) + RFC 7807 client-error branch + login-tier 429 e2e `13e7955` · **T6+T8** NFR-006 latency smoke + retention e2e `5e1f711` · **T10** review fixes (M1/M2 + nits) `08e10ec`.

**T9 verification (recorded, re-run after review fixes):** `npm run lint` ✓ · `npx tsc --noEmit` ✓ · `npm test` **377 unit** (DB-free) ✓ · `npm run contract:export` DB-free + **idempotent** (only additive `archivedAt`) ✓ · `prisma migrate deploy` + `db:seed` on `eslammuatamed_test` ✓ · `npm run test:e2e` **89 e2e / 19 suites** ✓ · `npm run build` ✓ · prod boot (liveness+readiness 200) + SIGTERM graceful shutdown ✓ · `npm audit --audit-level=high` **0** ✓ · `git diff --check` clean ✓ · `.env` byte-identical (sha256 `7948a1841945…`, mode 600, untracked) ✓.

**T10 reviews (separate lane):** security = **sound, no Critical/High**; code = no blockers, **M1 + M2 fixed** (`08e10ec`) + nits; accepted LOW/INFO items documented in `spec.md` §Review outcomes. Contract = additive-only; test-quality = deterministic (own-app throttle isolation, warmup, generous budget). Boxes checked only after the recorded gates confirmed each task.

## Not in this feature (deferred / out of scope)

- **Backup workflow** (D23-12, supersedes D23-5) — VPS host `pg_dump` cron + weekly R2 offsite; deferred to launch/ops under the Release Freeze (D23-18) + hard boundaries (prod R2 secret / external-service activation). Feature-map corrected.
- **Production cookie-auth verification** (doc 19 §11, M5) · **Playwright post-deploy smoke** (D18-3) · **`openapi.json` release artifact** (doc 17 §4) — release-time; deferred.
- **GHA Node20 `@v4→@v5` bump** · **`storage/` gitignore** — separate chores.
- **New throttle tiers / caching / Redis / 2FA** — not needed (doc 19 §10, doc 20 §7). F005 verifies + regression-covers the shipped tiers, not a rewrite.
