# Contributing — branching & deployment (API)

## Branches
- **`main`** — production, and the GitHub default branch. Every commit on `main` is deployed automatically (see below). Protected **by project policy**, not by GitHub (see the Free-plan note).
- **`dev`** — development / integration. Feature work lands here first, then promotes to `main`.

## Normal flow
```
feature/<slug>   (branch from dev)
  → PR to dev → CI green → merge to dev
  → integration verification on dev
  → PR dev → main → owner merge
  → CI re-verifies the exact main SHA → automatic production deployment
```
- Source branches for `dev` PRs: `feature/*`, `fix/*`, `chore/*` (bots: `dependabot/*`, `renovate/*`).
- **Opening or updating a PR never deploys** and never sees production secrets.

## Hotfix flow
```
hotfix/<slug>   (branch from main)
  → PR to main → CI → owner merge → automatic production deployment
  → merge the hotfix back into dev
```

## Merge strategy & branch synchronization
- **Feature / fix / chore → `dev`:** **squash merge** (preferred) — keeps `dev` one complete commit per PR.
- **Promotion `dev` → `main`:** **merge commit** — never squash or rebase a `dev → main` promotion. A squash gives `main` a fresh commit with no shared ancestry to `dev`, leaving the branches content-identical but historically divergent.
- **After a successful `main` deployment** (and, for a `server-verification-required` promotion, after the predefined server checks pass): **fast-forward `dev` to the new `main` merge commit**, so `dev` and `main` share history at their tips.
- **Hotfixes** merged into `main` must be **merged back into `dev`** (a merge, not a squash) to keep the branches synchronized.
- **Never reset or force-push the shared `dev` branch**, and never recreate it.
- **A zero-file content diff is not sufficient** — `dev` and `main` must also share ancestry (`git merge-base --is-ancestor origin/main origin/dev` is true after a sync). This synchronization rule applies **independently per repository**; coordinated API/Web releases still go **API first, then Web**.

## Documentation & Handoff Gate (required before delivery)
Every feature's **final task** is the mandatory **Documentation & Handoff Gate** — canonical rule **doc 16 §5.1 / D16-8** ([`16-development-conventions.md`](../eslammuatamed-docs/docs/16-development-conventions.md)). Until it passes, the feature must **not** be pushed, PR'd, merged to `dev`, promoted to `main`, or deployed — "not requested" is never a reason to skip it. The Arabic module docs and SpecKit closeout are always required; other doc changes may be justified. The full rule lives in doc 16 and is **not restated here**.

## Promotion cases — when `dev` → `main` is allowed
Code may be promoted from `dev` to `main` in **exactly two cases**:

**Case 1 — completed and verified work (the normal case).** The agreed scope is complete; all applicable unit/integration/E2E/contract/typecheck/lint/build checks pass; `dev` integration is green; documentation and configuration are accurate; no known blocker remains; the owner makes the final promotion decision.

**Case 2 — controlled server-environment verification.** Allowed only when the remaining behavior **genuinely cannot be validated outside the real server environment** (systemd/service behavior; Caddy/TLS/DNS/proxy/cookie/CORS integration; production filesystem permissions; production-compatible native binaries; real R2/S3 or other external integration; release symlink/cutover/rollback behavior; production build/runtime differences not reproducible locally or in CI). This is a controlled production verification, **not** permission to publish unfinished work. Before such a promotion: complete every test that can run locally or in CI; explain exactly why server validation is necessary; define the expected result, health/smoke checks, and rollback procedure; confirm the change is minimal, reversible, and involves no destructive database/storage operation (additive/fix-forward migrations only); hide or disable incomplete user-facing behavior where practical; and **mark the `dev → main` PR as a `server-verification-required` promotion** — the owner merging it is the authorization. After deployment: run the predefined checks immediately, monitor service/proxy logs, verify the exact deployed SHA; on failure use the documented rollback and fix on a branch from `dev` (never patch production directly); sync the result back through `dev`; record the outcome in the PR or ops documentation.

**Production is not a general testing environment.** Do not promote incomplete work because local testing is inconvenient. Stop and require a staging environment instead when server testing could damage or expose real data, require a destructive migration/reset/drop, interrupt production materially, expose incomplete or insecure functionality, send real external messages/transactions, alter existing R2 objects or user content unsafely, make rollback uncertain, or require experimenting with secrets/authentication.

## Automatic deployment (from green `main`)
- **Triggers (three, converging on one exact-SHA path):**
  - `push` to `main` — the **happy path** (a merged promotion or authorized push).
  - **Merged-PR fallback** — `deploy-fallback.yml` fires on `pull_request: closed` into `main` (merged only), validates the exact merge SHA against the current `main` tip, and dispatches `deploy.yml` with `target_sha`. It exists because the `push` event is **empirically dropped by GitHub at times** (proven in the trigger audit); the merged-PR event is delivered independently, so both events missing is far less likely than one. The dispatcher holds **no production secrets** and never runs PR-branch code.
  - `workflow_dispatch` — **manual recovery** / redeploy.
  - **No tags. No scheduled reconciliation** (Actions-minute cost on the Free plan, and schedules can themselves be delayed/dropped).
- **Idempotent duplicates:** when both the push and the fallback fire for the same SHA, the shared production concurrency group serializes them and a `preflight` job reads the live release SHA — one path **releases**, the other exits **already-current** with no server mutation. A stale SHA exits **superseded**. Main-tip lookups use the **git backend** (`ls-remote` + retries), not the REST API, which can lag or 503 during GitHub incidents.
- The `deploy` job cannot start unless the **same workflow run** re-verifies the **exact `github.sha`** — it does **not** rely only on the pre-merge PR checks (`needs: [verify, e2e]`). Before any server mutation it asserts `github.ref == refs/heads/main` **and** `HEAD == github.sha`.
- No manual approval gate (see Free-plan note).
- **Verification:** lint · typecheck · unit · OpenAPI contract idempotence · PostgreSQL E2E.
- **Migrations:** `prisma migrate deploy` only — **fix-forward** (a bad migration is repaired by a new one); production is **never** reset/dropped and the schema is **never** rolled back.
- One deployment at a time (`concurrency: deploy-api-production`, never cancelled).

## Rollback
Each release is a self-contained `releases/<ts>` behind the `current` symlink. If the post-cutover `/api/v1/health` gate fails, the deploy **automatically rolls back** (repoints `current` to the previous release + `systemctl restart`). The schema is untouched (fix-forward). Manual form is in `.github/workflows/deploy.yml`.

## Coordinated API + Web releases
The repos deploy **independently**. For a cross-repo contract change: **deploy API `main` first**, verify its health + backward compatibility, **then** promote Web `main` (which regenerates its types from the committed `openapi.json`). Do not merge coordinated API + Web promotions simultaneously.

## ⚠️ Free-plan reality — branch policy is procedural, not GitHub-enforced
This is a **private repo on GitHub Free**: **branch protection, rulesets, and environment required-reviewers are unavailable**. Therefore:
- **Direct pushes to `main` are prohibited by policy, but GitHub will not block them** — always go through a PR.
- The CI **branch-policy guard is advisory**: it reports an unexpected promotion path but cannot block a merge.
- **Red PRs must not be merged** (procedural discipline).
- **Adding a second write collaborator requires upgrading to GitHub Pro/rulesets (for real branch protection) or a policy redesign first.** The current model assumes **`eslammuatamed` is the sole writer** — verified: sole admin, no other collaborators, no deploy keys, no webhooks, read-only default `GITHUB_TOKEN`.
- Do **not** use `[skip ci]` on a commit that reaches `main` — GitHub would skip the deploy workflow; recover with a `workflow_dispatch` run on `main`.

## Local environment files — never touched by tests
- `<repo-root>/.env` is the developer's real local environment: untracked (`.gitignore`), boot-validated, and possibly holding locally entered credentials. **No test, script, CI step, or contract-export check may overwrite, replace, or delete it.**
- A check that needs a clean/template environment must use an **external temporary env file or directory** (e.g. a temp copy outside the working tree pointed at via the tool's env-path option) **or a trap-based backup/restore guard** that restores the original on success, failure, *and* interruption — a plain `cp .env.example .env … rm -f .env` sequence is forbidden in the real checkout.
- Incident record (2026-07-19): an OpenAPI-idempotence check ran exactly that sequence in the primary checkout and destroyed the developer's `.env` (locally entered R2 values lost). This rule exists so that never recurs.
