# 009 — Backend Final Hardening · TASKS

Status keys: `TODO` · `DOING` · `DONE` · `DEFERRED (evidence)` · `OWNER-GATED` · `N/A (evidence)`.
Authoritative status lives in the ledger; this file is the task decomposition.

---

## Phase 0 — Recovery, SpecKit, baseline  ·  **DONE**

| ID | Task | Status |
|---|---|---|
| 0-1 | Recover remaining work from closure report §10/§11, ledger §14j/§14k primary text, doc 24 §2c/§3.2 | DONE |
| 0-2 | Verify live baseline SHAs, PRs, alerts, visibility — zero-trust, not read from the ledger | DONE |
| 0-3 | Live-verify each inherited candidate against current workflow files | DONE — findings R1–R5 |
| 0-4 | Create campaign worktrees on new branches; leave closed-campaign branches frozen | DONE |
| 0-5 | Author `spec.md`, `plan.md`, `tasks.md` as spec **009** | DONE |
| 0-6 | Open the campaign ledger and record the baseline | DONE |
| 0-7 | Checkpoint report to owner | DONE |

## Phase 1 — Workstream C + D investigations (read-only) → owner decisions  ·  **DONE — blocked at OD-1 / OD-2**

### C — Dependabot  ·  **DONE**

| ID | Task | Status |
|---|---|---|
| C-1 | Confirm which branch the config is read from; confirm active state | DONE — R1, **ACTIVE** |
| C-2 | Confirm the security-fixes toggle separately from version updates | DONE — `enabled:false`, correct |
| C-3 | Establish #75 state: version, update type, CI, compatibility, security relevance | DONE — CI green, `MERGEABLE`/`CLEAN` |
| C-4 | Establish #76 state; read the **step array**, not the conclusion | DONE — R5, fails at `npm ci` |
| C-5 | Determine *why* #76's `npm ci` fails — peer-range or resolution evidence | DONE — `jest-mock-extended@4.0.1` peer range `^3\|\|^4\|\|^5\|\|^6` excludes TS 7 (ERESOLVE, run `31752885394`) |
| C-6 | Classify TypeScript 5.9.3 → 7.0.2 against decorator-heavy Nest + Prisma 7, and its adjacency to the deferred ESM work | DONE — its own upgrade, not a bump; belongs with the deferred ESM sequence |
| C-7 | Write the decision memo | DONE — ledger §2a |
| C-9 | Fresh readback before applying disposition | DONE — #75 unchanged head `5536552e`, MERGEABLE/CLEAN, 3/3 green; #76 unchanged. No material difference |
| C-10 | Merge #75 into `dev` | DONE — squash, `dev` `5182cac` → `a13af3cd` |
| C-11 | Close #76 with the proven reason recorded | DONE — ERESOLVE evidence posted on the PR |
| C-12 | TypeScript-major ignore rule + correct the stale status, on the campaign branch | DONE — `69143f1b`; no separate release for `dependabot.yml` |
| C-8 | Owner decision | **RESOLVED 2026-08-15** — OD-1 approved |

### D — Legacy Production release

| ID | Task | Status |
|---|---|---|
| D-1 | Prove the rollback target is a **pointer**, not an ordering — from `remote-cutover.sh` | DONE — `PREV` = `readlink -f current` captured at cutover start (line 32); the legacy directory is reachable as a rollback target **only if it is `current`**, which it is not |
| D-2 | Prove the prune selection reaches it — `ls -1dt` beyond `KEEP_RELEASES=5`, live release skipped | DONE (code); confirm against live inventory in D-3 |
| D-3 | Read-only server probe | DONE — ledger §2b; 394 MB, `root:root`, 6th of 6 by mtime |
| D-4 | Confirm the root-ownership cause still holds | DONE — `test -w` NOT WRITABLE; `deploy` sudo grant is two `systemctl restart` commands only |
| D-5 | Prove no deployment metadata or operational process references it | DONE — recursive grep over `/srv/eslammuatamed-api` returns zero matches; systemd binds `current`, not a release |
| D-6 | Capture the pre-state | DONE — MainPID 492176 · NRestarts 0 · four probes 200 |
| D-7 | Write the deletion authorization request with all proofs attached | DONE — ledger §2b |
| D-8 | **STOP — owner authorization** (irreversible Production mutation) | OWNER-GATED |

## Phase 2 — Workstream A: API CI efficiency  ·  **DONE**

| ID | Task | Status |
|---|---|---|
| A-1 | Measure the real API release pipeline from hosted runs | DONE — run `31837891096`: runner 288 s, wall 757 s, **464 s of it owner approval**; duplication = **194 s**, not 260 s |
| A-2 | Measure the API `ci.yml` run for comparison | DONE — run `31839076806`, same SHA: runner 212 s, wall 215 s |
| A-3 | Test the tree-hash equivalence | DONE — **held**: `tree(19ebbb40) == tree(1aac882d)`, green on `ci.yml` 21 min earlier. Retrospective, n=1, not a mechanism |
| A-4 | Decide removal | **EVIDENCE-DEFERRED** — ledger §3c; three new failure modes on a file with no pre-Production validation path, and verification gates the approval prompt |
| A-5 | Identify any intra-job waste with no correctness argument | DONE — none; the three `npm ci` are on three runners and all are required |
| A-6 | Implement what survives | DONE — `ea5a7113`, `e2e: needs: [preflight]`; actionlint negative-controlled |
| A-7 | Re-measure | **DONE — MEASURED 2026-08-15.** The blocker discharged itself at the release. Observed A/B, one metric definition (`run_started_at` → the deployment's first `waiting`): **207 s serial** (`31837891096`) → **142 s parallel** (`31851564671`) = **65 s, 31.4 %**, with **84 s** of proven `verify`/`e2e` overlap. The **≈131 s projection is superseded**; owner approval latency (1 701 s) is excluded and reported separately |
| A-8 | Confirm nothing weakened | DONE — ledger §3g; `deploy` still `needs: [preflight, verify, e2e]` |

## Phase 3 — Workstream B: CodeQL / static security  ·  **DONE**

| ID | Task | Status |
|---|---|---|
| B-1 | Baseline confirmed absent (R2) | DONE |
| B-2 | Decide the language set | DONE — `javascript-typescript` + `actions`, the latter on its own merits |
| B-3 | Decide triggers | DONE — `push: main` + `pull_request: [dev, main]` + weekly |
| B-4 | Implement advisory-only | DONE — `e5b5642c`; no SARIF committed; not a required check |
| B-5 | Verify by execution | DONE — PR #80 6/6 green; analyses 87 + 17 rules (endpoint was 404). **Negative-controlled locally**, both languages fire on an injected defect |
| B-6 | Triage findings | DONE — **0 findings, 0 open alerts**; nothing to triage or escalate |
| B-7 | Confirm no existing gate weakened | DONE — ledger §4f; the "four rulesets" figure resolved as program-wide (API 2 + Web 2), not drift |
| B-8 | Required-check promotion → **owner decision** if recommended | OWNER-GATED |

## Phase 4 — Workstream D execution  ·  **DONE — OD-2 reaffirmed and executed 2026-08-15**

| ID | Task | Status |
|---|---|---|
| D-8 | Owner authorization | **RESOLVED 2026-08-15** — OD-2 reaffirmed, scoped to one directory |
| D-9 | Delete **only** the explicitly verified obsolete release | DONE — `20260806T093803Z-572b0e3` and nothing else; guard negative-controlled first and the asserts run inside the same command as the `rm` |
| D-10 | Verify `current` symlink unchanged | DONE — `20260814T203732Z-19ebbb4`, identical |
| D-11 | Verify **MainPID unchanged** and **NRestarts unchanged** | DONE — 492176 / 0, plus `ExecMainStartTimestamp` unchanged and monotonic uptime: three independent fields |
| D-12 | Verify the **four-probe DB-backed** health set green (D23-23) | DONE — all 200 with **bodies asserted**; a code-only check would have passed against the Nuxt app on port 3000 |
| D-13 | Verify release inventory correct and `PRUNE_INCOMPLETE` no longer names it | DONE — 5 releases, none root-owned. **Note:** the prune set is *not* empty — pruning runs after the new release dir exists (ledger §6d); elimination comes from ownership, not from count |

## Phase 5 — Workstream E: documentation + Arabic study reconciliation  ·  **DONE**

| ID | Task | Status |
|---|---|---|
| E-1 | Reconcile each target in `plan.md` §6 against **final shipped behaviour** | DONE — all 11 targets swept. Edited: docs 16, 17, 18, 19, 23, 24, `BACKEND_STUDY_MAP.md`, `guides/ci-cd-study-guide.md`, `runbooks/manual-ci-deploy-runbook.md`, ledger; API `PROJECT_GUIDE.md`, `scripts/deploy/README.md`, `ci.yml` comment |
| E-2 | Correct the "Dependabot PREPARED but NOT ACTIVE" falsehood everywhere it appears — closure report §11c is **historical and not edited**; the correction lands in current docs and this campaign's ledger | DONE — doc 24 §2c row rewritten; full live policy now in doc 19 **§7c**; disposition rules in doc 17 §5; doc 16 §12 marked realized-for-API. Closure report untouched, as required. The `npm audit` "never exercised" comment corrected in `ci.yml`; the **ShellCheck omission (A-F1)** closed in the runbook's §A1 difference list |
| E-3 | Correct doc 24 §2c's CI-duplication row for R3 — the ≈260 s / double-build remainder is **Web**, not API | DONE — §2c row and §3.2 backlog both corrected; API re-measured at **194 s**, ≈260 s reassigned to Web |
| E-4 | Arabic material explains what/how/why/failure modes/verification — study material, not a changelog. Identifiers stay English | DONE — `ci-cd-study-guide.md` §33 rewritten (four-probe gate, base-URL composition, false-green class), §27 pruning, new §43b CodeQL and §43c Dependabot, job graph, 6 new self-check questions; `BACKEND_STUDY_MAP.md` T30 + stable-facts table |
| E-5 | Re-run the full sweep after any supersession edit; a supersession can turn true text false | DONE — and it **earned its keep**: the sweep caught 2 defects the supersession itself created (a link to the renamed §B13 anchor, and a stale "additional manual check" label). An in-document anchor checker was built and **negative-controlled** (injected break caught; revert byte-identical `2abf2536`); 8 documents clean. A cross-document anchor sweep confirmed nothing outside links into a renamed section |
| E-6 | `docs/group`: predict blast radius → positive control → negative control → byte-identical second generation | DONE — ⚠ **prediction corrected**: `plan.md` §6 expected **bundle 03 alone**; actual is **bundles 02 AND 03**, because doc 16 (bundle 02, docs 06–16) was touched by the Dependabot reconciliation. Pre-check named exactly 02 and 03. Negative control fired and restored via `cp -p` to md5 `c0dc87d7`. Second generation **byte-identical**. **25 sources / 3 bundles**; bundle 01 md5 `847df5ef` unchanged throughout; combined sha256 `e87d0565…5ae7542d` |
| E-7 | Synchronize roadmap, ledger, handoff | DONE — doc 24 §2c/§3.2, ledger §7, SpecKit tasks (this file) |

### Phase 5 finding — API probe/path verification contract

Phase 4 surfaced a false-green class: a probe without the `/api/v1` prefix can reach the **Nuxt
app on port 3000**, so a status code alone is not evidence the intended API endpoint was reached.
**Refined by measurement in Phase 5d (F5d-1):** port 3000 returns **`200 text/html`** on a *page*
route such as `/`, but **`404 application/json`** on an unknown `/api/*` path — so the risk is
**path-dependent**, and `application/json` alone does not prove the API answered either. Assert
the expected body *shape*.

**Triaged against the shipped implementation, and the deployed automation is NOT affected.**
`scripts/deploy/remote-cutover.sh:26` pins `API_BASE="http://127.0.0.1:3001/api/v1"`, all four
probes compose off it, and `curl --fail` makes a wrong path **fail closed** (port 3001 without the
prefix → 404). **No release-critical behaviour was changed**, and none needed to be. This was
documentation / manual-verification drift only, reconciled here per the campaign brief.

## Phase 5b — PR #80 integration (evidence, not merge authorization)  ·  **DONE**

| ID | Task | Status |
|---|---|---|
| E-8 | Read back current `dev` and PR #80 before any integration | DONE — `dev` `a13af3cd`, PR #80 head `48afc488`, base `dev`, OPEN/draft, `MERGEABLE`/`CLEAN`. Branch base was `5182cac`, so `a13af3cd` was **not** an ancestor |
| E-9 | Determine the governed integration method | DONE — **merge `origin/dev` into the campaign branch**, never rebase: doc 17 §9 forbids rebase-heavy rewriting of shared branches, PR #80 is published, and a rebase would rewrite `ea5a7113` / `e5b5642c` / `69143f1b`, the SHAs the ledger cites as evidence throughout §3–§5 |
| E-10 | Obtain fresh authoritative CI for the real integration candidate | DONE — ledger §7; final candidate `f3f15b33`, 6/6 green |
| E-11 | Confirm every required gate preserved and re-verify CodeQL on the final candidate | DONE — ledger §7; CodeQL re-run on the merge ref, 0 results |

## Phase 5c — governed integration and Production promotion  ·  **DONE** (ledger §8)

| ID | Task | Status |
|---|---|---|
| G-1 | Blocking pre-checks before any merge | DONE — parked deployment `5889417680` confirmed `failure`/cleared; ruleset `20759549` allows **`merge` only** (squash/rebase GitHub-forbidden on `main`); `deploy.yml` has no `dev` trigger |
| G-2 | Merge PR #80 → `dev` | DONE — squash, `dev` `1909ba8d`; **squash-tree proof** `f3f15b33^{tree}` == `1909ba8d^{tree}` == `72f02b33` (ancestry is the wrong instrument after a squash) |
| G-3 | Promote `dev` → `main` (PR #81) as a **true two-parent merge** | DONE — `main` **`73843e31`**, 2 parents, `main^{tree}` == `dev^{tree}` |
| G-4 | Stop at the Production approval gate | DONE — run `31851564671` parked `waiting`, mutation job **0 steps**, server unmutated |
| OD-3 | CodeQL required-check promotion | **RESOLVED 2026-08-15 — stays ADVISORY.** Shipped and observed on `main`; promotion to required left as a later evidence-based decision |

## Phase 5d — Production deployment, executed and measured  ·  **DONE** (ledger §9)

| ID | Task | Status |
|---|---|---|
| H-1 | Immediate pre-approval readback — 14 values, body-asserted probes | DONE — all unchanged; predictions recorded **before** the approval call |
| H-2 | Approve **only** deployment `5915156965` | DONE — `2026-08-15T00:18:27Z`; response referenced that deployment and no other; fallback never approved separately |
| H-3 | Observe the mutation job from its **step array** | DONE — 18 steps, **0 failed, 0 skipped**; exact-SHA re-checked twice (`proceed=true`); rollback branch **not entered** |
| H-4 | Post-cutover gate — four DB-backed probes, loopback **and** public edge | DONE — all `200 application/json`, asserted on body: readiness `database: up`, `settings/site` 4032 B `data.siteName`, `projects` **9 rows** |
| H-5 | Migration result — record the actual state, invent nothing | DONE — *"11 migrations found … **No pending migrations to apply.**"*; none rolled back |
| H-6 | Real pruning verification | DONE — `pruned 20260806T200056Z-b551270` (the **predicted** directory), count back to **5**, `PRUNE_INCOMPLETE` **absent**. Evidence class upgraded **VERIFIED BY CONSTRUCTION → MEASURED** |
| H-7 | Independent Production verification | DONE — `20260815T001836Z-73843e3`, `MainPID` 492176 → **497287**, `NRestarts=0`, Prisma **7.9.1**, `DATABASE_URL` `127.0.0.1`, journal clean (scanner negative-controlled) |
| H-8 | Fallback idempotency | DONE — `31851568480` → `already-current`; 3 jobs skipped, **no** second mutation / restart / approval; deployments total unchanged at 4 |
| H-9 | Timing — measured, not projected | DONE — **207 s → 142 s = 65 s (31.4 %)**; owner wait 1 701 s excluded and labelled; the owner's 203 s reconciled as a **second metric definition**, not adopted silently |
| H-10 | D17-4 `dev` synchronization | DONE — ancestry proven, **fast-forward only** (`1909ba8..73843e3`), no force/reset/recreate/synthetic commit; **`main` == `dev` == `73843e31`**; push:dev CI `31853612607` green; **no deployment triggered** |
| F5d-1 | Finding — the ":3000 answers 200 HTML to *any* path" phrasing | **FIXED** — measured: `/` → `200 text/html`, unknown `/api/*` → `404 application/json`. Risk survives, blanket phrasing does not. Corrected in ledger §9j, doc 23, the runbook and the Arabic guide |

## Phase 6 — Campaign close  ·  **DONE**

| ID | Task | Status |
|---|---|---|
| F-1 | Verify every Definition-of-Done item in `spec.md` §6 | **DONE** — 10/10 verified; see ledger §11 |
| F-2 | Final report: **COMPLETED · DEFERRED · OWNER-GATED · OUTSIDE CAMPAIGN · NEXT PROJECT PHASE** | **DONE** — ledger §11 |
| F-3 | Confirm all worktrees clean except owner-controlled local Docs state | **DONE** — ledger §11 |
| F-4 | Do **not** begin Web work | **HELD** — no Web repository, branch or file was touched at any point in this campaign |
| F5c-1 | Stale `ci.yml` comment claiming rulesets are "unavailable on this plan" | **FIXED** — comment-only; the edit was proven non-behavioural by parsed-YAML structural equality against `origin/dev` **with a negative control** (an injected `timeout-minutes` change was detected) |
| F-5 | Reconcile the **≈131 s projection** everywhere it survived | **DONE** — `PROJECT_GUIDE.md`, this file, docs 23/24, the manual runbook, the Arabic CI/CD study guide and `BACKEND_STUDY_MAP.md`. Historical projection, measured result and arithmetic counterfactual are kept **distinct**, not merged |

### Phase 6 limitation, recorded rather than worked around

API-repository markdown and SpecKit prose can only reach **`main`** through a `dev → main`
promotion, and **a push to `main` triggers `deploy.yml`**. Publishing this documentation there
would therefore manufacture an unnecessary Production release. It was **not** done. These changes
land on **`dev`** through the normal governed path — `dev` pushes cannot deploy (`deploy.yml` is
`push: [main]` + `workflow_dispatch` only, verified by construction and by observation twice) —
and `main` will pick them up whenever the **next** substantive release is promoted for its own
reasons. Until then, `main`'s copy of this file and of the `ci.yml` comment is one promotion
behind, which is ordinary D17-4 integration state, not drift.
