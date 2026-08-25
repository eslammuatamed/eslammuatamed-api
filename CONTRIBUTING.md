# Contributing — branching & deployment (API)

## Branches

- **`main`** — production, and the GitHub default branch. Merging a PR into `main` **triggers** the production deploy workflow automatically; the deployment itself still waits on the owner's approval (see below). Protected by an **active GitHub ruleset** *and* by project policy — see [Branch policy](#branch-policy--what-github-enforces-and-what-is-procedural).
- **`dev`** — development / integration. Feature work lands here first, then promotes to `main`.

## Release authorization

The Website/Homepage release freeze completed its lifecycle for the API on 2026-08-06 through the owner-authorized PR `#54` promotion and approved production deploy — canonical record **doc 17 §4 / D17-5**, deployment record **doc 23 §3 / D23-18**. That historical lift is **not standing authorization**: every future `dev → main` promotion still needs the owner's decision under D23-17, and every production deployment separately waits for approval on the `production` GitHub Environment.

## Normal flow

```
feature/<slug>   (branch from dev)
  → PR to dev → CI green → merge to dev
  → integration verification on dev
  → PR dev → main → owner merge
  → CI re-verifies the exact main SHA → owner approves the run → production deployment
```

- Source branches for `dev` PRs: `feature/*`, `fix/*`, `chore/*` (bots: `dependabot/*`, `renovate/*`).
- **Opening or updating a PR never deploys** and never sees production secrets.

## Hotfix flow

```
hotfix/<slug>   (branch from main)
  → PR to main → CI → owner merge → CI re-verifies the exact main SHA → owner approves the run → production deployment
  → merge the hotfix back into dev
```

## Merge strategy & branch synchronization

- **Feature / fix / chore → `dev`:** **squash merge** — keeps `dev` one complete commit per PR.
- **Promotion `dev` → `main`:** **merge commit** — never squash or rebase a `dev → main` promotion. A squash gives `main` a fresh tip that does not contain the promoted `dev` tip, leaving the branches content-identical but historically divergent.
- **After a successful `main` deployment** (and, for a `server-verification-required` promotion, after the predefined server checks pass): **fast-forward `dev` to the new `main` merge commit**, so `dev` and `main` share history at their tips.
- **Hotfixes** merged into `main` must be **merged back into `dev`** (a merge, not a squash) to keep the branches synchronized.
- **Never reset or force-push the shared `dev` branch**, and never recreate it.
- **A zero-file content diff is not sufficient** — `dev` and `main` must also share ancestry (`git merge-base --is-ancestor origin/main origin/dev` is true after a sync). This synchronization rule applies **independently per repository**; coordinated API/Web releases still go **API first, then Web**.

## Documentation & Handoff Gate (required before delivery)

Every feature's **final task** is the mandatory **Documentation & Handoff Gate** — canonical rule **doc 16 §5.1 / D16-8** ([`16-development-conventions.md`](../eslammuatamed-docs/docs/16-development-conventions.md)). Until it passes, the feature must **not** be pushed, PR'd, merged to `dev`, promoted to `main`, or deployed — "not requested" is never a reason to skip it. The Arabic module docs and SpecKit closeout are always required; other doc changes may be justified. The full rule lives in doc 16 and is **not restated here**.

## Development/demo seed data (required for data-backed flows)

Every feature that adds or changes a data-backed flow ships **deterministic development/demo seed data** before it is complete — canonical rule **doc 16 §5.2 / D16-9**, mechanics in **doc 09 §6 / D09-15**. The production seed is `prisma/seed.ts` (`npm run db:seed`); the **development-only overlay** is `prisma/seed.dev.ts` (`npm run db:seed:dev`), which runs on top of it and is **never wired to the Prisma `seed` key** — so `prisma db seed` / migrations never trigger it and it never runs in production. It must be idempotent (existence-guarded creates / upserts on stable slugs — no `deleteMany`, no reset), bilingual (`en` + `ar`), and grounded in the owner profile with no invented metrics. Clean-environment checks run against a **throwaway test database with an external temporary environment**; **never** read, overwrite, delete, print, or regenerate the real local `.env`. The full rule lives in doc 16 and is **not restated here**.

## Promotion cases — when `dev` → `main` is allowed

Code may be promoted from `dev` to `main` in **exactly two cases**:

**Case 1 — completed and verified work (the normal case).** The agreed scope is complete; all applicable unit/integration/E2E/contract/typecheck/lint/build checks pass; `dev` integration is green; documentation and configuration are accurate; no known blocker remains; the owner makes the final promotion decision.

**Case 2 — controlled server-environment verification.** Allowed only when the remaining behavior **genuinely cannot be validated outside the real server environment** (systemd/service behavior; Caddy/TLS/DNS/proxy/cookie/CORS integration; production filesystem permissions; production-compatible native binaries; real R2/S3 or other external integration; release symlink/cutover/rollback behavior; production build/runtime differences not reproducible locally or in CI). This is a controlled production verification, **not** permission to publish unfinished work. Before such a promotion: complete every test that can run locally or in CI; explain exactly why server validation is necessary; define the expected result, health/smoke checks, and rollback procedure; confirm the change is minimal, reversible, and involves no destructive database/storage operation (additive/fix-forward migrations only); hide or disable incomplete user-facing behavior where practical; and **mark the `dev → main` PR as a `server-verification-required` promotion** — the owner merging it is the authorization **to promote**; the deployment itself still waits on the separate `production` approval. After deployment: run the predefined checks immediately, monitor service/proxy logs, verify the exact deployed SHA; on failure use the documented rollback and fix on a branch from `dev` (never patch production directly); sync the result back through `dev`; record the outcome in the PR or ops documentation.

**Production is not a general testing environment.** Do not promote incomplete work because local testing is inconvenient. Stop and require a staging environment instead when server testing could damage or expose real data, require a destructive migration/reset/drop, interrupt production materially, expose incomplete or insecure functionality, send real external messages/transactions, alter existing R2 objects or user content unsafely, make rollback uncertain, or require experimenting with secrets/authentication.

## Deployment (from green `main`) — triggered automatically, gated on owner approval

- **Triggers (three, converging on one exact-SHA path):**
  - `push` to `main` — the **happy path** emitted by a merged promotion or hotfix PR. The `main` ruleset requires a PR and configures no bypass actor; direct pushes are not a release route.
  - **Merged-PR fallback** — `deploy-fallback.yml` fires on `pull_request: closed` into `main` (merged only), validates the exact merge SHA against the current `main` tip, and dispatches `deploy.yml` with `target_sha`. It exists because the `push` event is **empirically dropped by GitHub at times** (proven in the trigger audit); the merged-PR event is delivered independently, so both events missing is far less likely than one. The dispatcher holds **no production secrets** and never runs PR-branch code.
  - `workflow_dispatch` — **manual recovery** / redeploy.
  - **No tags. No scheduled reconciliation** — a schedule can itself be delayed or dropped, so it adds a lane without adding a guarantee. (`D23-17` also weighed Actions-minute cost; that half of the rationale was recorded while the repo was private and metered, and no longer applies.)
- **Idempotent duplicates:** when both the push and the fallback fire for the same SHA, the shared production concurrency group serializes them and a `preflight` job reads the live release SHA — one path **releases**, the other exits **already-current** with no server mutation. A stale SHA exits **superseded**. Main-tip lookups use the **git backend** (`ls-remote` + retries), not the REST API, which can lag or 503 during GitHub incidents.
- The `deploy` job cannot start unless the **same workflow run** re-verifies the **exact `github.sha`** — it does **not** rely only on the pre-merge PR checks (`needs: [preflight, verify, e2e]`). Before any server mutation it asserts `github.ref == refs/heads/main` **and** `HEAD == github.sha`.
- **Manual approval gate — a merged promotion is not a finished deployment.** The `deploy` job is the only job that mutates the server, and it is bound to the `production` GitHub environment, so the run pauses for the owner's approval **before the first remote write**. Everything upstream (`preflight`, `verify`, `e2e`) runs unapproved so cheap checks still fail fast. After merging a promotion, go and approve the run — an unapproved run simply waits and nothing is deployed.
- **Verification:** lint · typecheck · unit · FTS migration guard · OpenAPI contract idempotence · PostgreSQL E2E.
- **Migrations:** `prisma migrate deploy` only — **fix-forward** (a bad migration is repaired by a new one); production is **never** reset/dropped and the schema is **never** rolled back.
- One deployment at a time (`concurrency: deploy-api-production`, never cancelled).

## Rollback

Each release is a self-contained `releases/<UTC-ts>-<short-sha>` behind the `current` symlink. If the post-cutover **acceptance gate** fails, the deploy **automatically rolls back** (repoints `current` to the previous release + `systemctl restart`) and re-runs the **same** acceptance checks against the rollback target; with no previous release to fall back to it stops and reports that manual intervention is required. The schema is untouched (fix-forward). Manual form is in `.github/workflows/deploy.yml` — but a manual rollback is finished only when the **same acceptance checks** pass against the release you rolled back to. The authoritative probe list is `verify_app` in `scripts/deploy/remote-cutover.sh`; [`scripts/deploy/README.md`](scripts/deploy/README.md) shows how to run one by hand without fooling yourself. A restarted process is not a verified rollback.

**A failed deploy is not automatically a safe state.** Rollback needs somewhere to roll back *to*. With no previous release, nothing is reverted and the failed new release is still `current`. If the rollback does happen but the previous release fails verification too, `current` is that older release — also unhealthy. Either way the run goes red announcing `MANUAL INTERVENTION REQUIRED` and leaves an unhealthy release selected, serving badly or not serving at all. Treat that outcome as an **ongoing outage**, not a safe abort.

**The acceptance gate is not `/api/v1/health`.** That endpoint is **liveness** — it answers `200` from a process that is merely listening, even when the database is unreachable. Liveness cannot accept a release of a database-backed application, and because automatic rollback is driven by this same gate, **a gate that cannot fail cannot roll back**: on 2026-08-14 a release whose every database-backed endpoint was failing passed a liveness-only gate, was cut over, and left the rollback disarmed. Acceptance therefore requires liveness **and** readiness **and** real database-backed reads, together — and so does the re-verification of a rollback target. **Never re-point rollback at a liveness-only signal.** The probe list itself belongs to the code that runs it, `scripts/deploy/remote-cutover.sh`, and is documented in [`scripts/deploy/README.md`](scripts/deploy/README.md) and [`PROJECT_GUIDE.md` §11](PROJECT_GUIDE.md) — deliberately not duplicated here, because a second copy is what let this section rot.

## Coordinated API + Web releases

The repos deploy **independently**. For a cross-repo contract change: **deploy API `main` first**, verify its health + backward compatibility, **then** promote Web `main` (which regenerates its types from the committed `openapi.json`). Do not merge coordinated API + Web promotions simultaneously.

## Branch policy — what GitHub enforces, and what is procedural

This repository is **public** and carries **active GitHub rulesets**. The rulesets themselves are the authority for the exact settings; what a contributor needs is the split between what is refused by the platform and what is only discipline.

**Enforced by GitHub on `main`** (ruleset *main production promotion control*):

- **A pull request is required** — a direct push to `main` is refused, not merely discouraged. No bypass actors are configured.
- **A merge commit is the only permitted merge method** — GitHub refuses squash and rebase on `main`. This makes `D17-4`'s promotion rule structural rather than procedural.
- **`Lint · Typecheck · Unit · Contract` and `E2E (Postgres)` are required checks** — a PR failing either cannot be merged. The remaining four contexts (`CodeQL`, `Analyze (actions)`, `Analyze (javascript-typescript)`, and the branch-policy guard) are deliberately **not** required; promoting one is a separate owner decision.
- Branch deletion and non-fast-forward pushes are refused.

**Enforced by GitHub on `dev`** (ruleset *dev integration protection*): branch deletion and non-fast-forward pushes only. `dev` carries **no required PR and no required checks**, which preserves `D17-4`'s post-release **fast-forward of `dev` to the new `main` merge commit**; a required-check rule on `dev` would block that governed direct push.

**Procedural only — GitHub will not stop you:**

- **PRs into `dev`**, and **not merging a red PR into `dev`**, are discipline: nothing on `dev` enforces either.
- The CI **branch-policy guard is advisory by choice, not by platform limitation** — it reports an unexpected promotion path and never fails the build (`.github/workflows/ci.yml`).
- Governance assumes **one operator**. Adding another writer means revisiting the procedural `dev` half above; it is no longer a question of the account plan.
- Do **not** use `[skip ci]` on a commit that reaches `main` — GitHub would skip the deploy workflow; recover with a `workflow_dispatch` run on `main`.

## Local environment files — never touched by tests

- `<repo-root>/.env` is the developer's real local environment: untracked (`.gitignore`), boot-validated, and possibly holding locally entered credentials. **No test, script, CI step, or contract-export check may overwrite, replace, or delete it.**
- A check that needs a clean/template environment must use an **external temporary env file or directory** (e.g. a temp copy outside the working tree pointed at via the tool's env-path option) **or a trap-based backup/restore guard** that restores the original on success, failure, _and_ interruption — a plain `cp .env.example .env … rm -f .env` sequence is forbidden in the real checkout.
- Incident record (2026-07-19): an OpenAPI-idempotence check ran exactly that sequence in the primary checkout and destroyed the developer's `.env` (locally entered R2 values lost). This rule exists so that never recurs.

## Dependency overrides — all TEMPORARY, each needs an exit condition

`package.json` cannot carry comments, so every `overrides` entry is justified here. An override is a
workaround for someone else's dependency graph, never a permanent design choice: each one below states
the condition that retires it. **Scope every entry to its parent package** (`"parent": { "child": "…" }`) —
a bare `"child": "…"` entry rewrites the version for _every_ consumer in the tree, now and in future.

| Override                                  | Reason                                                                                                                                                                                                                           | Retire when                                                                                                                                                                                                                                                                      |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@prisma/config` → `deepmerge-ts: ^8.0.1` | **CVE-2026-40345 / GHSA-ggr8-5vv4-36mx** (high, CWE-674). `@prisma/config@7.9.1` **exact-pins** `deepmerge-ts@7.1.5`, so no package manager can dedupe to the patched 8.0.0+ and `npm audit --audit-level=high` blocks every PR. | **Prisma publishes a `@prisma/config` that depends on `deepmerge-ts >= 8.0.0`** — tracked upstream at [prisma/prisma#30052](https://github.com/prisma/prisma/issues/30052). Then delete this entry, `npm install`, and confirm `npm ls deepmerge-ts` shows the upstream version. |

### On the `deepmerge-ts` override specifically (added 2026-08-17)

Not a security emergency: the advisory is **availability-only** (CVSS v4 8.2 is `VA:H` with `VC:N/VI:N`) and
requires a **self-referential object graph**, which `JSON.parse` cannot produce — so no HTTP request can reach
it. The single call site is `loadConfigTsOrJs` in `@prisma/config`, which merges this repo's own
`prisma.config.ts` at CLI/deploy time. The override was taken to unblock CI **without weakening the audit
gate**, which stays `npm audit --audit-level=high` and blocking.

Compatibility was measured, not assumed: c12 invokes the merger **once with 5 positional inputs of which
only 1 is defined** (`extend`/`rcFile`/`giget`/`packageJson`/`dotenv` are all `false` and no `defaults` are
passed), no `Map`/`Set` appears in the input, and `deepmerge-ts` 7.1.5 and 8.0.1 produce **byte-identical
output** on that real input — so 8.x's breaking changes (recursive `Map` merging, `deepmergeInto`
leak-mutation, two type renames) are structurally unreachable here.

### Contract-test validator: exact pin and known limitation

The OpenAPI contract matchers (`expect(res).toSatisfyApiSpec()`, registered once in
`test/utils/contract.ts`) come from `@ehuelsmann/jest-openapi`, which is **exact-pinned**
(`"0.17.3"`, no caret) on purpose:

- 0.17.3 is verified against this repo's toolchain (Node 24, Jest 30, strict TypeScript with
  NodeNext resolution) and preserves the previous validator's behavior exactly.
- The published 0.18.x artifacts reference TypeScript declaration files that are absent from the
  npm package, so installing them breaks `tsc --noEmit` at every matcher call site.
- An exact pin means an upgrade to a fixed release line is always a deliberate reviewed change,
  never an automatic drift within a broken range.

**Exit condition:** bump off 0.17.3 as soon as upstream publishes a release whose artifact actually
contains valid `.d.ts` files — verify by checking that `dist/index.d.ts` exists inside the published
tarball and `npm run typecheck` passes, then move to a caret range if desired. 0.18.x itself is not
permanently unsupported; only its current packaging blocks it.

**Known validation limitation (pre-existing, preserved by design):** `toSatisfyApiSpec()` enforces
structure — path/method/status documentation, required properties, types, enums, `$ref`,
`nullable`/`allOf` — but does **not** enforce OpenAPI `format` keywords such as `uuid`,
`date-time`, or `email`. This gap predates the validator migration; the migration intentionally
preserves behavior rather than fixing it. Do not rely on format constraints being checked by the
contract suite; a future dedicated task may replace or extend the matcher engine if enforcing
formats becomes worth owning that code.
