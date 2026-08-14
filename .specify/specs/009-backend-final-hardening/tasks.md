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

## Phase 1 — Workstream C + D investigations (read-only) → owner decisions

### C — Dependabot

| ID | Task | Status |
|---|---|---|
| C-1 | Confirm which branch the config is read from; confirm active state | DONE — R1, **ACTIVE** |
| C-2 | Confirm the security-fixes toggle separately from version updates | DONE — `enabled:false`, correct |
| C-3 | Establish #75 state: version, update type, CI, compatibility, security relevance | DONE — CI green, `MERGEABLE`/`CLEAN` |
| C-4 | Establish #76 state; read the **step array**, not the conclusion | DONE — R5, fails at `npm ci` |
| C-5 | Determine *why* #76's `npm ci` fails — peer-range or resolution evidence | TODO |
| C-6 | Classify TypeScript 5.9.3 → 7.0.2 against decorator-heavy Nest + Prisma 7, and its adjacency to the deferred ESM work | TODO |
| C-7 | Write the decision memo: cadence · target branch · grouping · patch/minor vs major · auto-merge · disposition of #75 and #76 · correction of the "not active" falsehood | TODO |
| C-8 | **STOP — owner decision** | OWNER-GATED |

### D — Legacy Production release

| ID | Task | Status |
|---|---|---|
| D-1 | Prove the rollback target is a **pointer**, not an ordering — from `remote-cutover.sh` | DONE — `PREV` = `readlink -f current` captured at cutover start (line 32); the legacy directory is reachable as a rollback target **only if it is `current`**, which it is not |
| D-2 | Prove the prune selection reaches it — `ls -1dt` beyond `KEEP_RELEASES=5`, live release skipped | DONE (code); confirm against live inventory in D-3 |
| D-3 | Read-only server probe: directory exists · `current` target · full release inventory · ownership/permissions · sizes | TODO |
| D-4 | Confirm the root-ownership cause still holds (exit 123 from the run log, already diagnosed — cite, do not re-derive) | TODO |
| D-5 | Prove no deployment metadata or operational process references it | TODO |
| D-6 | Capture the pre-state: `current` target · MainPID · NRestarts · four-probe health | TODO |
| D-7 | Write the deletion authorization request with all proofs attached | TODO |
| D-8 | **STOP — owner authorization** (irreversible Production mutation) | OWNER-GATED |

## Phase 2 — Workstream A: API CI efficiency

| ID | Task | Status |
|---|---|---|
| A-1 | Measure the real API release pipeline from hosted runs — per-job and per-step, with run IDs. The inherited ≈260 s figure is void (R3) | TODO |
| A-2 | Measure the API `ci.yml` run for comparison | TODO |
| A-3 | Test whether `deploy.yml` can prove at runtime that `main`'s **tree hash** equals a tree `ci.yml` passed green on `dev` (R4). Tree hash, never commit SHA — D17-4 squashes | TODO |
| A-4 | If A-3 succeeds: propose gating `verify`/`e2e` on that proof, preserving FR-A3 in full. If it fails: **evidence-defer** with the reason | TODO |
| A-5 | Identify any intra-job waste with no correctness argument | TODO |
| A-6 | Implement whatever survives A-4/A-5; negative-control every new guard before trusting it | TODO |
| A-7 | Re-measure; record improvements **and** regressions; state measured vs projected | TODO |
| A-8 | Confirm preserved: required checks · exact-SHA · branch policy · production approval · idempotency · four-probe gate · rollback arming | TODO |

## Phase 3 — Workstream B: CodeQL / static security

| ID | Task | Status |
|---|---|---|
| B-1 | Baseline confirmed absent (R2) | DONE |
| B-2 | Decide the language set — `javascript-typescript` certainly; `actions` assessed on its own cost/benefit given this repo's workflow-defect history | TODO |
| B-3 | Decide triggers: `pull_request → [dev, main]` + weekly `schedule`; **not** push-on-every-branch, which would give back Stage 2B's win | TODO |
| B-4 | Implement advisory-only. No SARIF committed. Required-check status is **not** taken in this campaign | TODO |
| B-5 | Verify it actually runs and produces analyses — evidence, not configuration | TODO |
| B-6 | Triage findings: fix bounded ones; escalate anything needing an architecture/product/security decision | TODO |
| B-7 | Confirm no existing gate weakened — `npm audit --audit-level=high`, secret scanning, push protection, four rulesets | TODO |
| B-8 | Required-check promotion → **owner decision** if recommended | OWNER-GATED |

## Phase 4 — Workstream D execution (only if authorized)

| ID | Task | Status |
|---|---|---|
| D-9 | Delete **only** the explicitly verified obsolete release | OWNER-GATED |
| D-10 | Verify `current` symlink unchanged | OWNER-GATED |
| D-11 | Verify **MainPID unchanged** and **NRestarts unchanged** — unconditionally; any movement is a failure, not an expected branch | OWNER-GATED |
| D-12 | Verify the **four-probe DB-backed** health set green — liveness alone cannot verify this app (D23-23) | OWNER-GATED |
| D-13 | Verify release inventory correct and the `PRUNE_INCOMPLETE` warning no longer names it | OWNER-GATED |

## Phase 5 — Workstream E: documentation + Arabic study reconciliation

| ID | Task | Status |
|---|---|---|
| E-1 | Reconcile each target in `plan.md` §6 against **final shipped behaviour** | TODO |
| E-2 | Correct the "Dependabot PREPARED but NOT ACTIVE" falsehood everywhere it appears — closure report §11c is **historical and not edited**; the correction lands in current docs and this campaign's ledger | TODO |
| E-3 | Correct doc 24 §2c's CI-duplication row for R3 — the ≈260 s / double-build remainder is **Web**, not API | TODO |
| E-4 | Arabic material explains what/how/why/failure modes/verification — study material, not a changelog. Identifiers stay English | TODO |
| E-5 | Re-run the full sweep after any supersession edit; a supersession can turn true text false | TODO |
| E-6 | `docs/group`: predict blast radius (expected: **bundle 03 alone**) → positive control → negative control → byte-identical second generation | TODO |
| E-7 | Synchronize roadmap, ledger, handoff | TODO |

## Phase 6 — Campaign close

| ID | Task | Status |
|---|---|---|
| F-1 | Verify every Definition-of-Done item in `spec.md` §6 | TODO |
| F-2 | Final report: **COMPLETED · DEFERRED · OWNER-GATED · OUTSIDE CAMPAIGN · NEXT PROJECT PHASE** | TODO |
| F-3 | Confirm all worktrees clean except owner-controlled local Docs state | TODO |
| F-4 | Do **not** begin Web work | TODO |
