# Campaign ledger — Backend Learnability, Documentation, and Code Comprehension

> **HOW TO RESUME.** Read this file first, before any chat context or memory. Then, in order:
> verify the baseline in §1 against live git; read the accepted conventions in §4 — they are
> binding and were argued once so they are not re-argued per file; read §8 and treat OD-A/OD-B as
> the owner's, never silently resolved; then start at §7 slice 1. Run
> `npm run guard:docs:selftest` before trusting any reading from the guard.
>
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

**RESOLVED — the file does not exist anywhere in the program.** **Five** citations point at it.
The count was recorded as four in phase 0; a repo-wide sweep at the start of slice 1 found a
fifth, in a file the guard structurally cannot read (see D-11).

| Citation | Claims | Guard sees it? |
| --- | --- | --- |
| `PROJECT_GUIDE.md:42` | "the evidence is in … (decisions `P9-1`…`P9-9`)" | yes |
| `src/prisma/prisma.service.ts:13` | "…, decision `P9-3`" | yes |
| `src/prisma/README.md:84` | "details and reason in … (decision `P9-3`)" | yes |
| `src/common/filters/prisma-error-metadata.spec.ts:14` | "… §17d" | path only, no token |
| **`prisma/schema.prisma:10`** | "… , decision `P9-1`" | **no — D-11 blind spot** |

The phase-0 count came from the guard's audit output, which is exactly why it was short: the
guard reads `.ts` under `src/` and `test/` plus a document allowlist, and `.prisma` is neither.
**A finding sourced from an instrument inherits that instrument's blind spots.**

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

### D-9 — A second archaeology family, hyphenless, larger than the first (found by peer review)

Codex's cold-reader probe flagged `F004` in `src/modules/redirects/README.md` as feature-history
framing. Verified, and it generalised: the guard's `TOKEN_RE` requires a hyphen, so an entire
family was invisible to it.

| Family | Occurrences |
| --- | ---: |
| SpecKit task id (`T1`…`T11`) | 58 |
| spelled feature id (`Feature 003`) | 23 |
| campaign phase (`Phase 12A`) | 10 |
| compact feature id (`F004`) | 5 |
| **total** | **96 across 39 files** |

Larger than the 68 hyphenated occurrences. **The instrument was reporting under half the debt**,
and it was peer review — not the instrument, and not its self-test — that exposed it. That is the
peer model doing exactly the job the charter assigns it.

**Repair bucket C — referential, not prefix.** `C-5:` is a citation prefix and strips cleanly.
These are used *referentially*: `media-processing.types.ts:4` reads "so **T6** persists it without
a mapping", where `T6` stands in for a component with a real name. Deleting the token leaves the
sentence subject-less. The repair is to name the actual component — which makes this bucket the
highest-value learnability work found so far, not merely the largest.

### D-11 — The guard cannot see 7 comment-bearing files, and one held a slice-1 target

Found by the repo-wide sweep that opened slice 1, not by the guard. `docFiles()` matches a
document allowlist; `sourceFiles()` walks **only** `src/` and `test/` and keeps **only** `.ts`.
Everything else in the repository is unreadable to it. Measured with a passing positive control
(the same expression finds `C-5`/`B-2` in `src/modules/projects/projects.service.ts`):

| File | Archaeology occurrences | Note |
| --- | ---: | --- |
| `prisma/schema.prisma` | 1 (`P9-1`) | **a slice-1 target the guard never reported** |
| `tsconfig.ops.json` | 3 (`F9-13`, `F9-14`) | |
| `.github/dependabot.yml` | 3 (`OD-1`) | |
| `.github/workflows/deploy.yml` | 2 (`F9-13`, `F9-14`) | |
| `prisma.config.ts` | 1 (`F9-13`) | `.ts`, but outside `src/`+`test/` |
| `prisma/sync/allowlist.spec.ts` | 1 (`C-1`) | `.ts`, but outside `src/`+`test/` |
| `.github/workflows/codeql.yml` | 1 (`OD-3`) | |
| **total** | **12** | invisible to `guard:docs` in both modes |

`scripts/check-doc-provenance.mjs` also matches 13 times; those are the guard naming its own
token families and are a legitimate self-reference, excluded above.

**Same shape as D-9, reached by a different route.** D-9 was the guard's *pattern* missing a
family; D-11 is the guard's *file selection* missing whole files. Both were found from outside
the instrument — D-9 by peer review, D-11 by a repo-wide sweep. Neither the guard nor its
self-test could have surfaced either: a self-test proves the matcher, never the corpus.

**Consequence for the exit gate.** `npm run guard:docs` going green is now demonstrably weaker
than believed: green means "clean in `.ts` under `src`/`test`, plus the document allowlist",
not "clean in the repository". Convention 4.D's blind-spot note (§4.D) must be extended, and
widening the guard's file selection is queued as its own slice — an instrument change, kept out
of a content slice so a self-test regression cannot hide inside a documentation diff.

**Not yet decided:** whether `OD-1`/`OD-3` in CI config are archaeology at all. They read as
live *owner-decision* pointers in operational config, not as completed-campaign findings, and
CI config is arguably not a "code-adjacent learning document". Deliberately left open rather
than swept in; the guard-widening slice must answer it before flagging those files.

### D-10 — The release freeze was lifted for WEB ONLY; governance still records the API as frozen

The gating question for every edit touching freeze language. Answered from the authoritative ref
`origin/docs/api-frontend-v1-completion` (4 ahead of docs `origin/main`, 0 behind).

Both decisions were updated on `2026-07-27` — as an explicit **lifecycle update, not a new
decision** ("تحديث دورة حياة لهذا القرار، لا قرار جديد").

- `docs/17-git-workflow.md:172` (D17-5) — "**الرفع يخصّ الويب وحده**: `main` في الـ API ما يزال
  عند `40a0c91` ولم يُمسّ." → *"the lift applies to Web alone: `main` in the API is still at
  `40a0c91` and has not been touched."*
- `docs/23-deployment.md:378` (D23-18) — "**الرفع للويب وحده** — `main` في الـ API ما يزال عند
  `40a0c91` ولم يُمسّ."

**So, as literally recorded, the API freeze is STILL ACTIVE.** But the fact it rests on is
obsolete. Measured against the API repo:

| Governance records | Reality |
| --- | --- |
| API `main` frozen and untouched at `40a0c91` | API `main` is `9af1aac` |
| no `dev → main` promotion | **53 commits / 11 merges** past `40a0c91`, `40a0c91` is an ancestor |
| no production deploy | production release `20260817T183604Z-9af1aac` is live |

Governance has not been updated to record the API unlock that demonstrably happened. Same shape
as D-7: the governing layer lags reality.

**This does NOT block the campaign**, because convention 4.D already forbids code-adjacent docs
from carrying freeze or deployment language at all. Removing those citations is correct under
*both* readings — it neither asserts "frozen" (contradicting reality) nor "lifted" (contradicting
governance). The verdict only constrains what a document may *additionally* claim, and the answer
is: nothing about production state, from either direction.

**Independent peer confirmation, plus three findings I did not have.** A second agent reached the
same verdict from the decision rows, and added evidence I verified myself before accepting:

- **Even more direct than the decision rows.** `docs/17-git-workflow.md:117` —
  "**تجميد `dev → main` في الـ API ما يزال فعّالًا.**" (*"the API's `dev → main` freeze remains in
  effect"*), and `docs/23-deployment.md:142` — same sentence plus "`main` عند `40a0c91` ولم يُمسّ،
  ولم تُجرَ أي ترقية ولا نشر إنتاج" (*"…untouched; no promotion and no production deployment took
  place"*).
- **The two authoritative refs are byte-identical** in `docs/17-git-workflow.md` (verified by
  `diff`), so there is no ref-divergence escape hatch. Confirmed.
- **Governance contradicts ITSELF on the authoritative refs.** `docs/24-roadmap.md:94`, present
  and identical on *both* `origin/main` and `docs/api-frontend-v1-completion`, records
  "| الإنتاج (API `main`) | `572b0e3` — إصدار `20260806T093803Z-572b0e3` |" — an API **production
  release**. So the same authoritative ref that states no API production deployment took place
  also records one. Verified independently.
- **No supersession exists on any ref.** A sweep for lift language across all branches returns
  only the 2026-07-27 Web-lift entries — a real negative result, not a search gap. The unmerged
  branches affirm the opposite: "D17-4 and D17-5 and their Arabic notes are **untouched**".

**"Freeze active" is therefore the governing TEXT, not the factual state, and the text is not
self-consistent.**

**Operational consequence that outlives this campaign.** `D17-5`/`D23-18` specify their own lift
mechanism — sequential *explicit owner authorization*, per action. Where that mechanism was
exercised it was recorded as narrowly scoped ("approval scoped to this deployment only"). So on
either reading of the freeze, **no future `dev → main` promotion or production deploy is
pre-authorized; each one requires fresh explicit owner authorization.** This campaign will
therefore stop at a PR and must not promote or deploy — stop condition 10, now evidenced rather
than assumed.

Recorded as owner-visible **OD-B** (§8). Reconciling the governing decisions is stop condition 3.

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
fact.

*Scope of enforcement, stated precisely.* `npm run guard:docs` enforces this in **documents
only**. It does **not** check source comments for rot, does not verify that a governance token
actually resolves, and does not judge whether a kept comment is a good comment. Those three are
manual review classes — see the "WHAT THIS GUARD DOES NOT COVER" block in the script.

This matters concretely: D-3 Bucket B (`test/prisma-error-mapping.e2e-spec.ts`, a stale
future-tense claim about work already completed) lives in a source comment and is **invisible to
the guard**. Driving `guard:docs` to green will not retire it. Green is a necessary exit
criterion, never a sufficient one.

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

**RESOLVED — no lane split needed.** The probe (`src/modules/redirects/README.md`) settled it:
Codex assesses Arabic technical prose reliably. The evidence is not its self-assessment but its
output — it caught a genuine *semantic* defect that a fluency-only read would miss, by comparing
the Arabic phrasing against the English source comment it was compressing
(`README.md:27` vs `redirect.service.ts:81-85`: "slug مُحرَّر" reads as "the slug being edited
now", when the actual cause is a *different entity* reusing a slug freed by the rename).

So both agents review both structure and Arabic prose. Lanes divide by artifact, not by language.

**Probe also validated the review format.** On one 48-line README it produced 2 MAJOR truth
defects, 1 MAJOR rot finding, 3 prerequisite gaps and 3 omissions, every claim carrying file:line
on both sides. Two are worth carrying forward as *general* checks, because neither is specific to
`redirects`:

- **Response-envelope omission.** The README documents the response as `{ toPath }`, but every 2xx
  is wrapped by the global `ResponseEnvelopeInterceptor` into `{ data: { toPath } }`. The entity
  file's own comment says so; the README does not carry it over. A reader following only the
  document gets the body shape wrong. **Check every module README for this.**
- **Compression that drops the causal "why".** The doc kept *what* the code does and lost *why*,
  which is precisely the content a learning document exists to carry.

**Recorded disagreements:** none yet. Codex's findings were verified and accepted, and its `F004`
flag directly produced D-9.

---

## 6. Status

**Phase 0 — investigation. CLOSED.** Every gate that blocked design work is answered; no
investigation item remains open. Phase 1 (execution) begins at §7 slice 1.

Completed:
- [x] Baseline verified; `dev` already synchronized; campaign branch cut from it
- [x] Documentation corpus inventoried (27 code-adjacent docs, 18 modules, 274 source files)
- [x] Language composition measured
- [x] Identifier populations separated and quantified
- [x] Provenance guard built, positive-controlled, committed (`8ae1aba`)
- [x] Rot surface located to `file:line`

- [x] D-6 resolved (dangling reference confirmed); D-7 and D-8 established with controls
- [x] Module dependency graph + size/test signal extracted (input to the difficulty model)

- [x] Codex Arabic cold-reader probe returned; §5 question resolved, D-9 opened

- [x] **Freeze verdict resolved (D-10)** — Web-only lift; API recorded as still frozen, on an
      obsolete fact. Does not block: convention 4.D removes the language either way.

**Phase 1 — execution. IN PROGRESS.** Slice 1 landed (D-6 retired; D-11 opened as a
by-product). See §7 for the live slice queue.

Not started: learning architecture, prerequisite graph, difficulty model, module template,
testing curriculum, flow traceability, cold-reader exit gate.

## 7. Slice queue

Phase 0 is closed: every gate that blocked design is now answered.

- [x] **Slice 1 — DONE.** Retire the dead `prisma-7-migration-2026-08.md` citations (D-6).
      Five sites, not the four recorded; the fifth came from a repo-wide sweep and opened D-11.
      Guard archaeology 68 → 64 (the fifth was never in the 68 — it is invisible to the guard).

- [ ] **Slice 1b — the remaining `D16-13` citations.** Slice 1 removed the citation at
      `PROJECT_GUIDE.md:42` because it sat in the same sentence as a dead pointer. Three more
      remain and carry the same OD-A defect, so the corpus is currently inconsistent:

      | Site | How it cites `D16-13` |
      | --- | --- |
      | `PROJECT_GUIDE.md:382` | "`D16-6` (with `D16-10`) is **superseded** by `D16-13`" — an explicit authority claim |
      | `prisma/README.md:81` | "`7.9.1`, `D16-13`" — version attribution |
      | `prisma/schema.prisma:214` | "7.9.1 (D16-13): without it, `migrate dev` emits …" — version attribution |

      §8's obligation is binding and unconditional: **do not repeat `D16-13` as an authoritative
      citation.** Confirmed against the docs checkout during slice 1 — doc 16's highest recorded
      decision is `D16-11`, and doc 16 states "Prisma remains pinned to `6.19.3` under `D16-10`".
      So no substitute citation exists; remove without replacement, as in slice 1.
      `PROJECT_GUIDE.md:382` also carries state reporting — land it with slice 2 to avoid two
      passes over one line.

- [ ] **Slice 2.** Strip state reporting from `src/modules/README.md` and `PROJECT_GUIDE.md` per
      convention 4.D — unblocked by D-10, and both are load-bearing entry points for the learning
      architecture, so they must be true before that architecture is designed on top of them.

- [ ] **Slice 3.** Repair bucket C (D-9) on the media/articles/projects cluster — the 58 SpecKit
      task ids that name components by task number. Highest learnability value found.

- [ ] **Slice 4 — widen the guard's file selection (D-11).** An instrument change, deliberately
      kept out of every content slice: a self-test regression must not be able to hide inside a
      documentation diff. Must also settle whether `OD-1`/`OD-3` in CI config are archaeology.

- [ ] **Deferred, tracked here so it is not implicit:** the `F9-*` family (5 sites —
      `all-exceptions.filter.ts:108`, `all-exceptions.filter.spec.ts:84`,
      `prisma-error-metadata.ts:3`, `prisma-error-metadata.spec.ts:6`,
      `test/prisma-error-mapping.e2e-spec.ts:148`). Slice 1 rewrote the comment block directly
      below `prisma-error-metadata.spec.ts:6` and deliberately did **not** strip the `F9-9` on it:
      the family is coherent and must be retired in one consistent pass, not partially.
      Also deferred: D-3 bucket B, the stale future-tense claim at
      `test/prisma-error-mapping.e2e-spec.ts:25` ("Phase 10 B-2 **will** delete …" — already
      done). Invisible to the guard by design (§4.D), so green will never retire it.

- [ ] **Then** design the learning architecture, prerequisite graph and difficulty model.

## 8. Owner-decision blockers

**OD-B — the governing record of API release state is wrong AND internally contradictory (D-10).**
`D17-5`/`D23-18` state the freeze lift was Web-only and that API `main` "has not been touched" at
`40a0c91`; `main` is `9af1aac`, 53 commits and 11 merges later, production live. Worse, the same
authoritative refs record an API production release at `docs/24-roadmap.md:94`, contradicting
their own "no production deployment took place". Not blocking this campaign (4.D removes the
language either way), but two governing documents disagree with each other and both disagree with
production. Reconciling them is stop condition 3.

*Carried forward:* each `dev → main` promotion and each production deploy needs fresh, explicitly
scoped owner authorization. This campaign ends at a PR.

**OD-A — `D16-13` is cited as governing but is absent from authoritative governance (D-7).**
Owner-visible, not currently blocking: the campaign can proceed by declining to repeat the
citation. It becomes blocking only if the owner wants the governing docs corrected, which is stop
condition 3 and outside this campaign's scope.

The Arabic-language question was resolved from repository evidence rather than escalated (D-1);
it is not an owner decision and is not pending.

**Neither OD-A nor OD-B blocks code-adjacent learnability work, and neither may be silently
resolved.** They are recorded governing-document decisions belonging to the owner. The campaign's
only obligation is to avoid propagating either error: do not repeat the `D16-13` citation as
authoritative, and do not assert any production/freeze state in a code-adjacent document.

## 9. Commits

Branch `campaign/backend-learnability`, all from baseline `9af1aac`.

**Phase 0 changed no application code.** Verified at `40218b4`: `git diff --stat 9af1aac..40218b4`
is 3 files, 940 insertions, **0 deletions**, and `git diff --name-only` matched nothing under
`src/`, `test/` or `prisma/`. The three files are this ledger, the new
`scripts/check-doc-provenance.mjs`, and 3 added npm-script lines in `package.json` wiring it up.

**That claim is scoped to phase 0 and must not be restated for the branch.** Slice 1 is the first
commit to touch `src/` and `prisma/`, so the branch-wide form of the sentence is now false. The
standing claim from slice 1 onward is narrower and is re-proved per slice:

**Slice 1 changed comments only.** Evidence taken on the slice-1 diff:

| Check | Result |
| --- | --- |
| `git diff` non-comment, non-prose lines | none — every changed line is a `//` comment or Markdown prose |
| files touched | 5 (`PROJECT_GUIDE.md`, `prisma/schema.prisma`, `src/prisma/README.md`, `src/prisma/prisma.service.ts`, `src/common/filters/prisma-error-metadata.spec.ts`) |
| diffstat | 8 insertions, 8 deletions |
| `npx prisma validate` | exit 0 — "The schema at prisma/schema.prisma is valid" (`schema.prisma` was edited) |
| `npm run typecheck` | exit 0 |
| `npx jest src/common/filters/prisma-error-metadata.spec.ts` | exit 0 — 18/18 (the edited spec) |
| `npm run guard:docs:selftest` | 43/43 — instrument unchanged and still discriminating |
| `npm run guard:docs` archaeology | 68 → **64**, exactly the 4 guard-visible tokens removed |
| dead-path sweep, repo-wide incl. non-`.ts`/`.md` | **0** remaining outside this ledger |

No application behaviour, test assertion or API contract changed.

| SHA | Commit |
| --- | --- |
| `8ae1aba` | chore(docs): add a provenance guard for code-adjacent documentation |
| `1ad5f3a` | docs(campaign): open the backend-learnability ledger |
| `7bde4d7` | docs(campaign): record the reference-integrity findings (D-6, D-7, D-8) |
| `64b50e5` | docs(campaign): state the guard's blind spots, and narrow the convention to match |
| `6b4af9a` | chore(docs): catch the hyphenless campaign-identifier families |
| `fa18e7d` | docs(campaign): record D-9 and resolve the Codex-Arabic review question |
| `6e374dc` | docs(campaign): resolve the freeze verdict (D-10) — Web-only lift, API still recorded frozen |
| `32bf4cc` | docs(campaign): strengthen D-10 with independently verified peer findings |

**Pushed to `origin/campaign/backend-learnability` as a durability checkpoint only.** No PR was
opened. `dev` and `main` were not touched. Nothing was deployed.
