# Campaign ledger — Backend Learnability, Documentation, and Code Comprehension

> **What this file is.** The durable control plane for this campaign. A fresh session must be
> able to resume from this file alone, without reconstructing anything from chat history.
> It is historical evidence, not learning documentation — it is allowed to carry SHAs, PR
> numbers and campaign chronology, which the documents it governs are not.

---

## 1. Authoritative baseline

| Fact | Value | How verified |
| --- | --- | --- |
| Repository | `eslammuatamed-api` | — |
| Production `main` | `9af1aace27289404efa57e8111c5fc3786c65f75` | `git rev-parse origin/main` |
| `dev` | `9af1aace27289404efa57e8111c5fc3786c65f75` | `git rev-parse origin/dev` |
| Branch sync | **Already identical.** No fast-forward was needed or performed. | `git log origin/main..origin/dev` and the reverse — both empty |
| Production release | `20260817T183604Z-9af1aac` | owner brief; not independently re-verified this session |
| Campaign branch | `campaign/backend-learnability`, started from the baseline | `git switch -c` in a dedicated worktree |
| Worktree | `/home/eslam-muatamed/worktrees/api-learnability` | on `/home`, never `/tmp` |

**No production or `main` action has been taken, and none is authorized.**

---

## 2. Campaign-shaping discoveries (phase 0)

### D-1 — The code-adjacent documentation corpus is Arabic-dominant

Measured across all 27 learning documents: 42–80% Arabic codepoints, the remainder being
English technical identifiers, paths and code. `CONTRIBUTING.md` and `CLAUDE.md` are 0% Arabic.

This is deliberate (the Arabic documentation initiative), not drift.

**Accepted convention — see §4.C.** This was NOT escalated to the owner: the corpus already
answers the question, and the cold-reader persona in the charter is the owner, who commissioned
these documents in Arabic.

### D-2 — Identifier references split into two populations that must be treated oppositely

The charter's lead ("source comments contain remediation identifiers such as C-5 or B-2")
is real but is a small minority of the identifier surface. Measured:

| Class | Distinct tokens | Occurrences | Disposition |
| --- | ---: | ---: | --- |
| GOVERNANCE (`D<NN>-<N>`, `FR-*`, `NFR-*`, `PUB-*`, `DSH-*`) | 129 | 816 | **KEEP** — normative pointers into the governing docs |
| ARCHAEOLOGY (`C-*`, `B-*`, `F9-*`, `P9-*`, `AD-*`, `OD-*`) | 17 | 68 | **RETIRE** — unresolvable completed-campaign findings |
| EXEMPT (`SHA-256`, `%PDF-1.4`, `CWE-*`, `TEST-NET-*`) | — | — | ignore — real vocabulary |
| UNCLASSIFIED | 0 | 0 | — |

Governance references outnumber archaeology **12 to 1**. A naive identifier purge would have
destroyed the repository's entire traceability into its own governing decisions. This is the
single most important constraint discovered so far.

### D-3 — The archaeology fix is prefix-stripping, not comment deletion, EXCEPT where the claim is now false

Two distinct buckets, which must not be handled by the same edit:

- **Bucket A — good comment, archaeological prefix.** `src/modules/projects/projects.service.ts:181`
  (`// C-5: a nested create is ALREADY atomic, so no $transaction wrapper …`). The prose states a
  real invariant and is worth keeping verbatim. Strip `C-5: ` only.
- **Bucket B — the claim itself is now false.** `test/prisma-error-mapping.e2e-spec.ts:25`
  (`// Phase 10 B-2 **will** delete the Project-local P2002 translation …`). That deletion has
  already happened (`projects.service.ts:186` documents its absence). This is a stale future-tense
  claim — a correctness defect, not a cosmetic one, and it needs a rewrite, not a prefix strip.

### D-4 — `PROJECT_GUIDE.md` contradicts itself internally

Not merely stale — **self-contradictory in the same file**:

- line 3: pinned to a baseline of `4c6653e`; line 4: "last reviewed 2026-07-20"
- line 43: `` `Prisma v7 Production deployed: NO` ``
- line 342: "**`Prisma 7` in production: live and verified**", citing release `20260814T203732Z-19ebbb4`

Lines 43 and 342 cannot both be true. Confirms the charter's "mixes multiple historical
baselines" lead as a *measured* finding, not a suspicion.

### D-5 — Deployment state is structurally misplaced, not merely wrong

25 rot markers across the corpus. `src/modules/README.md` — the module **archetype** document —
carries three *headings* that are deployment-state classifications, and lists `redirects`,
`contact`, `preview`, `seo` as "implemented on dev, pending production release" under a release
freeze. Per the baseline, that capability is live in production.

Per the charter's own Documentation Truth Rule the fix is not to update the status text but to
**remove state reporting from code-adjacent docs entirely**. Adopted as a convention (§4.D) so
it is decided once rather than re-argued across 29 files.

### D-6 — Confirmed dangling reference: `docs/research/prisma-7-migration-2026-08.md`

**RESOLVED — the file does not exist anywhere in the program.** Four citations point at it:

| Citation | Claims |
| --- | --- |
| `PROJECT_GUIDE.md:42` | "the evidence is in … (decisions `P9-1`…`P9-9`)" |
| `src/prisma/prisma.service.ts:13` | "…, decision `P9-3`" |
| `src/prisma/README.md:84` | "details and reason in … (decision `P9-3`)" |
| `src/common/filters/prisma-error-metadata.spec.ts:14` | "… §17d" |

The API repo has no `docs/` directory at all. The nearest real artifact is
`eslammuatamed-docs/docs/research/prisma-7-upgrade-discovery.md` — a **different filename**, and
it contains **zero** `P9-*` tokens. So both the path and the decision IDs it cites are dead.

This is the clearest possible illustration of why `P9-*` is correctly classified as archaeology:
a reader cannot resolve it, by any route.

### D-7 — `D16-13` is cited as governing but does not exist in authoritative governance

`PROJECT_GUIDE.md:42` names `D16-13` as *the* governing decision that supersedes `D16-6`/`D16-10`
and authorizes the Prisma 7 upgrade.

Measured against the governing-docs repo, **with passing positive controls on every ref**
(`D10-6` → 8 files, `FR-DSH-051` → 5–10 files):

| Ref | `D16-13` resolves? |
| --- | --- |
| `origin/main` | **no** (0 files) |
| `origin/docs/api-frontend-v1-completion` (4 ahead of main, 0 behind — current-most) | **no** (0 files) |
| `refs/heads/docs/backend-audit-remediation` (unmerged, local-only) | yes — 5 files |
| highest `D16-*` recorded on the current-most branch | `D16-11` |

So a code-adjacent document cites a decision that exists **only on an unmerged local branch**.
Against authoritative governance, the recorded decision is still `D16-6` (which *defers* Prisma 7)
while production demonstrably runs Prisma 7.9.1.

**This is a governing-documentation gap, not a code-adjacent one.** Correcting it is stop
condition 3 (governing architecture decision) and is NOT this campaign's to fix. The campaign's
obligation is narrower and firm: **do not repeat `D16-13` as an authoritative citation** in any
learning document until it lands on the authoritative ref. Recorded as an owner-visible item (§8).

### D-8 — Archaeology IDs are unresolvable *against authoritative governance*

Stated precisely, because a first measurement of this was wrong and had to be corrected.

All sampled archaeology tokens (`C-5`, `C-6`, `B-2`, `B-3`, `F9-9`, `F9-13`, `P9-3`, `P9-9`,
`AD-7`, `OD-2`) resolve in **0** files on both `origin/main` and the current-most docs branch,
with controls passing on the same command. They *do* resolve — 8 to 28 ref-file hits each —
but only in historical-evidence artifacts on other, unmerged docs branches.

The correct claim is therefore **"unresolvable from the authoritative documentation a reader
would consult"**, not "unresolvable anywhere". That distinction is the justification for retiring
them from current-state docs, and it must not be overstated in the final report.

> **Instrument note.** The first run of this check returned 0 for all 17 tokens *and* 0 for the
> control, because zsh does not word-split an unquoted `$var` (unlike an unquoted `$(...)`), so
> `git grep` received the entire ref list as one malformed argument and every error was swallowed
> by `2>/dev/null`. The control is the only reason this was caught. Every resolution count in this
> ledger was re-taken with a passing positive control in the same command.

---

## 3. Instruments built

### `scripts/check-doc-provenance.mjs` — committed at `8ae1aba`

Dual-mode guard following the repo's existing `check-fts-migration-safety.mjs` idiom
(explicit allowlist, no environment or comment bypass, exit 1 on violation).

| Command | Behaviour |
| --- | --- |
| `npm run guard:docs` | CI gate. Fails only on classified archaeology + rot markers. Never fails on an unknown token. |
| `npm run guard:docs:audit` | Discovery. Reports every token grouped, including UNCLASSIFIED. Never fails. |
| `npm run guard:docs:selftest` | Positive control, 32 cases. |

**Proof the instrument discriminates.** The self-test caught three real defects in the script
itself before any reading was trusted:

1. `FR-DSH-051` — scoped requirement IDs went unmatched entirely (silent false negative on a
   whole governance family).
2. `foo_C-5_bar` — matched through an `_` the lookaround omitted (substring poisoning).
3. `**مؤجَّل** حتى` — missed because the literal ignored both Arabic combining marks and
   intervening markdown emphasis.

Two further false positives were found and fixed against the real corpus: `31536000` (a cache
`max-age`) read as a commit SHA, and `TEST-NET-2`/`TEST-NET-3` (RFC 5737 ranges) as unclassified.

Arabic cases are first-class in the suite: `\b` is undefined over Arabic codepoints, so the
matcher uses explicit `[^A-Za-z0-9_-]` lookarounds instead.

**Current reading: guard mode is RED on purpose** — 68 archaeology + 25 rot. That is the debt
the campaign retires; driving `npm run guard:docs` to green is a mechanical exit-gate criterion.

---

## 4. Accepted conventions

**A. Documentation ownership.** Governing docs (`../eslammuatamed-docs`) own "what must be true
and why". Code-adjacent docs own "how the current implementation works". This ledger and the
`.specify/` specs own "how we got here". No layer borrows another's content.

**B. Governance references are load-bearing.** `D<NN>-<N>`, `FR-*`, `NFR-*`, `PUB-*`, `DSH-*`
stay. They are how a reader discovers *why* a rule exists. Only campaign finding numbers go.

**C. Language.** Match the file. Existing Arabic documents stay Arabic prose + English
identifiers/paths/code. New learning artifacts adopt the same, matching the corpus beside them.
`CONTRIBUTING.md` and `CLAUDE.md` remain English — they are contributor/agent-facing process
docs, already English at baseline.

**D. No state reporting in code-adjacent docs.** No deployment status, release-freeze status,
feature completion status, SHAs, or PR numbers. Where a reader needs that, link the owner of the
fact. Enforced mechanically by `npm run guard:docs`.

**E. `.specify/` is exempt.** SpecKit specs are historical-evidence artifacts by design and keep
their campaign identifiers. The guard does not scan them.

**F. Comment policy.** Keep WHY, invariants, safety ordering, concurrency and transaction
boundaries, and attractive-but-wrong alternatives — length is not the test. Remove chronology,
finding IDs, and "previously we did…".

---

## 5. Claude ↔ Codex peer model

Both agents review each other continuously, not only at the final PR. A decision survives on
evidence, not on which agent proposed it. Disagreements are recorded here in the
Claim / Evidence / Alternative / Trade-off / Resolution form.

**Open design question (probe in flight):** whether Codex can reliably assess *Arabic technical
prose* learnability. A probe on one Arabic module README is running specifically to settle this.
If it cannot, lanes split deliberately — Codex on structure, prerequisites, code-claim
verification and test pedagogy; Claude on Arabic prose learnability — recorded here as a resolved
design decision rather than discovered mid-campaign.

**Recorded disagreements:** none yet.

---

## 6. Status

**Phase 0 — investigation. IN PROGRESS.**

Completed:
- [x] Baseline verified; `dev` already synchronized; campaign branch cut from it
- [x] Documentation corpus inventoried (27 code-adjacent docs, 18 modules, 274 source files)
- [x] Language composition measured
- [x] Identifier populations separated and quantified
- [x] Provenance guard built, positive-controlled, committed (`8ae1aba`)
- [x] Rot surface located to `file:line`

- [x] D-6 resolved (dangling reference confirmed); D-7 and D-8 established with controls
- [x] Module dependency graph + size/test signal extracted (input to the difficulty model)

In flight (delegated):
- [ ] **Governance lookup** — are `D17-5` / `D23-18` (the release freeze) still ACTIVE, or
      retired? Gates every edit that touches freeze language. Production having shipped is not
      the same fact as the decision being retired; if the freeze is still normative, deleting the
      citation would make code-adjacent docs contradict governing docs — which is stop condition 3,
      not a documentation fix.
- [ ] **Codex Arabic cold-reader probe** on `src/modules/redirects/README.md` — settles §5.

Not started: learning architecture, prerequisite graph, difficulty model, module template,
testing curriculum, flow traceability, comment cleanup execution, cold-reader exit gate.

## 7. Next actionable slice

1. Resolve the `D17-5`/`D23-18` freeze verdict; record as D-9.
2. Record the Codex-Arabic verdict in §5 and fix the review-lane split accordingly.
3. Then, and not before, design the learning architecture and prerequisite graph — the freeze
   verdict changes what `src/modules/README.md` and `PROJECT_GUIDE.md` are allowed to say, and
   both are load-bearing entry points for that architecture.
4. Retire the four dead `prisma-7-migration-2026-08.md` citations (D-6) — self-contained, no
   dependency on the freeze verdict, so it can run in parallel.

## 8. Owner-decision blockers

**OD-A — `D16-13` is cited as governing but is absent from authoritative governance (D-7).**
Owner-visible, not currently blocking: the campaign can proceed by declining to repeat the
citation. It becomes blocking only if the owner wants the governing docs corrected, which is stop
condition 3 and outside this campaign's scope.

The Arabic-language question was resolved from repository evidence rather than escalated (D-1).
If the freeze lookup returns "still active", that becomes a candidate blocker under stop
condition 3 and will be recorded here before any related edit.

## 9. Commits

| SHA | Slice |
| --- | --- |
| `8ae1aba` | `chore(docs): add a provenance guard for code-adjacent documentation` |
