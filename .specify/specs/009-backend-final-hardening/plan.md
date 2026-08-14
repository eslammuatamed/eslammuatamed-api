# 009 — Backend Final Hardening · PLAN

Companion to `spec.md`. This document records the **recovered baseline** (Phase 0 output), the
**classification** the brief requires, the **phase structure**, and the **Arabic study-material
targets identified up front**.

---

## 1. Recovery method and sources

Per the campaign's source-of-truth rule, **no new repo-wide audit was performed**. The remaining
work was recovered from existing evidence, and narrow live inspection was used only to answer
"is this candidate still present / true today?".

Sources read: `research/backend-remediation-closure-report.md` §9c, §10, §11, §12, §14;
`research/backend-remediation-ledger.md` §14 (14a, 14j, 14k — primary text, not the summary);
doc 24 §2c and §3.2. Live inspection: API `.github/workflows/{ci,deploy}.yml`,
`.github/dependabot.yml` on **both** `dev` and `origin/main`, `scripts/deploy/remote-cutover.sh`,
and the GitHub REST surfaces for code scanning, Dependabot and pull requests.

## 2. Baseline state — verified 2026-08-15, not trusted from the ledger

| Item | Live value |
|---|---|
| API `main` | `19ebbb40ac5e90c7a325fc7ed6412c3d9810c595` — matches the ledger |
| API `dev` | `5182cac623cc1d7f7b58e163ad89520ab26831cc` (docs-only ahead of `main`) |
| API visibility / default branch | **PUBLIC** / `main` |
| Docs campaign branch | `525ce3c240b5ab0aa46cba2e835903e6e26404f5`, local-only, **PRIVATE** |
| Web `dev` | `d53af11168ffff56eadaacc0c1d7fdd6c2c635c3` — untouched by this campaign |
| Open API PRs | **#75** `@types/node` 26.2.0 · **#76** `typescript` 7.0.2 |
| Open Dependabot alerts (API) | **0** |
| Campaign worktrees created | `~/worktrees/api-final-hardening` (`ops/backend-final-hardening` off `dev`) · `~/worktrees/docs-final-hardening` (`docs/backend-final-hardening` off the closed campaign branch) |

The closed campaign's branches (`fix/backend-audit-remediation`, `docs/backend-audit-remediation`)
are **frozen**. This campaign branches off them and never writes to them.

## 3. Recovery findings that CORRECT inherited documentation

Five inherited statements did not survive live verification. Each changes what the campaign should
do, so each is recorded before any implementation.

### R1 — Dependabot is **ACTIVE**, not "prepared but not active" *(materially changes Workstream C)*

`.github/dependabot.yml` is present on **`origin/main`**, landed by `25cd57e5` (PR #73) at
2026-08-13T18:33+03:00. Dependabot reads its configuration from the **default branch**, so version
updates are **live**. The empirical confirmation is #75 and #76 themselves: both were created
2026-08-13T23:10Z — about 7.5 hours *after* the config reached `main` — and both target **`dev`**,
which is exactly what `target-branch: dev` produces.

Closure report §11c, doc 24 §2c, and the config file's own header comment all still say **"PREPARED
but NOT ACTIVE"**. That is now **false**. Correcting it is Workstream C/E work.

Separately and correctly unchanged: **automated security fixes** are a *different* toggle and remain
`{"enabled": false, "paused": false}`. Vulnerability alerts are enabled (HTTP 204).

**Consequence:** the weekly schedule is Monday 06:00 Europe/Berlin. The next run is **Monday
2026-08-17**, which will open further PRs against `dev` whether or not a decision has been made.
The Workstream C memo is therefore front-loaded rather than left until last.

### R2 — CodeQL is genuinely absent *(confirms Workstream B is real)*

Three independent confirmations: default setup reports `{"state": "not-configured"}`; the analyses
endpoint returns **404 "no analysis found"**; and there is no CodeQL workflow file — API
`.github/workflows/` contains exactly `ci.yml`, `deploy.yml` and `deploy-fallback.yml`. Default
setup reports four candidate languages: `actions`, `javascript`, `javascript-typescript`,
`typescript`.

### R3 — The API deploy workflow does **not** build twice *(materially resizes Workstream A)*

Ledger §14k item 2 describes a `deploy.yml` whose `verify` job builds and whose `deploy` job builds
again — "builds **Nitro** twice within one workflow run", ≈260 s per release. Verified against the
current files, that describes the **Web** `deploy.yml` (build at line 201 in `verify`, again at line
256 in `deploy`), which is consistent with §14 being a Web-scoped stage that states plainly *"API
untouched"*.

The **API** `deploy.yml` contains exactly **one** `npm run build`, in the `deploy` job (line 309).
There is no second build to remove. What the API run actually duplicates is:

- three separate `npm ci` + `npx prisma generate` pairs, one each in `verify` (171/174), `e2e`
  (249/252) and `deploy` (303/306) — but these are **three different runners**, so they are not
  removable without merging jobs, which serializes work that partly runs in parallel today;
- the `verify` and `e2e` jobs re-running verification that `ci.yml` already ran on the `dev` push.

The ≈260 s figure must **not** be carried into this campaign's API measurements. Workstream A
re-measures from real API runs.

### R4 — `ci.yml` deliberately does not run on `push: main` *(makes the ≈186 s removal a design change)*

`ci.yml` is triggered by `pull_request → [dev, main]` and `push → [dev]` only. Its header states the
intent explicitly: *"main is deliberately NOT a push trigger here: a push to main is handled by
deploy.yml, which re-runs the same verification against the exact merged SHA before deploying."*

So `deploy.yml`'s `verify` job is **the only verification of `main`'s exact SHA**, not a redundant
copy. `deploy.yml`'s `verify` is also **stronger** than `ci.yml`'s was: it carries the `guard:fts`
FTS-migration guard specifically because the release path was the one lane that could ship a
migration destroying the search index after PR CI had already approved the branch (D09-6/D02-3).

Removing it is therefore a **change of design intent**, not a cleanup. It becomes defensible only
if `deploy.yml` can prove **at runtime** that `main`'s *tree* is identical to a tree `ci.yml` already
passed green on `dev`. Because D17-4 promotes by squash, the commit SHA differs and the link must be
a **tree hash**, never a SHA. If that proof cannot be established inside the workflow, `verify`
stays — FR-A4 decides it.

### R5 — PR #76 fails at `npm ci`, not at the compiler *(changes the Workstream C memo)*

The `Lint · Typecheck · Unit · Contract` job's step array shows step 4 `npm ci` **failure**, with
`Generate Prisma client`, `Lint`, `Typecheck`, `Unit tests`, contract export and the audit step all
**skipped**. TypeScript 7.0.2 was never exercised — this is dependency resolution, not a type
error. Reporting it as "TypeScript 7 breaks the build" would be wrong.

## 4. Classification — what this campaign may touch

### 4a. Already completed — do not repeat

- **Stage 2B CI efficiency (ledger §14, Web)** — 1,513 s → 696 s = **−54.0 %** wall-clock on real
  hosted runs, reproduced at 706 s; total runner work +1.1 %; Lighthouse semantics preserved; **no
  gate weakened, two guards added**; negative-controlled; artifact bytes regressed +32.7 %, reported.
- **Rejected with numbers in §14j — closed, not reopened:** `e2e` build-once (net wall-clock loss,
  and the two builds differ by `ANALYZE_BUNDLE`), Playwright browser cache (≈5 s ceiling, off the
  critical path), npm cache (correct as-is), trigger duplication (the `push: dev` run is the only
  verification of the real `dev` tree), docs-only path filters (would deadlock required contexts).
- **API workflow already assessed (§14j, §21/§42)** — ≈233 s, left unchanged as already short.

### 4b. Remaining API work — this campaign

| ID | Item | Workstream |
|---|---|---|
| A-1 | Re-measure the API release pipeline from real runs; establish the true duplication figure (R3 voids ≈260 s) | A |
| A-2 | Decide `deploy.yml` `verify`/`e2e` re-verification against the tree-identity test of R4 — implement **or** evidence-defer | A |
| A-3 | Intra-job waste with no correctness argument, if any survives measurement | A |
| B-1 | Introduce CodeQL: language set, trigger set, advisory posture | B |
| B-2 | Triage findings; fix bounded ones; escalate the rest | B |

### 4c. Web-only — classified and handed over, not implemented

- Lighthouse artifact duplication ≈12 MB/run (§14k item 1) — Web `deploy.yml`.
- The Web `deploy.yml` **double build** described by §14k item 2 (R3) — Web, and it belongs with
  RB-1 / the Frontend campaign, not here.
- `e2e` 70 s duplication (§14k item 3) — Web, and only if `e2e` becomes the critical path.

### 4d. Owner-gated

- **C** — Dependabot policy activation and disposition of #75 / #76.
- **B-4** — making any new check *required* (ruleset policy).
- **D** — the deletion itself.
- Docs publication.

### 4e. Production-mutation

**Workstream D only.** Nothing else in this campaign touches the server. Workstream D's
investigation is read-only; only the deletion mutates, and it stops for authorization first.

## 5. Phase structure

| Phase | Content | Gate at exit |
|---|---|---|
| **0** | Recovery, SpecKit, baseline ledger, worktrees | none — reported |
| **1** | **C + D investigations** (read-only) → two decision memos | **owner decision ×2** |
| **2** | **A** — measure, then implement or evidence-defer | CI green |
| **3** | **B** — CodeQL implementation + triage | CI green; required-check status owner-gated |
| **4** | **D execution**, only if authorized | Production post-conditions FR-D4 |
| **5** | **E** — documentation + Arabic reconciliation, `docs/group`, roadmap/ledger/handoff sync | `docs:group:check` |
| **6** | Final campaign report | campaign close |

Phase 1 is deliberately **before** the implementation phases even though Workstream A is the first
*implementation* priority. Both C and D terminate at owner decisions and both are read-only, so
running them first lets the owner decide while implementation proceeds. Investigation is not
implementation, so this does not displace A.

## 6. Arabic study-material targets — identified now, reconciled after behaviour stabilizes

Nothing below is edited until the behaviour it describes is final (FR-E2).

| Path | Repo | Triggered by |
|---|---|---|
| `docs/guides/ci-cd-study-guide.md` | Docs | A, B — the Arabic CI/CD study guide (ledger §5bb) |
| `docs/runbooks/manual-ci-deploy-runbook.md` | Docs | A, D (ledger §5bc) |
| `docs/BACKEND_STUDY_MAP.md` | Docs | any of A–D — study index |
| `docs/19-security.md` | Docs | B, C |
| `docs/23-deployment.md` | Docs | A, D |
| `docs/17-git-workflow.md` | Docs | C |
| `docs/18-testing-strategy.md` | Docs | A, B |
| `docs/24-roadmap.md` | Docs | all — §2c and §3.2 reconciliation, **including R1's correction** |
| `PROJECT_GUIDE.md` | API | A, C, D |
| `scripts/deploy/README.md` | API | D |
| `research/backend-final-hardening-ledger.md` | Docs | continuous |

**`docs/group` blast radius.** The generator bundles only the numbered docs `00`–`24`:
`01-product-and-design.md` (0–5), `02-architecture-and-standards.md` (6–16),
`03-delivery-and-roadmap.md` (17–24). Docs 17, 18, 19, 23 and 24 all fall in **bundle 03**, so the
expected blast radius for this campaign is **bundle 03 alone** — the same prediction §29 confirmed.
`guides/`, `runbooks/`, `research/` and `BACKEND_STUDY_MAP.md` are **not** bundle sources.

## 7. Working constraints

- Markdown is edited via **python heredoc**, never the Edit tool — the editor formatter hook
  reformats whole files.
- Worktrees live under `~/worktrees` (durable), never `/tmp`.
- Codex may take bounded investigation, implementation, testing or verification work. It makes no
  owner decisions and crosses no irreversible Production boundary. Its output is reviewed and the
  authoritative gates are run here.
- Before trusting any new measurement or check, run the negative control first.
- Every metric is reported with the SHA it came from.
