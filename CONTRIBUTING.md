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

## Automatic deployment (from green `main`)
- **Triggers:** `push` to `main` (a merge or authorized push) and `workflow_dispatch` (recovery / redeploy). **No tags.**
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
