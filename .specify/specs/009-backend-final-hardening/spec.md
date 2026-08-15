# 009 — Backend Final Hardening

**Status:** **CLOSED 2026-08-15** · **Opened:** 2026-08-15 · **Owner authorization:** campaign-level, 2026-08-15
**Closure:** all 10 Definition-of-Done items in §6 verified — ledger §11. Production release
`20260815T001836Z-73843e3` on `main` `73843e31`; `dev` synchronized per D17-4. Two items remain
**OWNER-GATED and deliberately not taken**: B-8 (promoting CodeQL to a required check) and A-4
(removing `verify` from the release lane, evidence-deferred). No Web work was started.
**Ledger:** `../eslammuatamed-docs/docs/research/backend-final-hardening-ledger.md`
**Predecessor:** Backend Remediation Campaign — **CLOSED**, phases 0–15, not reopened and not
renumbered by this spec. Its record is `research/backend-remediation-closure-report.md` and
`research/backend-remediation-ledger.md` (§1–§29). This campaign **cites** them; it never edits them.

---

## 1. Why this campaign exists

The Backend Remediation Campaign closed with a deliberately separated backlog: work that was real,
sized and evidenced, but outside that campaign's authorization. Closure report §10b/§11b and doc 24
§2c/§3.2 carry it. Primary engineering focus is about to move to the Web, and this campaign exists
to finish the Backend engineering and operational hygiene that is worth completing *before* that
shift — so the Backend is left in a state that needs no attention while Web work proceeds.

This is a **hardening and hygiene** campaign, not a feature campaign. It ships no new API surface
and changes no API contract.

## 2. Scope — four engineering workstreams plus a documentation gate

| # | Workstream | Nature |
|---|---|---|
| **A** | API CI / workflow duplication and efficiency remainder | implementation |
| **B** | CodeQL / static security hardening | implementation |
| **C** | Dependabot policy and disposition | **owner decision** |
| **D** | Legacy Production release cleanup | **Production mutation, owner-gated** |
| **E** | Documentation + Arabic study-material reconciliation | mandatory, spans A–D |

## 3. Explicitly out of scope

Named here so that nothing drifts in under a plausible justification:

- CommonJS → ESM migration — **deferred, not rejected**; its gate (Prisma 7 settled in Production)
  has opened, which makes it *schedulable*, not *authorized*. Its own dedicated migration.
- Web RB-1 (Nuxt security compatibility, 31 open alerts) — Web work, owner-gated, authorization
  ambiguous.
- Frontend cleanup / modernization (doc 24 §3.1).
- Lighthouse optimization — including the ≈12 MB/run Lighthouse artifact duplication of ledger
  §14k item 1, which this campaign **classifies as Web work and hands over**, without implementing.
- M5 launch-hardening drills (restore drill, release-artifact boot drill, offsite R2).
- PostgreSQL password + SCRAM hardening (doc 19 §7b / D19-13) — a future dedicated
  Security/Infrastructure campaign.
- Deferred audit findings C-1, C-2, C-4, D-8 — their documented reopen triggers have **not** fired.
- Docs publication — Docs remain PRIVATE and local-only.
- General server cleanup beyond the one explicitly identified legacy release directory.

## 4. Requirements

### FR-A — API CI efficiency

- **FR-A1** Every duplication candidate inherited from ledger §14k **MUST** be re-verified against
  the *current* workflow files before any change. A candidate that no longer exists, or that never
  applied to this repository, is recorded as such and closed — not implemented.
- **FR-A2** Candidates already investigated and rejected with measurements in ledger §14j **MUST
  NOT** be re-proposed: `e2e` build-once, Playwright browser cache, npm cache, trigger duplication,
  docs-only path filters.
- **FR-A3** Any change **MUST** preserve, with evidence: CI as the authoritative gate; the existing
  required checks; exact-SHA deployment (`HEAD == github.sha`, pre-cutover re-check); branch policy
  (`dev` integration → `main` production); the `production` environment approval boundary;
  deployment idempotency (`already-current` no-op); the four-probe readiness + DB-backed smoke gate
  (D23-23); and rollback arming.
- **FR-A4** Correctness **MUST NOT** be traded for elapsed time. A reduction that leaves any tree
  reaching Production unverified is rejected regardless of its size.
- **FR-A5** Improvements **and** regressions **MUST** both be measured and recorded, from real
  workflow evidence where practical, and stated as measured or projected — never conflated.

### FR-B — CodeQL / static security

- **FR-B1** The current scanning state **MUST** be established from live evidence, not assumption:
  what is configured, what runs, which branches and events, advisory vs authoritative, and whether
  findings exist.
- **FR-B2** The smallest maintainable hardening appropriate to this repository is implemented.
  Duplicate scanning that adds cost without coverage is rejected.
- **FR-B3** No existing security gate is weakened — `npm audit --audit-level=high`, secret scanning,
  push protection, the four active rulesets.
- **FR-B4** Making any new check **required** is a ruleset policy change and is **owner-gated**
  (precedent: OD-10-4, where requiring Web `verify` would deadlock every PR).
- **FR-B5** Material findings are classified. Bounded ones are fixed in-campaign; anything needing
  an architecture, product or security decision stops at an owner checkpoint.

### FR-C — Dependabot disposition

- **FR-C1** Live configuration state **MUST** be recovered — including which branch the
  configuration is read from — before any recommendation is written.
- **FR-C2** A concise decision memo is produced covering cadence, target branch, grouping,
  patch/minor vs major handling, auto-merge policy, and disposition of each open PR.
- **FR-C3** Nothing is merged, closed, or enabled because a configuration exists.
- **FR-C4** Material policy activation or PR disposition **STOPS for owner decision**.

### FR-D — Legacy Production release cleanup

Target: `20260806T093803Z-572b0e3`, which reports `PRUNE_INCOMPLETE` on every release.

- **FR-D1** Before any deletion is proposed, prove from evidence that the directory exists; is not
  current; is **not reachable as the automatic rollback target** (proved from the selection logic in
  `scripts/deploy/remote-cutover.sh`, not from the server listing alone); is required by no
  deployment metadata or operational process; and that its ownership/permissions are the reason
  automated pruning cannot remove it.
- **FR-D2** Permissions **MUST NOT** be modified merely to silence the warning.
- **FR-D3** Deletion is an **irreversible Production mutation**. It **STOPS for explicit owner
  authorization** immediately before execution.
- **FR-D4** After deletion: `current` symlink unchanged; **MainPID unchanged**; **NRestarts
  unchanged** — both asserted *unconditionally*, since removing an inactive directory cannot require
  a restart, so any movement is a failure, not an expected branch; the **four-probe DB-backed**
  health set green (a liveness probe cannot verify this application — D23-23); release inventory
  correct; and the `PRUNE_INCOMPLETE` warning gone from the next prune evaluation.
- **FR-D5** Production **MUST NOT** be restarted unless independently required *and* explicitly
  authorized.

### FR-E — Documentation and Arabic study gate

- **FR-E1** For every materially changed area, the affected Arabic study material is identified
  **early** — by path, in `plan.md` — not discovered at the end.
- **FR-E2** Reconciliation happens against **final shipped behaviour**, after implementation
  stabilizes.
- **FR-E3** Arabic material explains what the subsystem does, how the flow works, its architecture
  and boundaries, **why** the design was chosen, failure modes and lessons, how testing/CI/security
  verification proves it, and operational behaviour. It is **study material, not a changelog**.
- **FR-E4** Exact technical identifiers stay in English.
- **FR-E5** A phase that changes behaviour is **NOT complete** while its Arabic study material still
  describes the old behaviour.
- **FR-E6** Where the source-doc blast radius requires it, `docs/group` deterministic regeneration
  runs under its established governance: predict blast radius → positive control → negative control
  → byte-identical second generation.

## 5. Owner gates

Execution stops before: Production mutation or any irreversible server action; weakening a
security, test or performance gate; material architectural deviation; any API contract break;
branch/ruleset policy changes with material consequences; Dependabot activation or PR disposition;
Docs publication; scope expansion; destructive data operations; a material unresolved security
finding.

Everything else proceeds across sessions from the ledger, without a new prompt per phase.

## 6. Definition of Done

1. The justified API CI duplication remainder is **resolved or explicitly evidence-deferred**.
2. Authoritative CI is **green**.
3. CodeQL / static security posture is **implemented and verified**, or a documented evidence-based
   reason shows no change is appropriate.
4. Dependabot has an **explicit owner-approved disposition**.
5. The known obsolete legacy release is **safely removed with authorization**, or explicitly
   **evidence-deferred**.
6. No Web / launch / ESM / SCRAM work was silently pulled into scope.
7. Arabic study documentation reflects the **final** state.
8. Roadmap, ledger and handoff are synchronized.
9. `docs/group` verification passes where applicable.
10. All worktrees clean, except explicitly owner-controlled local Docs state.

The final report separates: **COMPLETED · DEFERRED · OWNER-GATED · OUTSIDE CAMPAIGN · NEXT PROJECT
PHASE**. Web work does **not** begin automatically on completion.
