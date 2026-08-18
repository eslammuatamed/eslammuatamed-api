# Campaign ledger — Backend Learnability, Documentation, and Code Comprehension

> **HOW TO RESUME.** Read this file first, before any chat context or memory. Then, in order:
> verify the baseline in §1 against live git; read the accepted conventions in §4 — they are
> binding and were argued once so they are not re-argued per file; read §8 and treat OD-A/OD-B as
> the owner's, never silently resolved; read §6 for where the campaign actually stands. Run
> `npm run guard:docs:selftest` before trusting any reading from the guard.
>
> ---
>
> ## PHASE 1 IS CLOSED. PHASE 2 STARTS HERE.
>
> **Phase 1 (corpus cleanup) is complete and its exit gate is satisfied.** Archaeology 68 → 0,
> rot 25 → 0, campaign phrases 96 → 5 (all five deliberate keeps, each with a recorded reason).
> `guard:docs` is GREEN. Both phase-1 obligations — the peer passes and the response-envelope
> sweep — are CLOSED, not carried forward. Nothing from phase 1 is owed except the conventions in
> §4 and the instrument rules below.
>
> **Read §0 first, then verify it** (zero-trust, per the campaign's own rule):
> ```
> git -C <worktree> rev-parse origin/campaign/backend-learnability   # campaign tip
> git -C <worktree> rev-parse origin/dev origin/main                 # both MUST be 9af1aac…
> npm run guard:docs:selftest && npm run guard:docs                  # 43/43, then GREEN
> ```
> §0 carries the commit count and the tip. The §9 table is a point-in-time list and goes stale by
> construction — `git log 9af1aac..HEAD` is the only authority on what landed.
>
> **⚠ THIS BLOCK STATES NO STATUS, DELIBERATELY.** Four times now, a status claim written here or
> in §6 was true when written and false a few commits later. Status lives in **§0 — CURRENT STATE**
> and nowhere else. If you find a count, a phase, a "final", an "authority" or a review verdict
> anywhere outside §0, treat it as historical narrative fixed at its commit, not as current fact.
>
> **Phase 2 is the learning architecture** — prerequisite graph, difficulty model, module
> template, testing curriculum, flow traceability, cold-reader exit gate. It is a DESIGN job.
> It was deliberately not begun in the session that finished phase 1, so that it starts from a
> clean corpus and a fresh context with this file as its only input.
>
> **The campaign ends at a PR.** No `dev → main` promotion and no production deploy are
> authorized, under either reading of the freeze (D-10, §8).
>
> ### Four rules phase 2 inherits, each paid for
>
> 1. **Green gates are not evidence that prose is true.** The peer review caught four comments
>    naming the wrong class; typecheck, 1273 tests, a green guard and an unchanged
>    compiler-emitted-JS diff all passed over it, because a comment naming the wrong class is
>    still a comment. Any phase-2 artifact making claims about the code needs a reader, not a run.
> 2. **Substituting a specific identifier for a vague one must be verified PER SITE, never per
>    family.** That is exactly how the wrong-class defect was introduced (§5).
> 3. **No single instrument's clean reading is evidence.** The guard has been blind four ways
>    (D-9 pattern family, D-11 file selection, D-15 token boundary, D-16 alphabet). A
>    hand-written sweep was blind twice, once in the opposite direction to the guard and once in
>    the same direction. A self-test proves the matcher, never the corpus.
> 4. **A sweep only finds the alphabet its author thought to write (D-16).** Three blind spots
>    were caught by a better sweep; the fourth could not be, and was found by following a citation
>    into a file and reading it. **An exit gate cannot be a sweep result alone.**
> 5. **Retiring a family is not evidence about the family beside it (slice 5c).** The β family was
>    retired without checking for siblings; α was sitting in the same files, and the peer found 27
>    more occurrences across four shapes. **When you find a marker family, enumerate the space it
>    belongs to before declaring it retired** — if `β`, look for `α` and `γ`; if `9C-8`, look for
>    `9C-*` and `9D-*`; if `Stage 2C`, ask whose stages those are.
> 6. **A "does not resolve" verdict must state its scope, and the scope is the whole governing
>    repository (D-17).** `R1`–`R15` returned 0 files under a `docs/*.md` pathspec with a passing
>    control, and are in fact live governance defined in `content/owner-profile.md`. **A positive
>    control proves the command runs, not that the scope is right.** Nearly deleted a live
>    governance family — the exact catastrophe D-2 exists to prevent.
>
> **And the one that outranks all six:** the peer review found what six slices of instruments and
> author verification did not, twice — a MAJOR wrong-class defect, then a 27-occurrence family
> containing two outright false claims. **Do not let the peer lane lapse in phase 2**, and do not
> read a green gate as agreement with it.
>
> **What this file is.** The durable control plane for this campaign. A fresh session must be
> able to resume from this file alone, without reconstructing anything from chat history.
> It is historical evidence, not learning documentation — it is allowed to carry SHAs, PR
> numbers and campaign chronology, which the documents it governs are not.

---

## 0. CURRENT STATE — the ONLY place status lives

**Rule that creates this section.** A peer audit found six MAJOR contradictions in this file, and
every one was a claim that was true when written and never revisited when superseded — the fourth
time this ledger committed the defect the campaign exists to remove. The cause was structural, not
careless: status was written in five places (resume block, §3, §6, §7b, §9), so every change had
to be made five times or the file lied. **It is now written in one place. Everything outside this
section is historical narrative, fixed at the commit that wrote it, and may be stale by design.**

*This section is updated at every checkpoint, before the commit that makes it true — never after.*

| Fact | Value |
| --- | --- |
| Branch | `campaign/backend-learnability` |
| Baseline | `9af1aac` (`origin/dev` = `origin/main`, unchanged and untouched) |
| Commits on branch | see `git rev-list --count 9af1aac..HEAD` — do not trust a number typed here |
| Phase 1 (corpus cleanup) | **CLOSED.** archaeology 68→0, rot 25→0, phrases 96→5 (all deliberate keeps) |
| Phase 2 (learning architecture) | **COMPLETE.** difficulty model §9b · measurements §10 · reading order · status-code section · README template · testing curriculum · flow trace — all peer-reviewed |
| Cold-reader gate (§11) | **RUN TWICE.** Run 1: 9 of 10 scoreable correct, Q2 unscored (defective question); produced 4 documentation defects — all fixed (§11c). **Run 2: 10/10 main + 6/6 §C = 16/16 — the scoring gate PASSES** (§11d) |
| Open-ended assessment | **THE PRODUCTIVE INSTRUMENT, BOTH RUNS.** Run 2 scored 16/16 *and* found a real prerequisite defect no question touched: the vocabulary table sat at §15 while §2 and §5 already relied on it. Verified, moved to the head of the guide, peer-reviewed |
| Cold-reader Run 3 | **Gate 16/16; targeted regression FAILED on `Controller`** (used inside the vocabulary block before it was defined) **+ 5 open-ended findings, all confirmed**, two worse than reported. All repaired across two peer rounds (§11e) |
| Cold-reader Run 4 | **Regression FAILED on the block's *inside*** — 3 sites reported, a 4th by sweep, a 5th by a mechanical check. **6 confirmed open-ended defects + 2 experiment artifacts.** Peer lane then ran **four rounds** on the repair — 7+1 → 5+2 → 0+1 → **CLEAN** — and four of round 2's five MAJORs were defects the *repair* introduced (§11f) |
| Cold-reader Run 5 | **Vocabulary block PASSES** — read top-to-bottom, no row needing a later row. **Q3 not clean one level up:** `data-mapper`/`repository` used in the guide, defined only in a document read after it. **6 confirmed open-ended defects**, 0 artifacts; a 7th quantifier found by sweep. Peer lane **3 MAJOR → 1 → CLEAN** (§11g) |
| Cold-reader Run 6 | **PREREQUISITE-ORDER REGRESSION CLOSED** — linear read clean, all fifteen rows clean, every run-5 repair and control answered. Unscored pass found **3 confirmed defects**, 0 artifacts: an upload guarantee the code does not make (inherited from a false source comment), a category word, and a delegated dependency read as absent behaviour (§11h) |
| Cold-reader Run 7 | **NARROW PASS on the taught concepts** — compensation as best-effort, orphan object vs orphan row, delete `204` vs storage cleanup, transformed image vs raw `PDF`, delegated locale validation, the three size/dimension limits, `P2002`→`422`, reading order, env authority: all answered correctly. The **unscored** pass produced the round's whole yield: **F1/F2/F3/F6 confirmed defects, F5 a narrow pointer gap, F4 an experiment artefact** (§11i) |
| Campaign exit gate | **NOT YET SATISFIED — one item.** A narrow Run-8 cold regression from the exact final head, over the concepts this round changed: public-endpoint taxonomy, byte size vs pixel dimensions, locale enabled-validation vs no-fallback ownership, boundary vs service/DB enforcement, the budget-authority pointer, unchanged controls, and an unscored open pass |
| Open contract gap | `POST /admin/media` can return `400` undeclared in `openapi.json`. **Owner-facing**, needs the doc 16 §3 contract flow — not this branch (§11e) |
| PR | **OPEN: #86**, base `dev` (never `main`), head `campaign/backend-learnability`. State is READ, not stamped — see the note below |

**CI state is READ, never stamped here.** The authority is `gh pr checks 86` together with the
step arrays of its jobs (`gh api repos/:owner/:repo/actions/jobs/<id>`). Gate on `mergeStateStatus:
CLEAN` **and** on `steps`, never on a check count and never on the green tick: a check name appears
twice per `SHA` (once for the push run, once for the PR run), and a `success` conclusion over an
**empty** step array is a job that never ran.

*Why nothing is stamped.* This entry twice carried a `SHA`-pinned CI reading whose stated validity
depended on a prediction — "every later commit touches `.campaign/` only". Both times a later commit
did not, and the sentence became false without anyone editing it. **A sentence whose truth depends on
what future commits will do is this campaign's signature defect wearing a timestamp.** A CI reading
measures a tree; it belongs to that tree, not to this file.

**Local gates are re-run per round and recorded with the round**, not here: `guard:docs:selftest`
(43/43) → `guard:docs` (GREEN) → the relative-link checker, which is only evidence *after* its
negative control passes (§11e — this instrument has lied once already).

**One historical measurement is kept, because it is not reproducible from a later head.** At
`2356fb6`, `E2E (Postgres)` ran with `steps=11, all success`. That is worth keeping independently of
any later commit: the e2e suite needs a live PostgreSQL this worktree has no credentials for, so
until that run, **34 e2e suites had never been executed against any of this campaign's changes.** The
campaign edits comments inside those very files (race barriers, transaction-semantics,
prisma-error-mapping), and "a comment edit cannot break a test" was an argument until that run made
it a measurement. Later heads re-ran the same lane and also passed; the *first* run is the one that
changed what was known.

**Why base `dev` and not `main`.** `main` is the repository's default branch, so `gh pr create`
would have targeted it by default. `dev → main` is the boundary that auto-deploys Production
(D-10, §8), and no promotion or deploy is authorized by this campaign. Targeting `main` would have
staged exactly the action the charter forbids — **the default was the wrong answer, and defaults
are not authorization.**

### Review debt — commit-scoped, and deliberately not aggregated

**A peer verdict covers the tree it was taken on and nothing after it.** This table records which
source-touching commits have a peer round and *where that round is written down*, so a reader can
check the record instead of trusting a summary. Derive the commit list mechanically — never from
this table: `git log 9af1aac..HEAD --name-only` and drop the commits touching only `.campaign/`.

| Source-touching commit(s) | Round recorded at | Verdict |
| --- | --- | --- |
| Baseline → `eff70d3` (slices 1–5c) | §5, §5b, §5c | reviewed; findings resolved |
| `2aa031f` archetype status-code section | §5b | 1 MAJOR (pipe order) + 2 omissions → fixed |
| `1fde962` the fix for that MAJOR | §5b | CLEAN |
| `a799dd5` reading order | §10c | CLEAN (2 MINORs, both acted on) |
| `29b389a` README template | §10b (the survey; the verdict itself is recorded only here) | CLEAN — every count independently re-derived |
| `e9ea4f8` two MINOR wording fixes | — (verdict recorded only here) | 1 MINOR (unswept sibling number) → fixed |
| `62e055a` pipe-order family sweep | §5c | itself the fix for a peer finding; **no separate round recorded on the fix** |
| `ea06eed` testing curriculum | §10d | 1 MAJOR (DI undercount) + 1 MINOR → fixed |
| `e12bdfe` those fixes | §10d | CLEAN |
| `d069828` flow trace | §10e | CLEAN |
| `0262e5b` · `846dc73` run-1/run-2 repairs | §11c, §11d | 9 findings / 3 MAJOR (§11c); first attempt **rejected** and redone (§11d) |
| `4f7f10d` · `f3becd8` run-3 repairs | §11e | two rounds — 4 MAJOR, then 5 more |
| `b6f17b0` · `21c20f1` run-4 repairs | §11f | **7 MAJOR + 1 MINOR**, each re-verified here before action |
| `87839d6` the fixes for those | §11f | **5 MAJOR + 2 MINOR** — four of the five were introduced *by* the fixes; one peer count pushed back on with an enumeration |
| `483c9c5` · `d3455d5` the fixes for those | §11f | **0 MAJOR + 1 MINOR** |
| `2fd62e2` the fix for that MINOR | §11f | **CLEAN** |
| `d8f56c8` run-5 repairs | §11g | **3 MAJOR**, each re-verified here before action |
| `9163639` · `0b62767` the fixes for those | §11g | **1 MAJOR** — a universal its own next clause refuted |
| `a602f71` the fix for that | §11g | **CLEAN** |
| `3a78c3d` the `idempotent`/`upsert` glosses | §11g | **CLEAN** — with an exhaustive re-sweep of the term class |
| `64f36c5` · `7d4bc0b` run-6 repairs | §11h | **2 MAJOR** — both against text written in this round |
| `f7dfe37` · `56d3681` the fixes for those | §11h | **2 MAJOR** — one an absolute replacing an absolute |
| `49c611b` the fixes for those | §11h | **2 MAJOR + 2 MINOR** — including a stale comment 20 lines above the repaired one |
| `689ff08` · `59d5a57` the fixes for those | §11h | **2 MAJOR + 8 MINOR** — from the first *family-scoped* round |
| `a3e993f` the family sweep | §11h | **0 MAJOR + 9 MINOR** |
| `a738cb9` the nine narrowings | §11h | **0 MAJOR + 7 MINOR** |
| `716a7c5` those seven | §11h | **0 MAJOR + 1 MINOR** — an enumeration missing three of eight |
| `e6d6b01` that one | §11h | **CLEAN** |
| `bf42300` run-7 repairs (F1/F2/F3/F5/F6 + the one `.ts` comment) | §11i | **20 MAJOR + 1 MINOR** — 12 out of scope (`.specify/`), 1 already fixed, **5 in-corpus**, each a sibling of a family repaired at only its named site |
| `a2dfe62` the fix for the `@IsEnum` universal I introduced | §11i | self-caught before the peer reported it; covered by the round-2 pass |
| `80aae0f` the fixes for round 1's five | §11i | **7 MAJOR** — five of them against text those very fixes wrote |
| `587f9e0` the fixes for round 2's seven | §11i | verdict recorded with the final head below |
| commits touching only `.campaign/` | — | not source-touching |

**The campaign-wide finding total is NOT reconstructible from these records, so it is not stated.**
A figure — "4 MAJOR + 6 MINOR, all resolved" — stood here for several rounds and was already
contradicted by this same file: §11c alone records nine findings with three MAJOR, and §11e records
four MAJOR and then five more whose severity split was never written down. Producing a precise total
now would mean inventing the splits nobody recorded.

What the durable records *do* support, and no more:

| Quantity | Value | Basis |
| --- | --- | --- |
| MAJOR findings | **≥ 11** | 4 (slice range) + 3 (§11c) + 4 (§11e round 1) |
| Findings, all severities | **≥ 28** | 10 (slice range) + 9 (§11c) + 9 (§11e, both rounds) |
| §11d round | **UNRECORDED** | the section states the first attempt was rejected; it gives no count |
| §11e round 2 severity split | **UNRECORDED** | "five more" — severities not written down |

*The rule this encodes:* **an aggregate must never be more precise than the records beneath it.** A
tidy total that cannot be traced to a round is worse than an explicit `≥`, because it reads as
audited. Three of the MAJORs on record were invisible to every gate — a comment naming the wrong
class, an inverted causal mechanism, and a false count — because none of them are behaviour.

**Gates the PR, not phase 2.** Do not discharge by author verification (§5 records why that is
strictly weaker).

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

### D-17 — NEAR MISS: the `R*` family is live governance, and a too-narrow scope almost retired it

Applying D-16's new "enumerate the space" rule turned up `R5`, `R7`, `R10`, `R15` in
`prisma/content/canonical/site-settings.ts`, `prisma/seed.ts`, `prisma/sync/allowlist.spec.ts` and
`test/about-content.e2e-spec.ts` — cited exactly like decisions ("**R10 superseded R5 on
2026-07-29**", "decision **R15** (2026-08-05) closed the question"). Shape, phrasing and
supersession language all matched the archaeology families this campaign has been retiring.

**First measurement said retire them.** `git grep` for `R5`/`R10`/`R15` across
`docs/*.md` on both authoritative refs returned **0 files**, with the control passing (`D10-6` → 8).
By the standard applied to `OD-1`/`OD-3` in slice 4, that is a retire verdict.

**It was wrong, because the scope was wrong.** Re-run without the `-- 'docs/*.md'` pathspec, the
family resolves in `content/owner-profile.md` — present on **both** authoritative refs — which
defines **`R1` through `R15`**, `R5` included (9 occurrences). They are live, resolvable
governance in the sense of §4.B: a reader *can* follow them, just not into `docs/`.

**KEEP the entire `R*` family.** No edit was made.

**Why this is the most dangerous near-miss of the campaign.** D-2 is the ledger's most important
constraint — governance references outnumber archaeology 12 to 1, and a naive purge would destroy
the repository's traceability into its own governing decisions. This is exactly that failure,
reached not by naivety but by a *disciplined* method with one wrong parameter: the pathspec.
Every other check in this campaign that used `-- 'docs/*.md'` shares the flaw.

**That "harmless elsewhere" claim was then verified rather than asserted**, because asserting it
is exactly the move D-17 exists to condemn. Re-run at **full repository scope**, both authoritative
refs, binaries excluded, control passing (`D10-6` → 8 files):

| Family | Files at full scope, both refs |
| --- | ---: |
| `D16-13` (OD-A) | 0 |
| `OD-1`, `OD-3` (slice 4) | 0 |
| `P9-3`, `C-5`, `F9-9`, `AD-7`, `B-2` (representatives of every retired family) | 0 |

So every retirement this campaign made stands at the correct scope. **Only the `R*` verdict was
scope-dependent, and it was caught before an edit was made.**

**Rule: a "does not resolve" verdict must state the search scope, and the scope must be the whole
governing repository — never one directory.** A negative result is only as wide as where you
looked, and a positive control proves the command runs, not that the scope is right. The control
passed here and the answer was still wrong.

### D-16 — A whole family in a non-Latin alphabet, invisible to all three instruments

The last family found, and the one that best explains why "the guard is green" was never the
exit criterion. `11B-β1`, `11B-β2`, `β-1`, `β1`, `β2`, `β-3` — **13 occurrences across 5 test
files**, campaign-phase chronology exactly like `Phase 12A`.

**Every instrument built in this campaign was blind to it, for three independent reasons:**

| Instrument | Why it missed the family |
| --- | --- |
| `guard:docs` `TOKEN_RE` | `[A-Z]{1,4}\d{0,2}-\d+` is Latin-only; `β` is not in `A-Z` |
| `guard:docs` `CAMPAIGN_PHRASES` | patterns spell `Feature`/`Phase`/`T<n>` in Latin; no Greek alternative |
| my guard-independent sweeps | I wrote `[A-Za-z]`-based expressions for the same reason |
| D-15's hyphen defect | `11B-β1` is hyphen-preceded too, so even a Greek-aware `TOKEN_RE` would have skipped it |

**How it was actually found: by pulling on a citation, not by any sweep.** The peer review said
the "measured against the real pipe order" claim in `api-problem-response.ts` was backed by a real
test and named `test/reply-http-security.e2e-spec.ts:738`. Verifying *that* claim meant opening
*that* file — whose own comment carried `β-3` twice. Nothing was searching for it; it was read.

**The lesson, and it outranks the cleanup.** Three of this campaign's four blind spots (D-9, D-11,
D-15) were found by a *better sweep*. This one could not be, because **a sweep can only find the
alphabet its author thought to write.** The instruments agree with each other precisely where they
share an assumption, so "two independent instruments agree" is weaker evidence than slice 5
concluded — they were not independent in the way that mattered. What found this was a human-shaped
act: following a reference into a file and reading it.

**Rule added:** the exit gate cannot be a sweep result alone. It requires at least one pass where
a reader *opens files and reads them* for content the sweeps were never told to look for.

**One repair was the D-13 defect for the second time.** `prisma/schema.prisma` read
"Skills, experiences, testimonials (schema-complete; **no M1 module**)" while all three modules
exist and are registered in `app.module.ts`. That is the same schema file claiming a second time
that shipped modules do not exist. `src/modules/users/users.service.ts`'s "no public surface in
M1" was, by contrast, **true** — verified: `UsersModule` declares `providers` and `exports` and
**no `controllers` array at all** — so it was kept, rewritten present-tense rather than deleted.
Retiring chronology is not a licence to delete the fact attached to it.

### D-15 — A hyphen before a token hides it from the guard, and the guard reports clean

Found while retiring `F9-*`. After every known site was fixed, `npm run guard:docs` reported
**0** remaining in the family. A guard-independent `grep -rn "F9-\|P9-"` found two more:

| Site | Why the guard missed it |
| --- | --- |
| `src/common/filters/prisma-error-metadata.spec.ts:111` — "the pre-F9-9 fallback" | **new — see below** |
| `prisma.config.ts:36` — "(F9-13)" | D-11 file-selection blind spot (`.ts` outside `src/`+`test/`) |

The first is a distinct, second boundary defect:

```
const TOKEN_RE = /(?<![A-Za-z0-9_-])(…)(?![A-Za-z0-9_-])/g
```

The `-` inside the negative lookbehind is deliberate and correct for `ABC-123-XYZ`, where a match
would start mid-identifier. But it cannot tell that case apart from **a hyphen used as an ordinary
English compound prefix**, and `pre-F9-9` is exactly that: a real citation of a real archaeology
id, invisible to the instrument.

**The self-test could not have caught this, and its coverage is why.** It carries
`foo_C-5_bar → []` — the underscore case, added after that bug was found once. There is no
hyphen-prefix case, because a self-test only ever asserts the defects its author already thought
of. Three separate blind spots have now been found in this guard (D-9 pattern family, D-11 file
selection, D-15 boundary), and **all three were found from outside it** — by peer review, by a
repo-wide sweep, and by a guard-independent grep run after the guard said clean.

**Operating rule for the rest of the campaign, and for the exit gate:** a family is retired when a
guard-independent `grep` says so, never when `guard:docs` says so. The guard is the regression
gate; it is not the measurement.

### D-14 — The SpecKit task ids are not unresolvable, they are AMBIGUOUS — seven numbering spaces

D-9 classified `T1`…`T11` as "referential" archaeology and sized the repair as *name the real
component*. Sizing it up for slice 3 found the actual defect is worse than D-9 recorded, and it
changes the argument for fixing them.

`.specify/specs/` holds **seven** feature specs, and **each restarts its task numbering at `T1`.**
A bare `T7` in a source comment does not name one thing; it names one of seven, and nothing in
the comment says which spec is in scope:

| Token | Feature 003 (media) | Feature 004 (redirects/contact/preview) | Feature 008 (profile) |
| --- | --- | --- | --- |
| `T5` | Processing service | Contact module | Experiences technology |
| `T6` | Media module orchestration | Preview module + `getPreviewById` | Permanent FTS guard |
| `T7` | Public media descriptors | Auto-on-rename in articles/projects | Deterministic seeds |

**The collision is not theoretical — it occurs twice inside one file, four lines apart.**
`src/modules/articles/articles.module.ts`:

- line 11 — "exports the descriptor resolver for public reads (`T7`)" → **feature 003's** `T7`
- line 12 — "`update()` can push `buildRedirectOps` into its rename transaction (`D04-6`, `T7`)"
  → **feature 004's** `T7`

Two different `T7`s, same file, adjacent lines, no disambiguator. `articles.service.spec.ts` does
the same across `T4`/`T9` (feature 004) and `T7` (feature 003).

**Consequence for the repair.** "Add a pointer to the spec" is not an available fix — there is no
single spec to point at, and a reader who guessed would land on a real but wrong task. Naming the
component is not the *nicer* repair, it is the only correct one. It also makes the sentences
resolvable by a reader who never opens `.specify/` at all, which is the point.

> **False-positive class — do not sweep these.** `test/media.e2e-spec.ts:426`–`453` uses `T1` and
> `T2` as **transaction labels** in the uncommitted-FK race barrier ("`T2`: create the reference
> and hold it uncommitted"; "`T1`: the delete"). That is ordinary concurrency vocabulary, defined
> in its own comments, and it is correct as written. A mechanical `T<n>` purge would have
> destroyed the clearest explanation of the hardest test in the suite. Any agent given this slice
> must be told to discriminate by *use*, not by shape — which is why it was not delegated blind.

### D-12 — Classifying the module index by deployment state silently lost a module

`src/modules/README.md`, the module archetype document, split its index into two
state-classified headings: "shipped and deployed to production" and "implemented on `dev`,
awaiting a production release". Seventeen modules were listed across the two.

`src/modules/` contains **eighteen**. `mail` appeared in neither list — and `src/modules/mail/README.md`
opens by pointing *back* at the archetype document as the canonical shape. The link was
one-directional: the module knew about the index, the index did not know about the module.

Verified with a passing control (`grep -c media` on the same file returns 4; `grep mail` returns 0).

**The mechanism matters more than the omission.** A module is not born with a deployment status,
so a contributor adding one has no correct bucket to file it under — and the cheapest resolution
is to file it under neither. **Organizing an index by a fact that is not a property of the thing
being indexed makes the index unmaintainable by construction.** The repair is not "add `mail`";
it is to order the index by something intrinsic — it is now alphabetical, matching `src/modules/`,
so a reader can diff the list against `ls` in one glance.

### D-13 — The guide told a learner that four implemented modules did not exist

`PROJECT_GUIDE.md` §3 was a `Shipped` / `In Progress` / `Planned` / `Deferred` taxonomy, opening
with "do not treat anything outside `Shipped` as existing in this baseline". It listed under
**`Planned` (scheduled, not yet written)**:

- `redirects` + `contact` + preview tokens
- `seo` at page level ("the `page_seo` table exists, no module")

and repeated it lower down: "`page_seo`, `slug_redirects`, `contact_messages` are still tables
without modules".

All four modules exist, with controllers, services, DTOs, entities, specs and their own
`README.md`, and all four are imported and registered in `src/app.module.ts`. Verified with a
passing negative control (`CacheModule`/`TotpModule`, genuinely absent, correctly return nothing).

**This is the campaign's clearest single justification.** D-4 recorded `PROJECT_GUIDE.md` as
self-contradictory; this is worse than contradiction. A learner is the document's stated
audience, has no independent way to know better, and is instructed *in the document's own words*
not to treat these as existing. The guide did not merely go stale — it actively directed its
reader away from a quarter of the domain modules.

**Why the guard never caught it.** The rot matcher flagged three lines in that section for the
phrase-level markers it knows. It cannot evaluate whether a completion claim is *true*; that is
the second of the three manual review classes named in §4.D. Rot count reaching zero would not
have moved this by itself.

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

**Reading at phase-0 close:** 68 archaeology + 25 rot — the debt the campaign retires.
**Reading, as of slice 5 (superseded by §0 — do not quote this line as current):** `guard:docs` is GREEN, corroborated by a
guard-independent sweep. Campaign phrases (hyphenless, outside the pass/fail gate) stand at 30,
down from 96 — the remaining open work. The rot class is fully retired; convention
4.D now holds across the whole scanned corpus. Archaeology remains the open half of the gate.

Restating §4.D's warning with the numbers attached: **rot reaching 0 is not the same as the
corpus being true.** The guard's rot patterns are a fixed list, and slice 2 found two state
claims they do not match — a merge-status parenthetical in a `###` heading
(`PROJECT_GUIDE.md` §6.5) and a whole `Shipped`/`Planned` taxonomy whose *heading words* are the
state. Both were removed by manual review, neither was ever flagged. See D-13.

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

### The peer lane RAN, late, and it caught a MAJOR defect self-review had missed

**Correcting this ledger's own previous entry.** An earlier version of this section stated the
peer lane "did not run for slices 1–5" and listed a consolidated peer pass as outstanding. That
was true when written and is now false: both Codex reviews returned after a long delay, one on
slice 1 and one on the cumulative campaign diff. The correction is recorded rather than
overwritten silently, because "a document that quietly stops being true" is the exact defect this
campaign exists to remove, and the ledger does not get an exemption.

**Verdicts.**

| Pass | Result |
| --- | --- |
| Slice 1, first look | 1 MAJOR — the `max` overclaim in `prisma.service.ts` |
| Slice 1, re-review at `0e27801` | **0 open findings** — confirmed the fix; all three questions clean |
| Cumulative campaign diff | **1 MAJOR — wrong component named, 4 sites**; Q2/Q3/Q4 otherwise clean |

**The MAJOR finding, verified before accepting it.** Slice 3 mapped feature 003's `T6` uniformly
to `MediaService`. For four sites that was wrong: the rule that the résumé slot may only reference
a **PDF** asset is enforced in `SettingsService.updateSettings()`, which does its own
`mediaAsset.findUnique` + `kind !== PDF` check. `MediaService` has no résumé-slot semantics at
all — its only link is the reverse `resumeForSettings` relation used for delete protection, a
different concern. Confirmed independently: the misattributing comment at
`settings.service.ts:124` sat **four lines above the SettingsService code that performs the
check**. Fixed at all four sites; the surviving `MediaService` attributions were re-verified
against the code (it does own hashing, key generation, persistence and upload) with a passing
control (`MediaProcessingService` has **0** prisma/storage references).

**Why this is the finding that justifies the whole peer model.** It is invisible to every gate
this campaign runs. Typecheck passes, 1273 tests pass, the guard is green, the compiler-emitted
JS is unchanged — because a comment naming the wrong class is still a comment. And it is the
failure mode the campaign *created*: replacing an ambiguous token with a confident, specific,
wrong class name is worse for a learner than the `T6` it replaced, because `T6` at least
signalled "look this up" while `MediaService` reads as authoritative. **A mechanical mapping
applied uniformly across a family is exactly where this defect breeds**, and self-review is
structurally poor at catching it: I checked whether each substitution was *plausible*, not
whether it was *true*.

**Standing rule added:** any campaign edit that substitutes a specific identifier for a vague one
must be verified against the implementation **per site**, never per family.

**Residual pass: CLEAN.** The third pass covered slice 5 and the finding-1 fix, and returned no
open findings on all three questions — verifying by *running* things, not re-reading prose: it ran
`uuid-param-contract.spec.ts` (3/3, `toHaveLength(35)` still correct against live reflection), ran
`npm audit` and `npm audit --omit=dev` (both 0) to check a `ci.yml` claim, and grepped
`projects.service.ts`/`skills.service.ts` to confirm the past-tense "once caught P2002" claims
match current behaviour. It also independently endorsed both deliberate keeps (the `T1`/`T2`
transaction labels, and leaving the applied migration untouched for the checksum reason).

**The fourth pass DID return — late, after this ledger had recorded it as not returning — and it
was the most valuable pass of the campaign.** The "did not return" entry was written in good faith
and was wrong; corrected here rather than deleted, as with the earlier §5 correction.

Its Q1 and Q2 were CLEAN and matched my seven per-site verifications exactly, line for line. **Its
Q3 was not clean, and it blocked the exit gate I had just declared satisfied.** It found a
chronology family of ~27 occurrences across 18 files that every instrument had missed:

| Shape | Why every instrument missed it | Sites |
| --- | --- | ---: |
| Greek **α** (`11B-α`, `α's …`, `9C-α`) | Latin-only patterns — the *sibling* of the β family I had just retired | 11 |
| bare `11A` / `11B` (no suffix) | no hyphen, no id shape at all — just a phase number in prose | 6 |
| `9C-7`…`9C-11`, `9D-7`, `9D-8` | **digit-first**; `TOKEN_RE` requires 1–4 *leading uppercase* letters | 7 |
| `Stage 2C` | an orphaned citation to *another campaign's* stage numbering | 2 |
| bare `M1` in `access-control/dto/user.dto.ts` | my own `M1` sweep found two and missed this one | 1 |

**Two of these were not dead citations but FALSE claims**, which is why this pass mattered more
than its size suggests:

1. **`idempotency-key.pipe.ts` asserted something the code deliberately does not do.** "in 11B
   this value becomes a provider idempotency header" — it never does. `deriveProviderIdempotencyKey()`
   derives the provider key from **the persisted row id and nothing else**, and
   `provider-idempotency.ts` names the client's header explicitly as a value it refuses to use
   ("an opaque value it may reuse across messages"); `mail-message.ts:23` says the same. Three
   files agreed and the pipe contradicted all three. The CR/LF rejection is still correct — it was
   the stated *reason* that was false — so the rule was kept and the reason rewritten.
2. **`users.service.ts` — my own slice-5b repair was misleading by omission.** I wrote "No public
   HTTP surface at all", technically true of that module. But operator-account CRUD **is** exposed
   over HTTP by `AccessControlModule`'s `users.admin.controller.ts` (`/admin/users`), writing
   `prisma.user` directly. A learner would have concluded operator accounts have no admin API. Now
   states both halves.

**The lesson this pass forces, and it supersedes D-16's optimism.** D-16 concluded that the fix
for alphabet-blindness was "read files, don't only sweep". That was right and insufficient: I then
retired the β family **without checking whether it had siblings**, and α was sitting in the same
files. Retiring a family is not evidence about the family next to it. **Rule: when a marker family
is found, enumerate the space it belongs to before declaring it retired** — if `β` exists, look for
`α` and `γ`; if `9C-8` exists, look for `9C-*` and `9D-*`; if `Stage 2C` exists, ask whose stages
those are.

**Its subject was verified per-site by the author instead**, applying the rule §5 added after the
wrong-class MAJOR — the same substitution class, so it was not left on assertion:

| Claim introduced in `7f7a505` | Verified against | Result |
| --- | --- | --- |
| "THE SEAM IS `reply-http-delivery`'S" | `reply-http-delivery.e2e-spec.ts:23,288` — "Exactly ONE thing is replaced: `MAIL_TRANSPORT`" | correct |
| "the delivery suite's `createOperator` grants `messages.read` AND…" | same file `:240,248` — `['messages.read','messages.reply']` | correct |
| "that suite runs with the SMTP group OFF" | `utils/e2e-mail-env.ts` is imported **only** by `reply-http-security.e2e-spec.ts:4` | correct |
| "the delivery suite's recovery test uses a freshly-created row" | `reply-http-delivery.e2e-spec.ts:576,741–772` | correct |
| `e2e-mail-env.ts` → "`reply-http-security` asserts the configured sender and owner destination" | `reply-http-security.e2e-spec.ts:19,41–44` — `OWNER_EMAIL`, `ownerNotificationTo`, "configured sender" | correct |
| "the `reply-http-*` suites own the full HTTP matrix" | `ls test/` — glob matches exactly `reply-http-delivery` + `reply-http-security`, correctly excluding `reply-delivery` | correct |
| `users.service.ts` "no public HTTP surface at all — registers no controller" | `users.module.ts` — `providers`/`exports` only, **no `controllers` array** | correct |

**Author verification is weaker than a peer pass, and this campaign now has the experiment to
prove it.** My seven per-site checks on `7f7a505` were all correct — and the peer, reviewing the
same commit, agreed with all seven *and then found 27 things I had not thought to look for*.
Author verification answers the questions the author already has. It does not generate new ones.

### Response-envelope obligation — CLOSED

The Codex probe's general check ("every module README documents the payload but the global
`ResponseEnvelopeInterceptor` wraps every 2xx into `{ data: … }`") was swept, by reading rather
than grepping. **The architecture was already right and needed no rule restated:**
`src/modules/README.md` — the archetype every module README's first line points at — states the
envelope twice (the read-flow diagram, and "every response passes through a uniform envelope
`{ data }` / `{ data, meta }`"). Per convention 4.A that is the correct single owner, and a module
README repeating it would be the duplication that produced D-12.

Two sites were genuinely ambiguous and were disambiguated rather than duplicated:
`redirects/README.md:15` and `preview/README.md:16` each labelled a file-map cell "ردّ `{ … }`"
(*response* `{ … }`), where the cell actually describes the DTO/entity **payload**. Both now say
"حمولة" (*payload*) and point at the archetype for the wire shape. No other module README asserts
a bare wire body.



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
- [~] Module dependency graph + size/test signal — **extracted in phase 0 but NOT RECORDED HERE,
      so the output was lost with the session that produced it.** A ledger entry that marks work
      done while its result lives only in chat is the same defect class the campaign retires, and
      this is the third time the ledger has committed it (stale status, incomplete commit table,
      now an undurable result). Being re-derived in phase 2, into §10 of this file.

- [x] Codex Arabic cold-reader probe returned; §5 question resolved, D-9 opened

- [x] **Freeze verdict resolved (D-10)** — Web-only lift; API recorded as still frozen, on an
      obsolete fact. Does not block: convention 4.D removes the language either way.

**Phase 1 — corpus cleanup. COMPLETE.** Slices 1, 1b, 2, 3, 4 and 5 all landed. The corpus is
now clean by both instruments:

| Measure | Phase-0 close | Now |
| --- | ---: | ---: |
| Campaign archaeology (`guard:docs`) | 68 | **0** |
| Fast-rotting state claims | 25 | **0** |
| Hyphenless campaign phrases | 96 | **5** (all deliberate keeps) |
| `guard:docs` verdict | RED | **GREEN** |

Cleanup produced five findings that were not visible at phase 0: **D-11** (guard file-selection
blind spot), **D-12** (state-classified index lost the `mail` module), **D-13** (the guide told a
learner four implemented modules did not exist), **D-14** (task ids ambiguous across seven
numbering spaces), **D-15** (a hyphen prefix hides a token from the guard).

**Phase 2 — learning architecture.** *Status moved to §0.* It was deliberately not begun in the
session that closed phase 1, so that it started from a clean corpus rather than inheriting tired
judgement at the tail of six implementation slices. That sequencing held.

Not started: learning architecture, prerequisite graph, difficulty model, module template,
testing curriculum, flow traceability, cold-reader exit gate.

**Both phase-1 obligations are now CLOSED (§5):** the peer passes ran and their findings are
resolved, and the response-envelope sweep is done. Nothing from phase 1 is carried into phase 2
except the conventions in §4 and the instrument rules in D-15/D-16.

## 7. Slice queue

Phase 0 is closed: every gate that blocked design is now answered.

- [x] **Slice 1 — DONE.** Retire the dead `prisma-7-migration-2026-08.md` citations (D-6).
      Five sites, not the four recorded; the fifth came from a repo-wide sweep and opened D-11.
      Guard archaeology 68 → 64 (the fifth was never in the 68 — it is invisible to the guard).

- [x] **Slice 1b — DONE.** The remaining `D16-13` citations are retired; **zero remain in the
      repository** outside this ledger and the guard's own source (verified with a passing
      control). OD-A is NOT resolved by this — the governing gap is untouched and still the
      owner's. Only the propagation is stopped, which is exactly what §8 obliges.

      *Original note, kept for the record:*
      **Slice 1b — the remaining `D16-13` citations.** Slice 1 removed the citation at
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

- [x] **Slice 2 — DONE, and widened.** State reporting is gone from `src/modules/README.md` and
      `PROJECT_GUIDE.md`, and — since the guard would otherwise have stayed red on four stragglers
      — from `src/modules/contact/README.md`, `src/prisma/README.md` and `scripts/deploy/README.md`
      as well. **Rot markers 25 → 0 across the entire scanned corpus.** Produced D-12 and D-13.

      Two state claims were removed that the guard never flagged, both found by manual review:
      the merge-status parenthetical in the `### 6.5` heading, and the `Shipped`/`Planned`
      taxonomy itself, whose heading words *are* the state. Engineering content was preserved
      throughout — the CI parallelization A/B kept its method lesson ("define the metric before
      comparing; a number without its definition is not comparable") and lost only the run ids
      and SHAs; the release-prune narrative kept its diagnosis (ownership/writability, not
      `KEEP_RELEASES`) and lost the release folder, the date and the `OD-2` authorization.

- [x] **Slice 3 — DONE.** Bucket C repaired across 25 files. Every SpecKit task id used as a
      *citation* now names the real component: `MediaProcessingService`, `MediaService`,
      `MediaDescriptorResolver`, `UploadUserIpThrottlerGuard`, `RedirectService.buildRedirectOps`,
      `getPreviewById`. **SpecKit task ids 58 → 4, and the 4 are deliberate keeps** — the
      transaction labels in the race barrier (D-14). Campaign phrases overall 96 → 30.

      Sentences that named a task now name a thing, so they resolve without opening `.specify/`:
      "the orchestration layer's job (`T6`)" → "`MediaService`'s job"; "the `T5` processor sniffs
      magic bytes" → "`MediaProcessingService` sniffs magic bytes". Where the id added nothing but
      provenance it was dropped outright rather than replaced.

      Full unit suite green afterwards: **61 suites, 1273 tests**. Four `describe()` labels
      changed — test *names*, no assertion touched.

- [x] **Slice 4 — DONE. Every hyphenated archaeology family is retired.** `F9-*`, `P9-*`,
      `AD-*`, `C-*`, `B-*`, `OD-*`. **`npm run guard:docs` is GREEN**, and — per D-15's rule —
      a guard-independent sweep over every tracked file outside `.specify/` returns **zero**,
      with a passing positive control.

      Most were bucket A: strip the id, leave the prose. Four were not.

      - **Bucket B, the one D-3 predicted.** `test/prisma-error-mapping.e2e-spec.ts:25` promised
        in future tense that a later phase "**will** delete the Project-local `P2002` translation".
        It was deleted; `projects.service.ts` documents its absence. The comment justified taking
        the evidence from ARTICLES because PROJECTS "still translates locally" — which had become
        false, making the test's own rationale wrong. Rewritten to the true and stronger claim:
        two modules reaching one byte-identical response is what the section proves, and one
        module alone could not carry it.
      - **Two chronology blocks** in the filter specs, rewritten to state the trap rather than
        recount falling into it (see slice 4a).
      - **`OD-1`/`OD-3` in CI config**, the class D-11 deliberately left open. Settled with
        evidence rather than by assumption: both resolve in **0** files on both authoritative docs
        refs, control passing (`D10-6` → 8 files). So they are unresolvable in the same sense as
        every other family, and a reader of `dependabot.yml` could not discover what the decision
        said. The reasoning prose stands on its own and was kept; only the dead ids went.
        `dependabot.yml`, `codeql.yml` and `deploy.yml` all still parse, jobs intact.

      **Honest caveat on the green.** Three of those CI-config sites were *also* invisible to the
      guard (D-11), so `guard:docs` would have reported green while they were still there. The
      green is trustworthy because the independent sweep agrees with it, **not** because the guard
      says so. That is D-15's rule doing real work rather than decorating the ledger.

      Gates: typecheck 0, `prisma validate` 0, guard GREEN, self-test 43/43, **61 suites / 1273
      tests**.

- [x] **Slice 5 — DONE. The hyphenless phrase families are retired.** `Feature 00N`,
      `Phase 12A`/`10A`/`11B-β2`/`9`, `F004`/`F005`. Phrase occurrences **96 → 5**, and all five
      remaining are deliberate keeps:

      - 4 × `T1`/`T2` in `test/media.e2e-spec.ts` — transaction labels, not task ids (D-14).
      - 1 × "Feature 007" in `prisma/migrations/…_localize_availability_status/migration.sql`.
        **An applied migration must not be edited**: Prisma records a checksum per migration and
        a modified file makes `migrate deploy` fail on a checksum mismatch. The cost of touching
        it is a broken deployment; the benefit is one retired phrase in a file no learner reads
        as documentation. Left deliberately, recorded here so it is not mistaken for an oversight.

      **My own sweep had a false negative here, and the guard caught it** — the exact inverse of
      D-15. My independent grep used `Feature [0-9]{3}`; the guard's pattern is
      `/\b[Ff]eature\s+\d{3}\b/`, so three lowercase "feature 00N" sites were invisible to *me*
      and visible to *it*. **Neither instrument dominates the other.** The rule from D-15 stands
      but needs its converse attached: agreement between two independently-built instruments is
      the evidence — a single clean reading from either one is not.

      One of those three was also a false claim: `prisma/schema.prisma` read
      "schema-complete for feature 002+; **no M1 module**" while `src/modules/projects/` exists.

- [x] **Slice 5b — DONE.** The `11B-β*` and `M1` chronology families, found via D-16. 13 β
      occurrences across 5 test files, plus two `M1` milestone claims — one of which
      (`prisma/schema.prisma`) was **false** in the same way D-13 was: it said skills, experiences
      and testimonials had "no M1 module" while all three are registered in `app.module.ts`. The
      `users.service.ts` claim was **true** and was kept, rewritten present-tense — retiring
      chronology is not a licence to delete the fact attached to it.

- [ ] **Slice 6 (phase 2 or later) — widen the guard's file selection (D-11), fix the boundary
      (D-15), and add non-Latin alternatives to its patterns (D-16).** Not required for the phase-1
      exit gate: the corpus is clean by direct sweep and by reading. This is instrument debt, and
      it should be paid before the guard is ever trusted as a standalone gate again. An instrument change, deliberately
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

## 7b. PHASE 2 — in flight (durable note; survives session compaction)

**Phase 2 opened.** The primary session is the control plane only: investigations are delegated
and only their compact results land here.

| Dispatched | Purpose | Status |
| --- | --- | --- |
| `codex-5c` — peer review of slice 5c (`eff70d3`) | verify the two false-claim rewrites and the α replacements; enumerate any remaining marker shape | **RETURNED — CLEAN, all 3 questions** |
| `graph-derive` — dependency graph, size/test/surface signal, concept load | re-derive the lost phase-0 input | **RETURNED**; reconciled in §10, corrected two of my numbers |
| `readme-survey` — de-facto section template across the 17 module READMEs | input to the module template | **RETURNED**; template landed at `29b389a` |
| `codex-5c` — testing-curriculum survey | input to the testing curriculum | **RETURNED**; curriculum landed `ea06eed` |
| `codex-5c` — end-to-end request trace | input to flow traceability | **RETURNED**; trace landed in the archetype |

Results land in **§10** (below) as compact tables. If a dispatched agent never returns, that is
recorded here as review debt in the same terms §5 uses — never silently upgraded into
"verified".

### Review debt — see §0

*Moved.* This section restated the debt and immediately began drifting: it named a range ending at
`a0fd971` while later commits kept landing, and it missed that `2aa031f` is a **source-touching**
documentation change rather than ledger prose. Restating status in a second place is what produced
the six-contradiction audit; the numbers now live in §0 only.

What belongs here is the *evidence*, which does not go stale: slice 5c's pass verified rather than
re-read — it traced `contact-reply.service.ts:220` → `contact-mail.service.ts` →
`mail.service.ts:104-109` to confirm the client key never reaches the provider header, and read
`pino-logger.config.ts:46-64` to confirm the other half (`req.headers` logged wholesale, the
idempotency header absent from `redact.paths`). It ran a positive control on its own sweep regexes
before reporting a clean sweep, so that negative is real.

**Observation logged, not acted on (out of campaign scope, pre-existing):** the pino request
serializer logs all request headers and does not redact the client `Idempotency-Key`. That is a
code/ops question for the owner, not a documentation defect, and this campaign does not change
behaviour. Recorded here so it is not lost.

## 9b. Difficulty model — PRE-REGISTERED, before the measurements landed

Written and committed **while `graph-derive` was still running**, deliberately. A difficulty model
invented after seeing the numbers is fitted to them: whatever ordering the data happens to produce
gets a rationale attached, and the model then explains nothing it did not assume. Committing the
rubric first makes the measurement able to **surprise** us — and a surprise is the only thing that
would prove the model is doing work.

### What "difficulty" means here, stated before it is scored

The audience is fixed by the charter: a Vue/Nuxt frontend engineer learning backend. Difficulty is
therefore **not** size, and not cleanliness. It is *how much a reader must already hold in their
head before this module's code stops being surprising.*

Four axes, each scored 0–3. Deliberately NOT summed into one number — see below.

| Axis | 0 | 3 |
| --- | --- | --- |
| **A. Prerequisite depth** | reads standalone | needs 3+ other modules understood first |
| **B. Backend-concept load** | CRUD a frontend dev already understands | transactions, races, locking, idempotency, crypto |
| **C. Implicitness** | behaviour is visible in the file | behaviour comes from a guard/interceptor/pipe declared elsewhere |
| **D. Failure-mode subtlety** | wrong code → obvious error | wrong code → silently wrong data, green tests |

**Axis C is the one this repo will score badly on and the one that matters most for THIS codebase.**
A frontend engineer reads a NestJS controller and sees a method; they do not see the global
`ValidationPipe`, the `ResponseEnvelopeInterceptor` wrapping the return, the `AllExceptionsFilter`
translating a `P2002` they never wrote a `catch` for, or the `JwtAuthGuard` that already ran. Every
one of those is invisible at the call site **by design** — that is good architecture and hostile
first-reading, simultaneously. That tension is the campaign's core learnability problem, and it is
named here before any data can soften it.

### Two predictions, recorded so they can be wrong

Pre-registration is worthless without a falsifiable claim, so:

1. **Size will correlate poorly with difficulty.** `contact` will be among the largest modules and
   should NOT be the hardest to *start* with; `redirects` or `preview` will be small and score high
   on B/D. If difficulty tracks line count, the model adds nothing over `wc -l` and should be
   discarded rather than defended.
2. **Axis C will be near-uniformly high and near-useless for ORDERING**, because the archetype
   applies globally. If so, its value is not in ranking modules but in proving that the archetype
   document must be a hard prerequisite for every module README — a structural conclusion, not a
   score.

### Why the axes are not summed

A single 0–12 score would put a module needing three prerequisites (A=3) level with one whose
failures are silent (D=3), and those call for opposite responses: the first needs a **reading
order**, the second needs **worked examples and tests that discriminate**. The output of this model
is therefore a **profile per module**, and the prerequisite graph is built from axis A alone.

### "Hardest to START with" — pinned, and pinned LATE

Peer review found the falsifiability gap: prediction 1 turns on "hardest to start with", the model
refuses to sum its axes, and no rule said which axis that phrase meant. As written, a later reader
could pick whichever axis made the prediction land — which defeats the entire point of committing
it early.

**Pinned: "hardest to start with" = axis A (prerequisite depth) alone**, consistent with §9b's own
"the prerequisite graph is built from axis A alone". Under that definition, longest dependency
chain from a root:

`contact` → `mail` (root) = **depth 1**. `redirects` → `locales` (root) = **depth 1**.
`preview` → `articles`/`projects` → `media`/`redirects` → `locales` = **depth 3**, the deepest.

**The honest part: this was pinned AFTER the measurements landed and after prediction 1 was scored
CONFIRMED in §10.** The scoring in §10 leaned on concept load (axis B), not axis A. So the
pre-registration did not do the work it was written to do — the term it hinged on was undefined at
the moment it mattered, and I resolved it post hoc, which is the exact failure mode pre-registration
exists to prevent.

**Re-scored under the pinned definition, which is the only scoring that counts:** `contact` is
depth 1, so it is NOT hardest to start with — **prediction 1 holds on axis A too**, and it happens
not to matter that the definition arrived late. *It could easily have mattered.* Recorded at full
strength rather than quietly repaired, because "the prediction survived anyway" is exactly the
sentence that would let this recur.

*If the data contradicts a prediction, the contradiction is recorded and the model changes — not
the prediction.*

### Axis A computed, and the finding that follows from it

Longest dependency chain from a root, from the real `imports:` arrays:

| depth | modules |
| :-: | --- |
| 0 | `health`, `locales`, `mail`, `users` |
| 1 | `auth`, `contact`, `experiences`, `media`, `redirects`, `skills`, `taxonomy` |
| 2 | `access-control`, `articles`, `projects`, `seo`, `settings`, `testimonials` |
| 3 | `preview` |

**The dependency graph is actively bad pedagogy, and this is the number that proves it.**
`contact` is **depth 1** — it imports `mail` and nothing else — so the graph permits it *second*.
It is also on the five-module difficulty ridge (idempotency keys, post-commit mail, a retention
cron). Meanwhile `testimonials` is depth **2** and carries no idea beyond the archetype. **What
you *can* read and what you are *ready* for are different orderings**, and following the graph
alone lands a learner on one of the hardest modules in the repo before they have seen a simple one.

### The existing reading order was measurably wrong

`PROJECT_GUIDE.md` §15 already had a suggested reading order. Against the measurements it sends a
newcomer to **`auth` + `access-control` as step 4** — two of the five ridge modules — before any
simple module, then to `articles` (depth 2, cron + raw-SQL FTS) as "the richest module, the
reference model", then lumps everything else into "the rest of the content modules", which puts
`media` (hardest) and `testimonials` (trivial) in one undifferentiated bucket. It never mentions
`locales` at all — the 76-line module that **ten modules depend on** and that appears in every
service a reader will open.

Replaced with an 11-step order that ascends concept load and states the trap explicitly at the top
rather than leaving a reader to fall into it. This is the first Phase 2 change grounded in a
measurement that contradicted an existing decision, rather than in an opinion about what reads
better.

> **CORRECTION (cold-reader run, §11c).** This paragraph originally read *"respects prerequisites
> **then** ascends concept load"*, and `PROJECT_GUIDE` §15 carried the same claim in the same
> words. **It was false, and this table is what falsifies it:** `articles` and `projects` are
> step 9 and both import `MediaModule`, which is step 10. The order was never prerequisite-first —
> it deliberately demotes `media` because `media` is the heaviest module in the repo, and that
> trade is defensible. The claim was not. Corrected in both places rather than appended to, because
> the sentence itself is the defect; a finding added below it would have left the false clause
> readable. *Same failure class the campaign spent six slices removing — and this is the second
> time it has appeared inside the campaign's own instruments rather than in the documentation.*

## 10. Phase 2 measurements

Derived directly (deterministic script, not delegated judgement) after both dispatched Explore
agents went idle without delivering. `code`/`spec` are non-blank, non-comment `.ts` lines.

| module | code | spec | spec files | e2e | ctrl | routes | module deps |
| --- | ---: | ---: | ---: | :-: | ---: | ---: | --- |
| `media` | 1853 | 2185 | 11 | Y | 1 | 6 | Storage, Locales |
| `projects` | 1315 | 809 | 1 | Y | 2 | 7 | Locales, Media, Redirects |
| `settings` | 1142 | 702 | 2 | Y | 2 | 3 | Locales, Media |
| `articles` | 1141 | 797 | 1 | Y | 2 | 8 | Locales, Media, Redirects |
| `contact` | 1133 | 2015 | 11 | Y | 2 | 6 | Mail |
| `taxonomy` | 678 | 66 | 1 | **–** | 4 | 10 | Locales |
| `access-control` | 656 | 351 | 3 | Y | 2 | 9 | Auth |
| `experiences` | 529 | 218 | 1 | Y | 2 | 6 | Locales |
| `seo` | 448 | **0** | **0** | Y | 2 | 4 | Locales, Media |
| `auth` | 430 | 131 | 1 | Y | 1 | 3 | Users, Jwt |
| `skills` | 407 | 208 | 2 | Y | 2 | 6 | Locales |
| `testimonials` | 395 | 140 | 1 | Y | 2 | 6 | Locales, Media |
| `preview` | 283 | 351 | 3 | Y | 2 | 4 | Articles, Projects |
| `mail` | 183 | 219 | 1 | – | 0 | 0 | — |
| `redirects` | 147 | 169 | 1 | Y | 1 | 1 | Locales |
| `health` | 83 | 0 | 0 | Y | 1 | 2 | — |
| `locales` | 76 | 68 | 1 | – | 1 | 1 | — |
| `users` | 24 | 0 | 0 | – | 0 | 0 | — |

Totals: **10,923 code / 8,429 spec.** Graph is **acyclic** — corroborated structurally: zero
`forwardRef` anywhere in `*.module.ts`, and a Nest cycle is unresolvable without one.

**Both delegated agents delivered after this table was derived, and their numbers were reconciled
rather than merged.** `graph-derive`'s size table is **identical to mine, line for line** — two
independent derivations agreeing is the strongest evidence in this section. Two corrections came
out of the reconciliation:

- **`locales` fan-in is 10, not 8. My number was wrong** and is corrected here. Re-verified by
  hand: `articles`, `experiences`, `media`, `projects`, `redirects`, `seo`, `settings`, `skills`,
  `taxonomy`, `testimonials`.
- **`media` fan-in is 5.** A naive `grep MediaModule` returns 6 — the sixth is `contact`, and the
  match is **a comment I wrote in slice 3** ("the same wiring `MediaModule` uses for
  `UploadUserIpThrottlerGuard`"), not an import. `contact.module.ts` imports `MailModule` only.
  *A name-grep counts prose; only the `imports:` array counts as an edge.*

**Instrument caveat that materially limits the `e2e` column.** `graph-derive` flagged it and it is
correct: the column matches e2e suites by filename substring, and **17 of the 34 e2e suites match
no module name at all** — including the heaviest ones (`transaction-semantics`,
`prisma-error-mapping`, `refresh-token-rotation`, `reply-http-delivery`, `reply-http-security`,
`fts-search`, `fts-invariants`, `content-sync`, `hardening`, `list-envelopes`, `about-content`,
`profile-contract`, `cors`). **The column badly understates `auth`, `contact`, `articles` and
`media`, and must not be read as a coverage measure.** It answers only "is there a suite named
after this module".

### Concept load (from `graph-derive`, verified against the code where it mattered)

| Module | The distinctive thing a learner must hold |
| --- | --- |
| `media` | processing pipeline + concurrency limiter + FK-blocked deletes |
| `contact` | idempotency keys + post-commit mail + retention cron |
| `auth` | argon2id hashing + refresh rotation & reuse detection |
| `access-control` | DB-resolved permission grants + global guard ordering |
| `preview` | HMAC mint/verify + TTL + timing-safe compare |
| `articles` | scheduled-publish cron + raw-SQL full-text search |
| `redirects` | slug-rename ops injected into the CALLER's transaction |
| `projects` | one transaction spanning rename + redirect + media |
| `mail` | transport factory + bounded retry + provider idempotency header |
| `taxonomy` | `P2003` FK-blocked delete on an in-use category |
| `settings` / `seo` | singleton / per-key upsert + locale resolution |
| `locales` | the enabled-locale validation seam everyone uses |
| `health` | raw DB liveness probe; nothing else |
| `experiences`, `testimonials`, `skills`, `users` | none beyond the archetype |

**The ridge is `media` · `contact` · `auth` · `access-control` · `preview`, and it is NOT the LOC
ranking.** `projects`, `settings` and `articles` are large but substantially archetype repetition;
`preview` and `auth` are small and carry the densest new concepts per line. This is prediction 1
confirmed a second time, by an independent agent that never saw the prediction.

### Two coverage gaps the table exposes, both verified

- **`seo` has 448 lines of code and ZERO unit spec files.** It does have
  `test/page-seo.e2e-spec.ts`, so it is not untested — but it is the only non-trivial module whose
  entire safety net is end-to-end. Every branch is proven through HTTP or not at all.
- **`taxonomy` is the thinnest coverage relative to surface in the repo**: 678 code lines, **4
  controllers and 10 routes** — the largest route surface of any module — against 66 spec lines in
  a single file (`categories.service.spec.ts`, so the *tags* service has no unit spec), and **no
  dedicated e2e**; its routes appear only incidentally inside other suites.

These are inputs to the testing curriculum, not defects to fix in this campaign.

### The pre-registered predictions, scored

**Prediction 1 — "size will correlate poorly with difficulty" — CONFIRMED, and strongly.**
`taxonomy` is the 6th largest module and conceptually the plainest CRUD in the repo. `preview`
(283 lines) and `redirects` (147 lines) are near the bottom by size and carry the subtler ideas —
token minting with expiry windows, and a 3-operation redirect recipe the *caller* must push into
its own `$transaction` so a rename commits atomically. Ranking modules by `wc -l` would put a
learner on `taxonomy` before `redirects`, which is precisely backwards. **The model survives its
own falsification test and is kept.**

**Prediction 2 — "axis C will be near-uniform and useless for ordering" — CONFIRMED, and its
structural consequence has already been acted on.** Every module inherits the same global guard
chain, pipe, envelope and exception filter, so implicitness barely discriminates between modules.
Its value was never a ranking: it is the argument that the archetype must be a hard prerequisite
for every module README. That is now discharged — `src/modules/README.md` carries the
layer-decides-the-status-code section (`2aa031f`), which is the axis-C content stated once, in the
one place every module README already points at.

*Recording that both predictions held is weaker evidence than a surprise would have been. Noted
so a later reader does not mistake confirmation for proof — the model was cheap to falsify and
was not falsified, which is all that can be claimed.*

## 10d. The curriculum's strongest claim was its wrongest — and the rule I had just written

I flagged "exactly ONE file uses `Test.createTestingModule`, so Nest DI is untested at the unit
layer" to the reviewer as the document's strongest claim and asked for it to be attacked. It fell,
and it fell to one `grep`: **three** files boot the real DI container, via **two** mechanisms —
`Test.createTestingModule` in one, `NestFactory.create` in two `src/common/throttling/` specs.

**The conclusion got stronger while the sentence got falsified.** All three boot a *hand-built*
test module, never the production `imports:` graph — so real module wiring is not merely
"essentially" untested at the unit layer, it is untested *entirely*. But "exactly ONE" was a false
count a skeptical reader could refute in seconds, in a document whose whole subject is tests that
look convincing and prove nothing. It also silently absorbed those three files into the "pure unit
(no Nest, no DB)" row, contradicting that row's own definition. Both fixed; the three now have
their own row.

*The uncomfortable part: I asked for this claim to be challenged because I suspected it, and I was
right to suspect it — but I shipped it first and asked second.*

**And the second MINOR is the rule I wrote three commits earlier, unapplied one line away.**
§5c added: *when a defect is fixed in one file, sweep for its wording repo-wide.* `e9ea4f8` fixed
"76 lines" to state its metric — and left "١٤٧ سطر" for `redirects` in the **same numbered list,
one step below**, with the identical reproducibility gap and the identical fix available. A rule
written for identifiers, extended to claims, and still not applied to *numbers* in the same
paragraph.

**Rule sharpened, since twice is a pattern:** a fix is not done when the file is clean; it is done
when the **same shape** is clean — same wording, same metric, same claim — across the whole repo,
checked by a command, not by memory of what one was editing.

*Also corrected quietly: my line-counting script added one phantom line per file to RAW counts
(splitting on `\n` yields a trailing empty element). `wc -l` is authoritative — `redirects` is 195
raw, not 200. Code counts are unaffected, because the counter skips blank lines, so §10's table
stands.*

## 5c. The pipe-order defect had TWO more instances, and I edited past one of them

A single-file fix is not a repo-wide fix. §5b recorded the pipe-order MAJOR as fixed in
`src/modules/README.md`. It was — and the same false claim was sitting in two source files:

| Site | How it read |
| --- | --- |
| `src/common/swagger/api-problem-response.ts:70` | "`ParseUUIDPipe` runs **BEFORE** the global `ValidationPipe`" |
| `src/common/swagger/uuid-param-contract.spec.ts:19` | "`ParseUUIDPipe` runs before the global `ValidationPipe`" |

**I had already edited the first of those files, in slice 5, and read straight past this.** That
edit rewrote the line *immediately below* ("measured in Phase 11B-β2" → "measured against the real
pipe order"), so I was reading for chronology markers and the false mechanism one line up was
invisible to me. **An edit pass sees the defect class it is hunting and is blind to every other
one in the same paragraph.**

Worse, the phrase I substituted — "measured against the real pipe order" — *reinforced* the wrong
claim by asserting it had been measured. It had not.

Both are corrected to the verified mechanism, and the repo-wide sweep for the claim now returns
zero. Found by the peer while doing an unrelated measurement task, which is the third time this
campaign's most useful findings arrived as a by-product of someone reading for a different reason.

**Rule added:** when a defect is fixed in one file, sweep for its *wording* repo-wide before
recording it as fixed — the campaign already had this rule for *identifiers* (D-11, D-15, D-16)
and had never applied it to *claims*.

## 10b. The module README template — measured, not designed

`readme-survey` extracted every heading from the 17 module READMEs and normalised them by meaning.
The finding that shaped the deliverable: **a template already existed and was already being
followed** — six sections appear in 15–17 of 17 files. Nothing needed inventing; it needed naming,
so a new module stops rediscovering it by guesswork.

| Section | of 17 |
| --- | :-: |
| Responsibility · File map · Tests-and-what-they-prove | 17 |
| Wiring map · Official-docs + compatibility | 16 |
| Contracts & invariants | 15 |
| *"How this module differs"* **or** *a flow walkthrough* | 10 + 5 |
| Common mistakes | 7 |
| Accepted limits / deferred | 6 |

**The one genuine structural choice** is the seventh row: "differs from the archetype" and "flow
walkthrough" are alternatives filling one slot, and **15 of 17 carry exactly one**. Codified as a
choice with a rule for picking (a *rule* → write "differs"; a *sequence* → write the flow), rather
than as two optional sections, because the data says modules already treat them as exclusive.

**The line-3 archetype pointer is 17/17** — the single most consistent thing in the corpus. That
consistency is what makes the envelope, guard-chain and status-code explanations affordable to
write once here instead of 17 times, so the template states it as unbreakable.

**Deliberately NOT made a rule: length.** 37 to 136 lines, and the survey's depth verdicts
(3 reference, 11 mixed, 3 explanatory) do not track length. A line target would be a metric that
looks like a standard and measures nothing.

**Structural outlier recorded, not fixed:** `mail` is missing three near-universal sections
(wiring map, contracts, official-docs) and adds three of its own. It is the only module that is
structurally a different document. Whether that is a defect or a legitimate difference (it is the
only module with **no HTTP surface at all**) is a phase-2 judgement call, deferred rather than
swept into a template change.

## 10c. Two MINORs that were worth acting on

Both came from the review of the reading order, both were flagged as non-defects, and both were
fixed anyway — because in a *learning* document the bar is not "is it true" but "can the reader
follow it".

**An unreproducible number is a defect even when the number is right.** The reading order said
`locales` is "76 lines". The reviewer could not reproduce 76 by any naive count and correctly
declined to call it an error, since it matches §10's doubly-derived table. Both are right: **76 is
non-blank, non-comment code lines; raw `wc -l` gives 90.** A reader who checks the claim the
obvious way gets a different number and learns to distrust the document. The metric is now stated
inline with both figures. This is the campaign's own "record the whole formula" rule applied to a
number small enough to look harmless.

**A concept introduced with no prior grounding.** Step 8 (`redirects`) is the reader's first
encounter with Prisma's `$transaction` / deferred-operations pattern, and none of the four
cross-cutting documents read at steps 1–3 mention `$transaction` at all. The reviewer rated it
MINOR on the grounds that the paragraph is self-contained and `$transaction` is generic ORM
knowledge rather than a repo-specific hidden mechanism — a fair call. It is now announced at that
step instead, so the reader meets it as a named new idea rather than as an unexplained token. Cost:
one clause. That is the right trade for the audience the charter names.

**Worth recording about the review itself:** it also checked whether deferring `auth` and
`access-control` to step 10 would leave `@RequirePermission` unexplained in steps 7–9, and found it
does not — because step 3 now teaches the guard chain and its status codes generally. The
cross-cutting *surface* is front-loaded; only the *deep implementation* is deferred. That was the
design intent, and having it independently identified rather than asserted is the difference
between a rationale and a rationalisation.

**And it retired the old order's best claim on evidence rather than taste.** "`articles` — the
richest module, the reference model" was demoted to step 9. The reviewer tested whether that
framing had corpus backing by grepping every module README for a cross-reference to
`articles/README.md`: **none exists**. No module treats it as a pattern source, unlike
`src/modules/README.md`, which all 17 cite on line 3. The old framing was an editorial call with
nothing behind it.

## 5b. The pipe-order MAJOR — a right answer reached by a wrong mechanism

The peer review of `2aa031f` found the one defect class a teaching document can least afford: the
**status code was correct and the explanation of why was backwards.**

The table said a malformed `:id` yields `400` because `ParseUUIDPipe` runs *before* the global
`ValidationPipe`. Verified against `@nestjs/core` itself, the opposite is true:
`router-execution-context.js:151` builds the pipe array as `pipes.concat(paramPipes)` — **global
pipes first** — and `pipes-consumer.js:14` applies them with `transforms.reduce(...)`, left to
right. The global `ValidationPipe` therefore runs **first**.

The `400` is still right, but for a reason the document never gave: `ValidationPipe` **no-ops on a
primitive route parameter**, because there is no DTO metatype to validate against. So the decision
falls through to `ParseUUIDPipe`. The observed status was a coincidence of the real mechanism, not
evidence for the stated one — and the table even contradicted the pipeline diagram three lines
above it, which had the order right.

**Why this is worth a section rather than a one-line fix.** Every gate in this campaign would pass
a document whose codes are right and whose causal story is inverted: the codes are what tests
assert. A reader debugging a `400` under the old text would have reasoned incorrectly about what
the global pipe does and does not see. **A learning document can be wrong in a way that only a
reader — never a test — can detect**, which is the strongest possible argument for the peer lane
and against ever discharging it with author verification.

The corrected text now states the real order, names the no-op as the reason, and ends with the
general rule: *do not infer layer order from a status code; infer it from the source.*

**Two verified omissions added in the same pass**, both of which would have misled a specific
reader: an unrecognized Prisma code falls to `400` and any other error to `500` (the table implied
its ten rows were exhaustive), and **file uploads are governed by a separate `10 MiB` `multer`
limit**, disjoint from the `1 MiB` `express.json` limit the table described — so anyone building
an upload feature was reading the wrong number entirely.

**One reported omission was withheld pending evidence — and is now RESOLVED, not merely
recorded.** The reviewer flagged, explicitly as reasoned-but-unverified, that an unmatched route
might bypass the filter and lose the problem+json shape. My counter-read was equally unverified,
so neither was published. The reviewer then settled it from source rather than from either
opinion: `@nestjs/core/router/routes-resolver.js:65-87` — `registerNotFoundHandler()` throws
`NotFoundException` and wires it through `routerExceptionsFilter.create(...)` /
`routerProxy.createProxy(...)`, **the same dispatch path every controller route uses**, and
`registerExceptionHandler()` does likewise for raw Express errors. With `@Catch()` taking no
argument, `AllExceptionsFilter` genuinely receives both. **No row is needed, because the behaviour
does not diverge from the table's promise.**

*The reviewer's own summary of this is the part worth keeping: "your read was right; mine was the
wrong guess." Two agents holding opposite unverified reads, both declining to publish, and the one
who was wrong resolving it against itself — that is the peer model working exactly as §5 describes,
and it is the reason this entry now says RESOLVED instead of carrying a permanent disagreement.*

## 10e. Flow traceability — the asymmetry that makes the trace worth having

The peer traced `GET /api/v1/articles?locale=ar` hop by hop, and the instruction that produced
something useful was the third column: **"what would it look like if this hop did NOT exist."** A
trace that only lists layers teaches nothing a stack trace would not; tying each hop to an
observable consequence of its absence is what makes an invisible layer visible.

Only the hops that can fail **silently** were carried into the document. `CORS`, the route prefix
and response serialization fail loudly — 404, blocked request, hung socket — and need no teaching.

**The single best find, verified before use:** `PUBLIC_INCLUDE` filters `category` and `tags` with
`where: { locale }` — and does **not** filter `translations`. So Prisma returns every language's
translation and the flattening step is what selects `ar`. A reader who assumes symmetry (a very
natural assumption, since the include *does* filter the other two relations) reads that selection
as redundant when it is load-bearing. Getting it wrong yields **a title in the wrong language, with
no error** — the axis-D failure mode this campaign keeps circling back to.

Two more verified before writing: `skip`/`take` are **getters on the DTO class**, so without the
pipe's `transform: true` they are `undefined` and Prisma returns the entire published table
unpaginated and without error; and the list/count pair runs in one `$transaction`, without which
`meta.total` can disagree with the page it describes.

**The contrast is what makes it a rule rather than a special case:** on the admin write path the
*same two guards in the same order* do real work instead of standing aside. Guards are always
present; `@Public()` and `@RequirePermission` decide whether they act.

## 11. The cold-reader exit gate

The campaign's definition of done. Written as **questions with checkable answers**, because every
other formulation this campaign tried ("the docs are clearer now") is unfalsifiable, and because
the guard has already proved four times that a green instrument is not evidence of a true corpus.

**Protocol.** A reader who has NOT worked on this repository answers from the **documentation
alone** — no source, no search, no asking. Each answer is then checked against the code. **The gate
passes when a cold reader answers 8 of 10 correctly, and the two they miss are not from §A.**

**Why these ten.** Every one has a *plausible wrong answer* — the wrong answer is what a competent
frontend engineer would reasonably assume from reading the controller. That is the entire measured
problem (axis C: behaviour that is invisible at the call site by design). A question whose right
answer is guessable tests nothing.

### §A — the invisible layers (must not be missed)

| # | Question | Wrong answer a reader would reasonably give | Where the docs answer it |
| :-: | --- | --- | --- |
| 1 | You POST a body containing an unknown field. What status? | `400` | archetype, status-code table |
| 2 | **Assume all three global guards pass — the request is below its throttle limit, authenticated, and authorized.** `GET /admin/articles/not-a-uuid` → what status? The global `ValidationPipe` runs **before** the route's `ParseUUIDPipe` — so why is it not the pipe that rejects this? | "the global `ValidationPipe` rejects it, because it runs first" — or naming `ParseUUIDPipe` without the ordering fact | archetype, pipe-order note |
| 3 | Where is the `try/catch` that turns a duplicate slug into `422`? | "in the module's service" | archetype — there isn't one; `AllExceptionsFilter` owns it |
| 4 | `redirects/README.md` says **حمولة** (*payload*) `{ toPath }`, not **ردّ** (*response*). Why that word, and what does the HTTP body actually contain? | "they mean the same thing" / `{ toPath }` | archetype, envelope rule |
| 5 | You upload a 5 MB image. Rejected by the `1 MiB` limit? | "yes" | archetype — `multer` has a separate 10 MiB limit |

### §B — architecture and method

| # | Question | Where the docs answer it |
| :-: | --- | --- |
| 6 | Which module **README** should you read first (after the archetype, which is mandatory), and on what evidence? | `PROJECT_GUIDE` §15 — `locales`, ten modules depend on it |
| 7 | Why is `contact` NOT an early read, despite depending on only one module? | `PROJECT_GUIDE` §15 — graph depth ≠ readiness |
| 8 | You add a module. Which README sections are mandatory, and what is the one real choice? | archetype, README template |
| 9 | Name a test shape in this repo that passes while proving nothing, and its antidote. | `test/README.md`, the five patterns |
| 10 | Where does release/deployment state live, and why not here? | any code-adjacent doc — convention 4.D |

### What this gate deliberately does NOT measure

Not prose quality, not length, not Arabic fluency, not whether the reader *enjoyed* it. Those were
all available and all unfalsifiable. **The gate is hostile to the campaign's own work**: a reader
failing question 2 means the pipe-order fix did not land as teaching, even though it is verifiably
true and peer-reviewed.

### A gate question can go stale against its own campaign

Peer review found that **question 4 tested a trap this campaign had already closed.** As first
written it asked what a reader receives when a README documents a response as `{ toPath }` —
aiming at a README that asserts a bare wire shape. By the time the gate was written, §5's
envelope pass had already changed both such files to say **حمولة** (*payload*) with the envelope
disambiguation inline, and the ledger's own §5 entry says in as many words that no module README
asserts a bare wire body any more. **There was no longer a file in the corpus that would spring
the trap.**

It is now reworded to test the *rule and the deliberate word choice*, both of which are live:
why the README says **payload** rather than **response**, and what the body actually contains.
Question 6 was tightened in the same pass — it said "module" where it meant "module README", and
the archetype is also read before any module.

**The general lesson, which outlives this gate.** A test written against a snapshot of the thing
it tests will silently stop testing it. This is the same failure the campaign spent six slices
removing from the documentation — a claim true when written, never revisited when the world moved
— reappearing in the instrument built to *detect* that failure. **Fifth occurrence, and the first
one inside a measuring device rather than a document.**

*Rule: re-validate every gate question against the corpus immediately before running the gate,
not when writing it.*

### Status BEFORE the run — historical, superseded by §11c

The gate requires a reader who has not worked on this repository. **Every agent in this campaign is
disqualified**, including the peer, which has now read most of this code closely. Author
verification cannot substitute here for the same reason §5 gives for review: I would be answering
from what I know, not from what the documents say.

**This is therefore an owner-facing item, not a blocker I can discharge.** Recorded as the campaign's
final gate, to be run by the owner or by a genuinely cold reader before the PR is treated as
complete. Everything else in the campaign can be finished without it.

**The peer independently agreed it is disqualified, and gave the sharper reason:** several of these
facts it found *by reading source* — the pipe-order mechanism, the `PUBLIC_INCLUDE` asymmetry, the
`skip`/`take` getter behaviour — in some cases before any document stated them. It could not
separate "the docs taught me this" from "I already knew it and would recognise it regardless of
what the docs said". That is precisely the bias §11 exists to exclude, and it is worth recording
that the disqualification was accepted by the party being disqualified rather than imposed.

## 11c. The gate RAN — one cold-gate defect, four confirmed documentation defects

A genuinely cold reader (no repo history, documentation-only bundle from PR head
`07125d3c0b00534edb62d658ddd44fbca478f21a`) answered the gate. **The gate is NOT scored and NOT
passed**; this run is treated as *experimental evidence*, and its main product is four confirmed
defects in the corpus plus one defect in the instrument.

### The instrument failed question 2 — the reader did not

Q2 as written asked for a status and a deciding component on `GET /admin/articles/not-a-uuid`. That
is an **`/admin` route**, and the corpus correctly teaches that global guards run before route
pipes — so `401`/`403` legitimately precede the intended `400` unless authentication is stated. The
question was underspecified; the reader nevertheless recovered the whole intended truth (after
guards: `400`, `ParseUUIDPipe` decides, `ValidationPipe` runs earlier and is a no-op on a simple
path param).

**Recorded as a COLD-GATE DEFECT. Q2 counts as neither PASS nor FAIL.** Rewritten above to state
the authentication assumption explicitly, and — because the reader's answer exposed that the
*component* is guessable from the route shape — the scored content moved to the ordering fact:
`ValidationPipe` runs first and still does not decide. The "wrong answer" column was updated
accordingly; it previously named `ParseUUIDPipe`, which is the **right** component.

*This is the second time a §11 question has been wrong about its own corpus, and the first time it
was wrong about the corpus being **right**.*

### Re-validation of all ten questions against the changed corpus

§11's own rule — *re-validate every gate question against the corpus immediately before running the
gate* — applies to this campaign's own edits, not only to the passage of time. Corpus changed in
this pass: `README.md` §النشر, `PROJECT_GUIDE` §15 (intro note, vocabulary block, items 1/8/10).

| Q | Verdict after the edits |
| :-: | --- |
| 1 | unchanged — archetype status table untouched |
| 2 | **rewritten** (above) |
| 3 | unchanged — `AllExceptionsFilter` ownership untouched |
| 4 | unchanged — envelope rule and the **حمولة** wording untouched |
| 5 | unchanged — the two size limits untouched |
| 6 | re-checked, still `locales` at step 4 on the fan-in-of-ten evidence; the `mail` insertion is at step 10 and does not move it |
| 7 | re-checked, still answerable — the depth-≠-readiness paragraph is **expanded**, not replaced; `contact` remains on the ridge |
| 8 | unchanged — README template untouched |
| 9 | unchanged — `test/README.md` untouched (see the source-access note below) |
| 10 | re-checked. The reader answered it correctly **and** used the `README`/`PROJECT_GUIDE` deployment contradiction as live proof of the danger. That contradiction is now fixed, so the proof is gone — but the *rule* it tests still lives in the `PROJECT_GUIDE` opening note and convention 4.D, which is where the question points |

### The four documentation defects the run produced, each verified before it was fixed

- **`README.md` §النشر asserted a deployment mechanism that does not exist.** It claimed a
  `vX.Y.Z` tag on `main` triggers deploy and attaches `openapi.json` as a release artifact.
  Verified against literal YAML at PR head: `deploy.yml` has `on: push: branches: [main]` +
  `workflow_dispatch` and **no tag trigger**; `openapi.json` is an `actions/upload-artifact` in
  `ci.yml`, and there is no `gh release`/`create-release` step anywhere. `PROJECT_GUIDE` §11 was
  already correct. **Both clauses were false.** Repo-wide sweep of all tracked Markdown found
  exactly one instance. Fixed by making `README` state the stable trigger in one sentence and
  hand mechanism detail to §11 + doc 23 — a single owner, rather than a second copy that will
  drift again. The `environment: production` approval-gate claim added to `README` was read off
  the `deploy` job's literal `environment:` key, not the workflow's comment header.
- **`$transaction` "first encounter" was false.** §15 item 8 called `redirects` the reader's first
  meeting with `$transaction`. It is at least the fourth: the archetype's admin-write flow
  (step 3), then `experiences`/`skills` (step 6), then `taxonomy` (step 7). What `redirects` is
  genuinely first at is **transaction-boundary ownership** — `buildRedirectOps` returns operations
  for the *caller* to push. Rewritten to say that, and to name where the earlier exposures were.
- **`mail` is a real prerequisite of `contact` and was absent from the reading order.** Confirmed
  from the `imports:` array (`contact.module.ts` imports `MailModule` and nothing else) and from
  the content: `contact`'s `PENDING`→`SENT`/`FAILED` machine is unreadable without three facts
  that live only in `mail/README.md` — `send` never throws and returns `MailSendResult`, retry is
  bounded with no retry on a permanent `5xx`, and the whole group is optional and disabled by
  default behind `SMTP_ENABLED`. Inserted before `contact` in step 10 with those three facts named.
  **`auth → users` was checked as the same shape and deliberately NOT treated the same:** `users`
  is 24 code lines, no controller, no routes, and this ledger's own concept-load table says "none
  beyond the archetype". It gets a one-clause mention, not a reading step — an import edge is not
  automatically a pedagogical prerequisite, which is the exact trap §15's intro warns about.
- **Framework vocabulary was used before it was available.** The order sends a Vue/Nuxt reader
  into `src/config` and `src/prisma` immediately, and both open on `@Global`, providers, DI,
  `imports`/`exports`, `ConfigModule.forRoot`, `extends PrismaClient`, and lifecycle hooks with no
  definition anywhere earlier in the path. Fixed with a bounded **eight-row vocabulary table** in
  `PROJECT_GUIDE` §15: one line of *what it means in this repo* per term, and the official NestJS
  page that owns the actual teaching. **Deliberately not a tutorial** — that is `principle 16`
  (`D00-6`) applied to the guide itself. Guards/pipes/interceptors/filters are excluded because
  §5/§6.1 already introduce them in place.

### One reported finding deliberately NOT actioned

The reader could not open the test-source files `test/README.md` points at (`boolean-query.spec.ts`
and the five-pattern examples). **That is an artefact of the experiment, not a defect.** The bundle
excluded source by design; a real learner has the repo. This documentation system is deliberately
**code-adjacent**, not documentation-only, and copying source into prose to make an artificial
bundle self-contained would damage the thing being measured. `test/README.md` restates each
principle in prose before pointing at its example, so the prose does not depend on the source to
teach. **No change.**

### What the run actually established

The **nine scoreable questions — four of the five in §A, and all five in §B — were answered
correctly** from the documents alone, by a reader with no repository history; including the three
the campaign considered its hardest teaching problems (the layer that rejects first, the missing
`try/catch`, the two unrelated size limits). The tenth is Q2, which belongs to §A and is unscored
because the question was defective; the reader recovered its intended fact anyway. **That is the campaign's core claim surviving its first external test.**
Against that: the corpus still contained a false deployment mechanism, a false "first encounter",
a missing prerequisite, and an unmet vocabulary assumption — and **none of the four were found by
the ten gate questions**. They were found by a cold reader reading *around* them. *A gate measures
what it was pointed at; the reader measured the corpus.*

### Two defects in the fix, caught by self-review before the peer saw them

Recorded because the campaign's rule is that self-review does not substitute for peer review — not
because it found nothing, but because it cannot be trusted to.

- The vocabulary table's `@Global` row said the decorator is on `AppConfigModule` and `PrismaModule`
  **"only"**. True of the decorator, and **false of the effect**: `auth.module.ts` registers
  `JwtModule` with `global: true`, and `auth/README.md` says so in as many words. A reader reaching
  step 10 would have hit a flat contradiction with a table written to prevent exactly that. Row now
  names both mechanisms.
- The intro note first told the reader that `settings`, `seo` and `testimonials` are "archetype
  repetition with no new idea". **This ledger's own concept-load table contradicts that for two of
  the three:** `settings`/`seo` carry singleton / per-key upsert with locale resolution. Only
  `testimonials` is "none beyond the archetype". Rewritten to say what is true — those two carry a
  real idea, it is simply not one a later step depends on. *Writing a skip-list is a claim about
  content, and it has to be measured like any other.*

### Instrument note — `zsh` silently ate two git refs, and a `>` redirect destroyed a file

Twice in one session, `git show "$SHA:PROJECT_GUIDE.md"` and `git rev-parse "$SHA:src/..."` failed
with *bad substitution* / *ambiguous argument*. Cause: in `zsh`, `"$VAR:x…"` where `x` is a
**history-modifier letter** (`s P h t r e a A c l u q x f F w W`) is parsed as a modifier, not as a
git `rev:path` separator. `$SHA:src/…` reads as the `:s` substitution; `$SHA:PROJECT_GUIDE.md`
reads as `:P` (realpath).

**The second one was destructive, and the destruction was silent.** The command was
`git show "$SHA:PROJECT_GUIDE.md" > bundle/PROJECT_GUIDE.md` — the shell performed the `>`
truncation **before** git ran and failed, so a 46 KB file became 0 bytes while the only visible
symptom was a git error about an unknown revision. The bundle was then checksummed, made read-only
and zipped in that state; the zip dropped from 114 KB to 95 KB, which was the only other signal.

*Two rules, both cheap:* build git refs with `printf '%s:%s' "$SHA" "$PATH"` so no modifier letter
can ever follow a bare `$VAR:`, and never let a failing command's `>` redirect be the only thing
standing between you and a file — write to a temp path and move it. **And the reason this was
survivable at all is that the recovery was a rebuild from the object store, not a repair of the
damaged tree** — the same instinct as the negative-control rule: do not trust a tree you have
just mutated.

### Instrument note — how the eight official links were actually verified

HTTP status is **not** a usable instrument here: `docs.nestjs.com` is client-rendered and returns
`200` with a byte-identical shell for a fabricated path (`/this-page-does-not-exist-xyz`).
Negative control fired, so status codes were discarded. Verified instead against the docs **source**
repository (`nestjs/docs.nestjs.com`, `content/*.md`), where the same fabricated path returns `404`
— a discriminating instrument. All eight resolve; the two anchors (`#dependency-injection`,
`#global-modules`) were confirmed as real headings in `components.md` and `modules.md`. Note that
`/providers` is published from `content/components.md`, so a naive path-to-file check reports it
missing; that is a routing fact, not a broken link.

### The peer round on the fix — nine findings, three MAJOR, all accepted

Self-review had already caught two defects (above) and still shipped **nine more** into peer
review. Recording the split, because the campaign's claim is not that self-review is worthless but
that it is **not sufficient**, and this is the measurement of that.

- **MAJOR — the approval gate was inferred from the wrong artefact.** The new `README` sentence
  said the cutover job *stops for owner approval* because it is bound to `environment: production`.
  The binding is in the `YAML`; the **pause is not** — required reviewers are an environment
  setting outside every workflow file, and an environment with no protection rule does not pause.
  This is the repo's own rule (*CI provenance comes from literal YAML*) failing in the opposite
  direction: not prose over YAML, but **inferring from YAML something YAML cannot carry**. Now
  states the binding as fact and attributes the approval requirement to `D23-16`/`D23-17`.
- **MAJOR — "one pipeline per SHA" is wrong, and the missing mechanism was the interesting part.**
  `deploy-fallback.yml` exists (`pull_request: closed` on `main`) and dispatches `deploy.yml`,
  because the `push → main` event is intermittently dropped. A merge can therefore start **two**
  runs on the same `SHA`; the concurrency group and `preflight`'s `already-deployed` verdict make
  the pair idempotent so at most one reaches a server write. Corrected in `README` **and** in
  `PROJECT_GUIDE` §11, which carried the same claim independently of this pass.
- **MAJOR — the rewritten Q2 was still underspecified.** Assuming authentication and authorization
  does not settle it: `ThrottlerGuard` is the **first** global guard, and the archetype itself
  documents `429`. The assumption now covers all three guards. *A gate question defective in the
  same way twice, caught the second time by the peer rather than by the fix.*
- **MINOR ×3 in the new vocabulary table.** `provider` was defined as "a class the framework
  instantiates" — this repo registers `useFactory` and `useValue` providers (`STORAGE_ADAPTER`,
  `MAIL_TRANSPORT`), so the definition excluded live code. `decorator` was defined as "metadata,
  not code that runs at the line" — decorators **do** execute at class-definition time; the
  intended distinction was *not per-request*. And the table claimed to be sufficient for the next
  two documents while `src/prisma/README.md` opens on **data mapper** and **repository**, neither
  defined anywhere. All three fixed; the last one inside `src/prisma/README.md`, where the terms
  are actually used — *a glossary that does not cover the sentence that motivated it is decoration.*
- **MINOR — the fix introduced a contradiction into this ledger.** §11's *"Status: NOT YET RUN"*
  sat directly above §11c's *"The gate RAN"*. Marked historical and superseded. **The campaign's
  own defect, committed while documenting that defect class.**
- **MINOR — a miscount.** §11c said "the five §A questions and the four other §B questions".
  Q2 is in §A: the split is **four of five §A, all five §B**. The wrong split silently implied a
  §B question had failed.
- **MINOR — `src/contract/README.md` still called `openapi.json` a release artifact**, which
  `PROJECT_GUIDE` §11 records as deferred work. The rot claim survived in a third file that
  neither the cold reader nor the deployment sweep reached, because it is phrased as a
  compatibility verdict rather than as deployment state. *Sweep by claim, not by section heading.*

### The rerun, and why it needs a different reader

A **new** cold reader (never this one, never coached) answers from a bundle rebuilt at the new PR
head. The ten §A/§B questions are re-asked as the comparable instrument. The **§C regression set**
below is scored **separately**, so the 8-of-10 threshold keeps meaning exactly what it meant
before — a repair set folded into the original score would make the two runs incomparable.

### §C — regression set (scored separately; one question per repair)

Same protocol: documentation alone, no source, no search, no asking. Each targets a claim that was
**false in the previous head**, so a reader carrying the old text answers wrongly.

| # | Question | Wrong answer the previous head would have produced |
| :-: | --- | --- |
| C1 | Which git event starts a production deployment, and how many workflow runs can a single `dev → main` merge produce? | "a `vX.Y.Z` tag" · "exactly one run" |
| C2 | Which document owns the deployment mechanism in detail, and what does the other one deliberately refuse to restate? | "both describe it" — the failure mode being repaired |
| C3 | Reading in the documented order, where do you **first** meet `$transaction` — and what is `redirects` actually the first module to teach? | "`redirects`, and it teaches `$transaction`" |
| C4 | Why must `mail` be read before `contact`? Name one thing in `contact` you would misread without it. | "you needn't — `contact` is self-contained" · "because `contact` imports it" (an edge, not a reason) |
| C5 | Does the reading order follow the module dependency graph? If not, give the counterexample the guide names, and the reason it accepts it. | "yes — it respects dependencies then ascends concept load" |
| C6 | You are a Vue/Nuxt engineer opening `src/config/README.md` for the first time. What does the guide expect you to have read first, and what does it explicitly refuse to teach you? | "nothing in particular" · "the guide teaches you NestJS" |

**What C2 and C5 are really testing** is not recall — it is whether the corpus now teaches its own
*discipline*: single ownership of volatile mechanism, and a stated deliberate departure instead of
a comfortable false claim. Those are the two failure modes this campaign exists to remove, and a
reader who can name them from the documents is the only evidence that they were removed rather
than relocated.

**Answers are NOT written down anywhere in the bundle, and must not be.** They live in the code and
in this ledger, which is excluded from the bundle by construction.

## 11d. Run 2 — the gate scored 16/16 and a real defect was still standing

Second cold reader, new, uncoached, documentation-only, on a bundle from the post-repair head.

| Set | Score |
| --- | :-: |
| §A — the invisible layers | **5 / 5** |
| §B — architecture and method | **5 / 5** |
| **Main gate** | **10 / 10** (threshold was 8, and the two misses were not to come from §A — zero misses) |
| §C — regression set | **6 / 6** |

**By its own definition the scoring gate PASSES.** All four repairs held under an independent
reader: the deployment mechanism and its single owner, the `$transaction` ownership distinction,
`mail` as a true prerequisite of `contact`, and the departure from the dependency graph — each
recovered from the documents alone, with the *reasons*, not just the facts.

### And that is exactly why the next sentence matters

**The reader's open-ended assessment found a HIGH-confidence prerequisite defect that none of the
sixteen questions touched.** `PROJECT_GUIDE.md` used framework vocabulary long before the reader
reached the vocabulary table this campaign had just added.

Verified before touching anything: `decorators` first used at **line 33** (§2 — *"يُنفَّذ العقد في
الكود بـ `decorators` من `@nestjs/swagger`"*), dependency injection at **line 99** (§5 — *"الـ
services تحقن `PrismaService` مباشرة … مقعد الاختبار (seam)"*), and the table at **line 383** — §15,
about 84 % into the document. **A linear first read met the vocabulary after thirteen sections had
already relied on it.** The curriculum in §15 was correct and the fix in §11c was correct; what was
wrong is that *nobody reads a guide by jumping to §15 first*, and the campaign had verified the
declared order without ever verifying the **physical** one.

*Run 1's lesson was "a gate measures what it was pointed at". Run 2 is the same lesson with a
**perfect score** attached, which is strictly stronger evidence: 16 of 16 correct, and a real
learning-path defect standing the whole time. **A passing gate is not a proof that the corpus is
sound — only that the corpus answers these sixteen questions.** The open-ended assessment, which
carries no score at all, has now out-produced the scored instrument in both runs.*

### The repair — moved, not copied, and permanently unnumbered

The single table now sits **before §1** as an **unnumbered `##` section**. Unnumbered on purpose
and for good: `README.md` cites `PROJECT_GUIDE.md` **§11** by number, so inserting a numbered
section at the head would shift every later number and break that citation silently. §15 keeps a
back-reference only — duplicating the table would rebuild the two-copies-that-diverge defect this
campaign removed from the deployment text one section earlier.

### The peer round rejected the first attempt, and was right

- **MAJOR — the carve-out did not hold.** The block claimed guards/pipes/interceptors/filters
  "need no introduction here" because §5 and §6.1 cover them. §5 **positions** them in the pipeline
  diagram but never defines a *pipe*, and `DTO`/`ValidationPipe` appear at line 101 with
  interceptors at line 106 — **inside §4, before §5**. Five bounded rows added (`DTO`, `pipe` ·
  `ValidationPipe`, `guard`, `interceptor`, `exception filter`), one line each plus the official
  page that owns the teaching. *The exclusion was written from the declared reading order again —
  the identical mistake, one layer down.*
- **The rationale paragraph named `decorators` and dependency injection above the rows defining
  them** — the defect being fixed, reproduced one paragraph higher. Moved below the table.
- **The no-renumbering rationale was overstated:** it claimed all sixteen numbers are cited
  externally. Exactly one is (`README.md` → §11). Narrowed to the truth; the decision survives it.
- **"This guide uses framework vocabulary without definition" became false** the moment the table
  moved into this guide. Now says the *rest* of the guide does not redefine the terms per
  occurrence.

**After the fix, every one of the thirteen terms has its first occurrence inside the block**
(lines 19–37); §1 begins at line 46. The five new `docs.nestjs.com` links were verified against the
docs **source** repo with a fabricated path as negative control (`404`), since the site itself
returns `200` for any path.

### The second observation was evaluated and is NOT a defect

The same reader flagged (MEDIUM confidence) that PostgreSQL authentication terminology —
`pg_hba.conf`, `trust`, `scram-sha-256`, `SASL` — is assumed rather than taught in
`src/prisma/README.md`. Measured against the campaign principle: *the repository must teach why
**this** implementation behaves as it does; it need not teach PostgreSQL administration.* The prose
already carries the full causal chain (`localhost` → `::1` → a different `pg_hba` rule → a
passwordless role → `SASL` fails), which is what the `127.0.0.1` invariant actually requires.

**One bounded sentence added anyway**, at `pg_hba.conf`'s **first** appearance in the declared
reading path (`PROJECT_GUIDE` §10, not `src/prisma/README.md` where the reader hit it — the guide
is upstream): what the file is, what `trust` and `scram-sha-256` mean, and an explicit statement
that PostgreSQL administration is out of scope. Defined once, upstream; `README.md` and
`src/prisma/README.md` deliberately left un-glossed rather than carrying three copies of it.

### What the exit gate now waits on

**A targeted regression only** — the change is narrowly about prerequisite placement, so re-running
all sixteen questions would measure nothing new. A **new** reader, uncoached, reads
`PROJECT_GUIDE.md` from the top and answers: before the first section that materially uses
framework vocabulary, did the guide already supply the minimum needed to continue; which concepts
did it prepare them for; and did any required term appear before it was introduced. **It must pass
without coaching.** If it does and nothing new surfaces, the campaign exit gate is satisfied.

## 11e. Run 3 — the targeted regression did NOT pass, and it was right not to

Third cold reader, new, uncoached, on a bundle from the post-placement head.

| Question | Result |
| --- | --- |
| Q1 — was the minimum vocabulary in place before first material use? | **YES**, HIGH |
| Q2 — name the concepts prepared | HIGH, enumerated all thirteen |
| Q3 — any term needed before it was introduced? | **NOT CLEAN** — `Controller`, MEDIUM |

**The pre-registered criterion required Q3 clean, so the regression FAILS.** And the failure is
real: `Guard → Pipe → Controller` and *"بين الطلب والـ controller"* both sit **inside** the
vocabulary block, at lines 28 and 34, while `controller` was defined only at line 134 (§5). The
placement fix had moved the block to the head and then reproduced the original defect **inside the
block itself**. *The MEDIUM confidence was the reader hedging on whether an ordinary English word
needs defining in a Nest-specific sense. It does — `controller` here is a routing class with a
`@Controller()` decorator, not a colloquialism.*

### The five open-ended findings — all five confirmed, and two were worse than reported

Again the **unscored** instrument out-produced the scored one. Third run, third time.

- **`PROJECT_GUIDE` §10 classified `preview` as `Planned`.** It has a module, two controllers, a
  service, a README, four `OpenAPI` routes and a registration in `app.module.ts`. The label was
  removed, not corrected — a corrected lifecycle label rots again. **And the same defect class
  survived in `src/config/README.md`**, which asserted that previously-`Planned` modules "have
  become delivered". Found by sweeping the *claim*, not the file the reader named.
- **The media descriptor contract — worse than reported, and `openapi.json` decided it.** The
  reader saw two module READMEs contradicting the general rule. The contract shows the rule holds
  for `coverImage`, `ogImage`, gallery `mediaAsset`, `avatar`, `portrait` — so `articles` and
  `testimonials` were simply **wrong**. But `PublicSiteSettingsEntity` carries **no
  `resumeAssetId` at all**: `resumeAsset` *replaces* it, and it is the only field resolved by
  `resolvePdf`. **So the campaign's own general rule was overbroad and named that exact field as an
  example of itself.** `AdminSiteSettingsEntity` also uniquely carries a resolved `portrait`, so
  "admin is always raw" was wrong too. **Four statements narrowed, not two** — verdict D.
- **`settings/README` advertised `GET /settings?locale=`.** The controller and the contract have
  only `GET /settings/site`. No bare public `/settings` exists.
- **The archetype's `400` summary** said `400` means "rejected before the body was read". Its own
  table contradicted it and the source confirms the table. **The retired model also survived in
  `src/common/README.md`** (*"`400` محجوز للطلب المُشوَّه"*) — a second partial-sweep miss in the
  same round.
- **`prisma/README.md` cited `docs/09-database-design.md`.** There is no `docs/` directory in this
  repository, so **nobody could follow that prerequisite** — with or without the governing repo.
  **Not a bundle artefact.** The reader flagged it at MEDIUM as an artefact; it was a real dead
  pointer, and rating it MEDIUM cost nothing because the finding was still checked.

### Two peer rounds on the repair, and I failed the same way three times

**The peer found four MAJOR in the first repair round**, including two that are the campaign's own
signature defect turned on itself:

- I claimed *"every row is readable using only the rows above it"* — an absolute, and false: the
  `DI` row names `PrismaService`, defined below it.
- I asserted **"`preview` is the ONLY deliberate exception"** to the thin-controller rule **without
  sweeping the controllers.** Sweeping found five: `redirects` (`null` → `404`), `media`
  (missing `file` → `400`; deduplicated → `200` not `201`), `auth` (refresh cookie),
  `messages.admin` (absent `req.user` → `401`), `preview` (`verify()` → `404`).

**The correction is a better lesson than the claim it replaced:** the line is not *"no code in a
controller"* — it is **no domain rules**; an `HTTP`-shaped decision belongs at the boundary. And
`preview` is not the only exception, it is the only one whose decision is a **security** decision —
`403` would prove the draft exists. That table now lives once, in the archetype.

**A second peer round then found five more**, including that my `400` enumeration was *still*
incomplete (five sources, not three; and `ParseUUIDPipe` is on `@Param` in all **35** uses, never
`@Query`), and that I had over-claimed in the opposite direction — *"`422` means the body was read
and failed validation"* is false, since `access-control` returns `422` from a **bodyless** `DELETE`.

*Three rounds, three unswept absolutes — "only", "every", "one fixed meaning". The pattern is not
carelessness about facts; every individual fact was checked. It is that a **quantifier** feels like
prose and is actually a claim, and this campaign has no instrument that checks quantifiers. That is
the finding worth keeping.*

### An instrument was lying, and the peer caught it

The link checker used all round special-cased any path containing `eslammuatamed-docs` onto the
primary checkout — so **wrong-depth links passed as clean.** Rebuilt to resolve every link from its
own file's directory, and **negative-controlled**: it now passes a corrected depth and fails the
real one. It immediately found three dead links the campaign had never seen —
`src/modules/seo/README.md` (×2) and `.github/PULL_REQUEST_TEMPLATE.md`, all resolving **inside**
this repository. Full sweep now: **61 files, 0 broken.** *The clean readings this instrument gave
in Runs 1 and 2 were not evidence; they were the instrument's blind spot.*

### Two peer items pushed back on, with reasons

- **"deferred"/"future item" labels in `seo/README`** are an accepted category here —
  `PROJECT_GUIDE` §14 is titled *"مخاطر معلومة وعمل مؤجَّل"* — and each is attributed to the
  governing document that owns it. Deferred work is not release state.
- **"Rewrite the governing links as absolute URLs"** because they do not resolve from
  `~/worktrees`. That is a property of the review environment: the sibling docs checkout is absent
  there, which breaks *every* pre-existing governing link equally. The depths are correct under the
  repository's actual layout, and the rebuilt checker confirms it.

### Owner-facing, deliberately not fixed on this branch

`POST /api/v1/admin/media` can return **`400`** (missing `file` part, thrown in the controller and
covered by tests) and **`openapi.json` does not declare it.** A real contract gap — but declaring it
*changes the contract*, and this branch is documentation-only. It needs the doc 16 §3 flow
(export → version → `web` adopts) as its own change. **Queued, not silently absorbed.**

## 11f. Run 4 — the regression failed on the block's *inside*, and the sweep found a fourth

Fourth cold reader, new, uncoached, documentation-only, on a bundle verified blob-identical to
`9c7ec640`.

| Question | Result |
| --- | --- |
| Q1 — minimum vocabulary in place before first material use? | **YES**, HIGH |
| Q2 — name the concepts prepared | HIGH, enumerated all fourteen rows of the block |
| Q3 — any term needed before it was introduced? | **NOT CLEAN** — three sites, MEDIUM |

**Run 3 moved the block to the head of the guide; run 4 shows it was never ordered *internally*.**
The reader named three: `DI` used `PrismaService` (defined three rows down), `@Global` used "dynamic
module" (one row down), and `controller` handed **قواعد المجال** to a `service` that had **no row at
all** — its architectural meaning lived in `§5:143`. *The reader hedged at MEDIUM on whether an
ordinary English word needs a definition. It does: `service` here is the layer that owns domain
rules, and the controller row is unreadable without it.*

**Sweeping all fourteen rows found a fourth the reader missed** (and a mechanical re-check later found
a fifth — below)**:** the `PrismaService` row says the
class enters "`DI` ودورة حياة `Nest`" while the lifecycle-hooks row sat **below** it. Reported: 3.
Actual: 4. *Third round running in which the sweep beats the report — which is the argument for
sweeping the invariant rather than the named sites.*

### The repair, and the cycle that forced a wording change

`DI` needs `PrismaService` as its example; `PrismaService` needs `DI`, `provider` and the lifecycle
hooks to be defined. **That is a genuine cycle — no ordering breaks it**, which is why the previous
round settled for *acknowledging* the forward references instead of removing them.

Broken on the `DI` side, where the cost is lowest: the row's point is the **test seam**, and the seam
is stated without naming the class (`يُمرَّر بديل مُموَّه بدل التبعيّة الحقيقيّة`). Final order:
`decorator → service → provider → @Module → DI → dynamic module → @Global → lifecycle hooks →
PrismaService`, then the request-layer table unchanged.

### The claim was absolute, so it got an instrument — and the instrument beat the reading

The ordering claim is exactly the shape this campaign keeps getting wrong, so it was checked
mechanically rather than by re-reading: parse the fifteen rows, take each row's **first cell** as the
definition site of its term, then search every other row's **description** for that term with
word boundaries and flag any use above its definition.

**It failed on the first run, on a row a careful read had already cleared.** The `provider` row said
*"كلّ `*.service.ts`"* one row *above* the new `service` row. Reading it, that is plainly a filename
and not a use of the concept — which is precisely the reasoning that lets a forward reference ship.
**The published claim is an absolute and does not carry that nuance**, so the rows were swapped
(`service` now precedes `provider`) rather than the matcher weakened. *Weakening a matcher to fit the
corpus is how the link checker started lying.*

| Control | Expected | Got |
| --- | --- | --- |
| Current block | PASS | `rows=15, forward_refs=0` |
| Move the `PrismaService` row back above `DI` — the original run-4 defect | **FAIL** | FAIL, flagged `line 30 uses 'DI' defined at 31` |
| Restore | PASS | PASS; file `sha256`-identical to pre-mutation |

*The lesson is not "write more instruments". It is that **an absolute deserves a mechanical check even
when — especially when — a careful human read has already cleared it**. Four rounds of this campaign
have now been lost to a quantifier that survived a careful read.*

**And the prose above the tables had to move with them.** It described the two forward references as
deliberate — a sentence that was itself written as a *correction* to an earlier false absolute. Fix
the rows and that sentence becomes false. **Fifth time a repair on this branch would have
manufactured a falsehood elsewhere if the surrounding prose had not been re-read.**

*The new claim is an absolute and is stated as one:* no row needs a row below it or a later numbered
section. Backed by a row-by-row sweep of a finite, small set — fifteen rows — and the parenthesised
section references were checked to be detail-only, not load-bearing.

### The six confirmed open-ended findings, each verified before it was touched

- **CI e2e mechanism — the guide was wrong and there were *three* copies.** `PROJECT_GUIDE` §11 said
  the lane runs `migrate deploy` → `db:seed`. **Literal YAML** (`.github/workflows/ci.yml`, e2e job)
  runs `checkout → setup-node → npm ci → prisma generate → test:e2e` and nothing else; the harness
  owns its database (`D18-8`). `README.md` and `test/README.md` were both *correct* — which is the
  actual problem: a volatile mechanism written three times independently. §11 now owns the step list;
  `README.md` points at it; `test/README.md` keeps only the harness's own fact.
- **`media/README` stated the descriptor rule with no exception.** Confirmed against the contract —
  and the sweep *cleared* two neighbouring absolutes rather than condemning them. A script over every
  schema in `openapi.json` found `PublicSiteSettingsEntity.resumeAsset` is the **only** descriptor
  field with no sibling raw `*Id`, and `AdminSiteSettingsEntity.portrait` the **only** descriptor on
  an admin entity. So `PROJECT_GUIDE` §6.5's "الاستثناء الوحيد" and "بقيّة الكيانات الإدارية خامّة"
  are both **exhaustively true**, and only the media README was overbroad. *An absolute that survives
  its sweep is worth as much as one that falls.*
- **`projects/README` named the field `blurDataUrl`.** The contract declares `blurhash` (6
  occurrences); `blurDataUrl` occurs **nowhere else in the repository** — a single stale site, not a
  competing convention.
- **The reading-order counterexample was right; the module READMEs were wrong.** The reader suspected
  `PROJECT_GUIDE`'s "`articles` و`projects` تستوردان `media`". `articles.module.ts` and
  `projects.module.ts` both declare `imports: [LocalesModule, MediaModule, RedirectsModule]` — a real
  Nest module import **and** a provider injection (`MediaDescriptorResolver` in both constructors).
  **The defect was the inverse of the report.** Sweeping the family found **four** wrong dependency
  maps, not two: `testimonials` and `settings` inject `MediaDescriptorResolver` too. And
  `articles/README` claimed *"لا وحدة أخرى تستورد `ArticlesService`"* while `preview.module.ts:13`
  imports `ArticlesModule` — a false absolute the reader never asked about.
- **§10 read as the validated set and was not one.** The schema validates **29** variables; §10 named
  **20**. Missing: the whole `SMTP_*` group with `CONTACT_NOTIFICATION_TO` (the reader's finding) and
  **`PUBLIC_WEB_URL`** (found by diffing the list against `env.validation.ts`). Repaired by *narrowing
  the framing* — `.env.example` and the schema are named as the only binding list — plus one clause
  naming the two absent groups. Completing the enumeration here would have created a second
  configuration reference that drifts at the next variable.
- **`test/README` counted six types above a table of seven.** Confirmed by counting rows.

### One reported finding split, and two deliberately not actioned

The reader's media-descriptor item and its `blurhash`/`blurDataUrl` item were reported as one
contradiction each but resolve from different authorities, so they are recorded and repaired
separately.

- **`openapi.json` absent from the bundle** — an **experiment artifact**. The file exists at the repo
  root (335 KB). The learning path points at a real artifact; the bundle simply did not carry it.
- **The doc-09 prerequisite in the sibling repo** — an **experiment artifact**. `prisma/README.md`'s
  `../../eslammuatamed-docs/docs/09-database-design.md` resolves correctly under the primary-checkout
  convention (verified: the file exists there). It does not resolve from `~/worktrees` because the
  sibling checkout is absent *there* — a property of the review environment, already settled in §11e.
  The rebuilt link checker resolves depth from each file's own directory and passes it.
- **Compatibility conclusions** the reader could not audit from prose alone — **not a defect**. Each
  names its authority and the pinned version; a learning document may state a verified conclusion
  without embedding the audit.

### Found and deliberately DEFERRED — not fixed on this branch

`.github/workflows/ci.yml:161` carries a job comment — *"Integration lane — spins up Postgres 16 and
runs migrations, seed, and the e2e suite"* — that reads against the inline comment eight lines below
it (*"No migrate/seed step…"*, `:208`) and against the job's own steps. It is a real clarity defect.
**It is not repaired here:** `ci.yml` is outside the 27-file code-adjacent corpus and outside the
315 source files the guard reads, no cold reader has ever seen it, and touching a workflow file
widens this branch's declared surface for no learnability gain. Queued, not absorbed.

### An open measurement, recorded rather than guessed

`test/README.md`'s type table gives per-row file counts summing to **93**. The table was left alone,
and the reason is worth more than the number.

**First attempt, and it was wrong.** A census of `*.spec.ts` under `src/` and `test/` returned 90,
so the residual "pointed at" the hedged `~٢٩` row being nearer **26**. That census was incomplete:
`package.json`'s jest config declares **four** roots — `src`, `../prisma`, `../test/utils`,
`../scripts` — and the last three hold six spec files that a `src`+`test` walk never sees. The real
totals are **61 non-`e2e` + 34 `e2e` = 95**, confirmed independently by `npm test` reporting
`61 passed, 61 total` suites. So the table does not over-count by 3; it **under-counts by 2**, and
the residual now points at `~٢٩` being nearer **31** — *the opposite direction from the first
derivation.*

**Nothing was changed, and that decision has now survived being wrong three times.** The residual has
moved every time one of its *inputs* was corrected, and never once because anyone measured the row
itself:

| When | Residual for `~٢٩` | What changed underneath it |
| --- | :-: | --- |
| First derivation | **26** | census missed two of `jest`'s four roots (total read as 90) |
| Census corrected | **31** | true total is 95 |
| `١٩ → ١٦` landed (peer round 1) | **34** | the mocked-`Prisma` row had been a filename count |

*Had any one of those been written into the corpus at the moment it was derived, the file would now
carry a confident number that later evidence contradicts — and the two later corrections would have
had to chase it.* The arithmetic is `61` non-`e2e` specs minus the four named non-`e2e` rows
(`3 + 16 + 3 + 5 = 27`).

What actually holds, measured rather than derived: the `30 + 4 = 34` `e2e` split is exact against a
direct count; `3` DI-booting files is exact against `@nestjs/testing`/`NestFactory`; and `16` now has
**two independent derivations**. The remaining three categories cannot be separated by filename or
`grep` — "structural via reflection" and "unit with a mocked `Prisma`" both match ordinary controller
specs — so settling `~٢٩` still needs a per-file read of all 95 specs.

**⚠ OPEN, AND THE DEFERRAL IS ITSELF A CLAIM NOW.** The corpus still reads `~٢٩` while the arithmetic
reads **34**, and a `~` does not stretch five files. The reason for not writing `34` is unchanged and
still good — the reflection (`3`) and schema/migration (`5`) rows have never been verified per file
by anyone, and no peer round has audited them, so `34` would be a residual over unaudited inputs for
the fourth time. **But at three derivations, "deferred" stops being neutral:** it is a standing
statement that a published number is probably wrong by five and is being left. Carried into the
handoff explicitly rather than left to read as settled.

*The instrument lesson, which generalises past this table:* **a spec-file census must be taken from
the runner's own roots, never from a directory list you thought of.** The guessed list was wrong by
six files and produced a confident residual in the wrong direction — a clean-looking number from an
instrument that could not see part of its own subject. Same failure shape as the guard's four blind
spots and the link checker's, and the third time on this campaign that a count was derived rather
than measured.

### The dependency-map family, swept — and where the sweep stops being evidence

Every module under `src/modules/` with a `README.md` was compared against its `*.module.ts`
`imports:` array and its services' constructor parameters:

| Module | Verdict |
| --- | --- |
| `articles` · `projects` · `testimonials` · `settings` | **were wrong — repaired this round** |
| `seo` | **already correct** — it named `MediaDescriptorResolver` before this round. *The family had a
member that was right, which is why "sweep the family" is not the same as "apply the fix everywhere".* |
| `access-control` · `experiences` · `locales` · `redirects` · `skills` · `taxonomy` · `users` | consistent |
| `media` | it is the owner of the descriptor, not a consumer |

**Where this instrument stops:** it reads `src/modules/<m>/*.service.ts` and does **not** descend into
subdirectories, so a module whose dependency lives in a nested service (`auth/tokens/…`) is invisible
to it. `auth`, `contact` and `media` each show a difference under this coarse reading that may be the
blind spot rather than a defect. **They are therefore NOT recorded as clean**, and they are not
repaired on a reading the instrument cannot support. A per-module check that walks nested services is
queued. *A sweep that names its blind spot is evidence; one that does not is a clean reading of
nothing.*

### The link checker, rebuilt again — and its rule written down this time

§11e rebuilt this instrument after it was caught special-casing any path containing
`eslammuatamed-docs` onto the primary checkout, which let **wrong-depth** links pass. That rebuild
was not committed anywhere, so it had to be written a third time. **The resolution rule, in full, so
the next session does not re-derive it:**

> Every link resolves from **its own file's directory**, against a *virtual* repo root equal to the
> primary-checkout path `…/Work/eslammuatamed/eslammuatamed-api`. If the resolved path stays inside
> that root it is then checked inside the **worktree**; if it escapes (a sibling repo) it is checked
> on the **real filesystem**. `http(s)`, `mailto:` and bare `#anchors` are skipped; a `#fragment` is
> stripped before resolution. No path is matched by substring anywhere — that was the defect.

Relocating the root preserves **depth**, which is the property the old instrument destroyed, and the
negative control is what proves it:

| Control | Expected | Got |
| --- | --- | --- |
| Mutate one sibling link `../` → `../../` | **FAIL** | FAIL — flagged that link only |
| Append a dangling in-repo link | **FAIL** | FAIL — flagged that link only |
| Restore both (`cp -p`, not `git checkout` — the tree was dirty) | **PASS** | PASS, and both files `sha256`-identical to their pre-mutation state |

**Reading on the final tree: 61 Markdown files, 119 relative links, 0 broken** — the *wide* scope,
including `.campaign/` and `.specify/`. *Stated because a narrower scope had passed first: excluding
those two directories reads 30 files / 116 links and also passes, and a checker that skips part of
the corpus reporting PASS is exactly the shape of the failure this instrument already had once.*

### The peer round — 7 MAJOR + 1 MINOR on the repair, and the repair's own quantifier fell

Codex reviewed `9af1aac..21c20f1` (corpus only). **It found more in the repair than the repair found
in the corpus.** Every finding was re-verified here before it was acted on; two were corrected
*upward* in the process.

| # | Finding | Verified? |
| :-: | --- | --- |
| 1 | The new ordering absolute over-reached: the `service` row leans on `transaction`, which no row defines and §5 only *repeats* | **YES** — claim narrowed to the block's own vocabulary; `transaction` glossed inline |
| 2 | **«كلّ ملفّ `*.service.ts` هنا من هذا النوع» is false** — `AppConfigService`, `PrismaService`, `MailService`, `MediaProcessingService` own no domain rules | **YES** — my own unswept quantifier, written in the round *about* quantifiers |
| 3 | The `DI` row's seam wording implied the container does the substituting; and the inter-table prose said the request "passes through" all lifecycle layers before its destination — false for `interceptor` (wraps, runs after) and `exception filter` (only on throw) | **YES**, both |
| 4 | §11's e2e step list omits `checkout` and `setup-node`; and "CI مساران" is not the literal job count — `ci.yml` has `policy`, `verify`, `e2e` | **YES**, both |
| 5 | *(MINOR)* the CI mechanism is still summarised in two other files | **PARTLY** — `README.md` trimmed; `test/README.md:88` kept deliberately, see below |
| 6 | Dependency-map repairs stopped at the four edited siblings | **YES**, four more sites |
| 7 | §10's "every variable is validated, a missing one fails boot" is false for conditional/optional variables; `mail/README` claims **all** SMTP fields are required when enabled, but `SMTP_SECURE` is optional and defaults to `true`; and `src/config/README` held a third variable inventory that omitted `PUBLIC_WEB_URL` | **YES**, all three |
| 8 | The test taxonomy's counts are family counts, not technique counts | **YES** — see below |

**Finding 6 is the one worth keeping.** The sweep this round checked every *consumer* README against its
module and services, found `seo` already correct, and recorded that as evidence the family was closed.
It was not: `media/README.md:24` lists the resolver's consumers and **omits `seo`** — the same fact,
from the other end, in the file that owns it. *Checking A→B is not checking B→A.* Also found:
`media` injects `LocalesService` and its own map omitted it; `locales/README` enumerated seven
importers under "كلّ وحدة محتوى" when ten modules import `LocalesModule`; and `contact/README`
omitted `AppConfigService`, which the earlier coarse sweep had flagged as *possibly* a blind spot and
declined to settle. **The blind spot was real and the peer settled it.**

**Finding 8 vindicates leaving `~٢٩` alone, and then goes further.** The `١٩` row is exactly the
number of files named `*.service.spec.ts` — a **filename family counted as a technique**. Measured by
technique instead, with the rule stated in the file: **3** boot a real `Nest` container, **22**
construct a service with `new` (not 19 — and four of them are not `*.service.spec.ts` at all), **16**
of those pass a mocked `PrismaService`, and of the 34 `*.e2e-spec.ts` files **30** use `supertest`
and **4** do not (the table said 31/3). The rows now carry the measured figures, and the table
carries an explicit statement that its categories are the *dominant* technique, do not partition the
95 files, and must not be summed.

**Pushed back on, with a reason:** `test/README.md:88` states that CI runs the suite with a
`postgres:16` service and does not migrate or seed. That is the **harness's own** architectural fact
(`D18-8`) — the reason there is no second setup owner — not a restatement of the workflow's step
list, which now lives only in §11. Removing it would take the *why* out of the file that owns it.

### The ordering instrument gave a FALSE GREEN, and the repair round caught it

After the peer repairs, the check printed `rows=13 … PASS`. **It should have printed 15.** The block
had grown by two lines and the instrument located it by a **hard-coded line window** (`17..47`), so it
silently read a truncated table and passed on it. *An instrument built this same session, to catch
exactly this class of defect, committed exactly this class of defect.*

Rebuilt to locate the block by **content markers** (the heading, and the blockquote after the second
table) and to **assert the expected row count**, so a relocation fails loud instead of passing quiet.
Negative-controlled with exit codes read directly — not through a pipe, which had masked them once:

| Control | Expected | Got |
| --- | --- | --- |
| Baseline | `exit 0` PASS | `exit 0` PASS |
| Move `PrismaService` above `DI` | `exit 1` FAIL | `exit 1`, flagged that pair |
| Delete one row (the truncation mode) | `exit 2` FAIL | `exit 2`, "expected 15 rows, found 14" |
| Restore | `exit 0` PASS | `exit 0`, file `sha256`-identical |

*Two lessons, both already on this list and both re-earned: **an instrument that locates its subject
by line number will eventually read the wrong subject**, and **a pipe hides the exit code** — the
`RESULT:` text was right while `$?` read 0 for every one of them.*

### Peer round 2 — the corrections over-corrected, and two source comments still lied

A fix round is a new tree, so `21c20f1..87839d6` went back to the peer. **5 MAJOR + 2 MINOR**, and
the shape of them is the finding: *four of the five MAJORs were defects **created by the repair**,
not survivors of it.*

| # | Finding | Outcome |
| :-: | --- | --- |
| 1 | "infrastructure services (config, mail, **image processing**) own no domain rules" — `MediaProcessingService` enforces allowed types, MIME/extension agreement and a 40 MP ceiling and rejects with `422`; `src/modules/README.md` already calls that a rule | **accepted** — the row now says neither the name nor the directory predicts the content, and gives all three shapes |
| 2 | "**most** unit tests bypass the container" — 22 of 61 is **36 %** | **accepted** — replaced with a hedge that points at the file carrying the count |
| 3 | §10 named three conditional cases as if they were the set — `COOKIE_DOMAIN`, the `S3_*` group, `S3_REGION`, `PUBLIC_WEB_URL` and the cross-field production checks are all unlisted shapes | **accepted** — labelled examples, and the same fix applied to `src/config/README` |
| 4 | Two contradictions in that same block: `PUBLIC_WEB_URL` grammatically lumped into the SMTP gating, and `S3_REGION` listed among the fields *required* under the `s3` driver while carrying `@IsOptional()` | **accepted**, both |
| 5 | "ten modules … call `assertEnabled` before **any** translated read/write" — the count is right, the behaviour clause is not: admin reads return the full translation map, pass no locale, and do not call it | **accepted** |
| 6 | *(MINOR)* `media.module.ts` and `media-descriptor.resolver.ts` still call `seo` "a future page-SEO read" | **accepted** |
| 7 | *(MINOR)* `env.validation.ts` and `.env.example` both say every SMTP field becomes required when enabled | **accepted** |

**Findings 6 and 7 are the campaign's founding defect, committed by the campaign.** The README was
corrected to name `seo` a current consumer *in the same round* in which two source comments kept
calling it future. **A document and the comment beside it were edited in the same hour and made to
disagree.** The rule that would have caught it is already written down — *retiring a claim in one
file is not evidence about the file beside it* — and it still did not fire, because the sweep
searched the **documents** and the claim also lived in `.ts`.

**Pushed back on, with an enumeration.** The peer read the direct-construction ∩ mocked-`Prisma`
intersection as **15**, having counted `permissions.guard.spec.ts` — which constructs a *guard* and
no service, so it is not among the 22. The sixteen files were listed by name and re-counted. **16
stands.** *Stronger evidence wins in both directions; a peer verdict is evidence, not authority.*

**Comment-only, proved and negative-controlled.** Three `.ts` files changed. Both sides compiled with
`tsc --removeComments`: emitted `JS` byte-identical across all three. **And the PR's headline figure
was re-measured end to end rather than inherited:** `9af1aac..HEAD` touches **68** `.ts` files, and
the emitted `JS` differs in **exactly six string literals — four `describe()` labels and two
diagnostic messages — and zero executable statements**, which is what the PR body has claimed since
before this session. *A published count nobody has re-measured is the same defect as a `SHA`-pinned
status line; it is now measured at the head that carries it.* The proof was then negative
controlled — appending one executable statement makes the emitted `JS` differ *and names the
statement in the diff*; restoring returns a byte-identical file and an IDENTICAL verdict.

*Two instrument failures worth keeping, both self-inflicted, both caught only because a count was
asserted:* the first proof run compared **two empty directories** — `zsh` does not word-split an
unquoted multi-line `$FILES`, so `tsc` received one absurd path, emitted nothing, and `diff` of two
empty trees printed a confident IDENTICAL. The fix was to assert the emitted-file count equals the
changed-file count. And the first negative control **never mutated anything**: its target string
occurred twice, the guard assertion fired, and the run that followed reported IDENTICAL — a
*vacuous* pass being read as a passing control. **A negative control that does not first prove the
mutation landed is not a control.**

### Peer round 3 — it converged, and the last MINOR was the same defect one layer up

`87839d6..d3455d5` went back to the peer. **No MAJOR. One MINOR.**

| Round | Findings |
| --- | ---: |
| 1 — on the run-4 repair | 7 MAJOR + 1 MINOR |
| 2 — on the fixes for those | 5 MAJOR + 2 MINOR |
| 3 — on the fixes for those | **0 MAJOR + 1 MINOR** |

*Three rounds is where this converged, and the second round was the expensive one because four of
its five MAJORs were defects the **repair** introduced. Fixing is not a safe operation on this
corpus; it is another edit, and it needs the same review the original did.*

**The last MINOR is worth more than its severity.** `src/config/README.md` said the validation shapes
were listed "**بمثال لكلٍّ، لا حصرًا**" — an example each, *not exhaustively* — and in the same
sentence counted them: "**خمسة**". **A count is the exhaustive claim.** And there is a sixth shape
it would have excluded: `PUBLIC_WEB_URL` is defaulted outside production and required in it, done in
`validate()` rather than by a decorator. *The hedge and the number contradicted each other, and the
number would have won with any reader.* The count is gone; the hedge stays.

**What round 3 checked and found clean**, each with per-file evidence: `users.service.ts` is exactly
27 lines and mechanical; `AppConfigService` and `MailService` carry no domain rules while
`MediaProcessingService` rejects with `422`; "many" is consistent with 22 of 61; all eight named
environment cases classified correctly; `PUBLIC_WEB_URL` independent of SMTP and `S3_REGION`
completed with `'auto'`; **every `assertEnabled` call site across all ten locale-importing modules
enumerated**, with no admin read calling it and no locale-addressed path missing it; the five
resolver consumers all real; **no remaining "future page-SEO" or unqualified "every field is
required" anywhere in the repository**; and the three `.ts` hunks inspected at zero context —
comments only, no import, declaration, decorator or statement touched.

### Peer round 4 — narrow, and **CLEAN**

`d3455d5..2fd62e2` is one sentence. Reviewed anyway, because the rule is that a fix round is a new
tree and the campaign's own record shows why: the previous "small" fix round produced four MAJORs.

**CLEAN on all four questions asked:** the sentence no longer implies completeness; the shapes and
their examples still match `env.validation.ts`; removing the count broke neither the grammar nor any
sentence near it or elsewhere; and no new absolute was introduced.

**Peer lane closed for run 4: 7 MAJOR + 1 MINOR → 5 MAJOR + 2 MINOR → 0 MAJOR + 1 MINOR → CLEAN.**

### The run-5 bundle — built from the reviewed head, verified three ways

Built by script (`scratchpad/build-bundle.sh`) rather than by hand, and the corpus is derived from
the repository, never from a kept list: `git ls-tree -r <sha> | grep README.md|PROJECT_GUIDE.md`.

| Check | Result |
| --- | --- |
| Corpus at the head | **27 files**, and the path list is *generated*, so a new README cannot be silently missed |
| Positive verify (`git rev-parse <sha>:<path>` vs `git hash-object`) | 27/27 match |
| **Negative control** — corrupt one file | **exactly 1 mismatch**, naming that file |
| Restore | 27/27 match again |
| `zip` round-trip — re-extract and re-hash | 27/27 match |

Bundle files are `chmod 444`. **Runs 1–4 bundles and prompts are renamed `-SUPERSEDED`** so the wrong
archive cannot be uploaded by accident — the failure mode being that a reader answers questions about
a tree that no longer exists and every finding is unreproducible.

**The prompt carries no pass criteria, no expected answers, no repair labels, and no prior-run
history**, and that was checked by grep rather than by intention. It asks the reader to walk the
vocabulary block row by row, then covers each confirmed run-4 repair, four unchanged controls carried
from earlier gates, and keeps the unscored open-ended pass — which has out-produced the scored
questions in all four runs so far.

*Neither this session's agent nor Codex may read the bundle: both have seen the corpus and the
answers, and a reader who has seen either is not cold.*

### The prompt was re-validated against the shipped corpus — and it had gone stale in the usual way

§11's own rule — *"re-validate every gate question against the corpus immediately before running the
gate, not when writing it"* — was written after a peer found question 4 testing a trap the campaign
had already closed. **It nearly failed the same way here.** The run-5 prompt was drafted *before* the
first peer finding was read; the corpus then changed through four peer rounds across ten files. A
prompt written at 15:18 against a bundle cut at 16:17 is a prompt for a tree that never shipped.

Re-validated question by question against the bundle files as they now stand. The fourteen drafted
questions survive — each still points at a live discrimination — but the pass found **four confirmed
repairs with no question at all**, every one of them in prose the peer rounds had rewritten:

| Added | Tests |
| --- | --- |
| Q15 — does a `*.service.ts` always own its area's business rules? | the `service` row's three shapes — the single most-rewritten sentence of the round, and the site of the repair's own false quantifier |
| Q16 — does the injection container perform the substitution in a unit test? | the `DI` row's corrected seam claim, and whether the reader can find the measured counts |
| Q17 — with mail on, is any setting still not required? | the `SMTP_SECURE` exception |
| Q18 — who consumes the media resolver, and who validates a locale *on every read*? | the five-consumer list **and** the admin-read nuance, in one question that a too-broad answer fails |

Each was checked to be answerable **from the bundle**, not merely from the repository. And the whole
prompt was re-checked by `grep` — not by intention — for pass criteria, expected answers, repair
labels, severities, prior-run history, and any mention of the peer.

*The rule that produced this section is worth restating, because it has now fired twice: **a test
written against a snapshot of the thing it tests stops testing it the moment that thing is fixed** —
and a repair round is exactly when the thing gets fixed.*

### A fifth reviewer returned late, on a superseded tree — two corroborations, one false confirmation, one miss

The in-process reviewer dispatched at the *start* of run 4 returned after the peer lane had already
closed. It reviewed `b6f17b01` — nine commits behind — so its verdict is **commit-scoped to a tree
that no longer exists** and cannot discharge anything. It is recorded because three of its four
outcomes are still informative.

**Corroborated, independently and by a different rule.** It reached `١٦` for the mocked-`Prisma` row
by grepping `mockDeep<PrismaService>` (18 files use `mockDeep`; two of them —
`preview.controller.spec.ts`, `preview.admin.controller.spec.ts` — mock `ArticlesService`/
`ProjectsService` and never touch `Prisma`). The direct round reached the same 16 from
*direct-construction ∩ `PrismaService`*. **Two unrelated rules, one number — which is worth more than
either count alone.** It also independently flagged the `DI` row's seam wording as risking the
DI-container misconception. Both were already fixed.

**A false confirmation, from the exact blind spot this ledger already records.** It closed its
argument with "corrected sum `29+3+16+31+3+3+5 = 90` — **exact match** to the real file count." The
real total is **95**: it counted `*.spec.ts` under `src/` and `test/` only and missed the four specs
under `prisma/` and the one under `scripts/` — *the same two `jest` roots the first census here
missed.* Two independent readers made the same omission, and in this case it manufactured an
**agreement between a wrong sum and a wrong total**. A residual that lands on a round number is not
evidence that the parts are right.

**And a miss, in the direction the campaign already named.** Its section E swept every module's
dependency map and reported none wrong — having checked `seo/README` and found it correctly lists
`MediaDescriptorResolver`. On the very tree it was reading, `media/README.md:24` listed the
resolver's consumers as `projects`/`articles`/`testimonials`/`settings` with **no `seo`**, and
`locales/README.md:20` enumerated seven importers where ten import `LocalesModule`. **It checked
A→B and concluded about B→A** — the same inversion the direct round caught, found here by a reviewer
that had been told the rule. *That is the strongest evidence in this ledger that the rule needs an
instrument rather than a reminder.*

## 11g. Run 5 — the block passed, and the layer above it failed the same way

Fifth cold reader, new, uncoached, documentation-only, on a bundle verified blob-identical to
`deedf75`.

| Question | Result |
| --- | --- |
| Q1 — read the vocabulary block top-to-bottom; did any row need a later row? | **PASS**, HIGH — walked all fifteen rows and reported none |
| Q2 — what did it equip you for? | **PASS**, HIGH |
| Q3 — any term needed before it was introduced? | **NOT CLEAN** — `data-mapper` / `repository`, MEDIUM |

**The repair worked and the defect moved up a level.** Four runs were spent ordering the vocabulary
block; run 5 confirms it now reads linearly. Then `§4:117` calls `Prisma` *"the `data-mapper` (no
`repository` layer)"* and `§5:148` builds an architectural decision on that contrast — while **both
terms are defined only in `src/prisma/README.md:7`**, which the guide's own reading order places
*after* the guide. *Same class, one layer up: a term used materially in the document a newcomer is
told to finish first, defined only in a document they are told to read second.* Both are now defined
in one bounded line at first use; the full argument stays where it was.

### The six open-ended findings, each verified before it was touched

- **`.service.ts` → `Prisma` was overclaimed twice, and the softer version was wrong too.** `§6.3`
  said *"every service injects `PrismaService`"*; `src/prisma/README.md:21` softened it to *"almost
  every"*. **Measured:** of **25** `*.service.ts` files (excluding `PrismaService` itself) **18**
  inject it and **7** never touch the database. `18/25` is 72 % — *"almost every" is not supported
  either, which is why the census had to come before the wording.* And the count was never the
  lesson: the lesson is that **no repository layer sits between a service and `Prisma`**, and that
  the suffix predicts nothing about database access — which the vocabulary block already says.
- **The seam was described as `DI`.** `src/prisma/README.md:104` said the test seam is
  `PrismaService` *"via DI"*, which reads as the container performing the substitution. It does not,
  in most tests: they construct with `new` and pass the mock by hand, and three files boot a real
  container. The **constructor** is the seam.
- **The reading path claimed exactly three modules lie outside it.** `users` is a fourth: no numbered
  step, mentioned only to say you needn't read it before `auth` — so a newcomer is told it exists and
  never told when to read it, while `users/README.md` sits there. Four, named, with its reason.
- **`projects/README:36`** said `ogImageId` *"remains a raw reference in this contract"*, which reads
  as *and nothing else*. `openapi.json` carries **both** `ogImageId` and `ogImage` on
  `PublicProjectDetailEntity` — the general rule applies with no exception here. *An incomplete true
  sentence, which is the harder kind to catch than a false one.*
- **`media/README`** listed résumé-`PDF` upload as the module's work at `:7` and then, under accepted
  limitations at `:109`, said `PDF` upload is *"outside this module's scope"*. **The subject was
  wrong** — it is outside the *e2e tests*, not the module. **Module scope and test scope must never
  be interchangeable words.**
- **`test/README:16`** read as an inventory while naming 11 of 34 `e2e` files. Labelled as examples.

### Classified, not repaired

The reader's `data-mapper`/`repository` item and its Part-3 restatement are **one defect**, counted
once. Nothing in run 5 was an experiment artifact: the bundle carried every file each finding needed.

### The sweep found a quantifier the reader never saw — and an instrument lied twice doing it

Sweeping the quantifier family rather than the named sites: **step 4 of the reading path promised you
would meet `locales` "in every `service` after it."** Seven of the twelve modules that follow inject
`LocalesService`; `auth`, `access-control`, `mail`, `contact` and `preview` carry no language at all
— and `contact/README` says so in as many words. Narrowed to the measured set.

*Getting that measurement took two attempts.* The first per-module check globbed
`src/modules/$m/*/*.service.ts`, which `zsh` fails loudly on when a module has no subdirectory — and
the failure made **every one of the twelve** read `NO`, including the seven that are `YES`. A uniform
negative across an entire sweep is not a result; it is a broken instrument. Rebuilt on `find`, and
**positive-controlled against the `locales` module itself**, which must be a hit.

### Self-review caught the count's own evidence

The `18/25` repair listed the seven services that do not touch the database — and **listed six**.
`auth.service.ts` was missing: it injects neither `Prisma` nor anything database-bound, because it
delegates account lookup to `users` and token work to `refresh-token`. **A count is only as good as
the enumeration offered as its evidence, and mine did not add up to its own number.** Caught before
the peer round, which is the first time on this campaign that has happened.

*One claim was checked and left alone:* `§15`'s *"`users` — 24 lines of code"* is **correct** under
the guide's own measure (non-blank, non-comment, module-wide: `users.service.ts` 17 +
`users.module.ts` 7 = 24). The `27` that had been sitting in the vocabulary row was `wc -l` of one
file — two true numbers under two measures, in one document, about one module. The row now
*describes* (`two lookups, by id and by email` — verified: `findByEmail`, `findById`, and nothing
else) instead of counting.

### The peer rounds on the run-5 repairs — 3 MAJOR, then 1, and the count was never the problem

| Round | Scope | Findings |
| --- | --- | ---: |
| 1 | `deedf75..d8f56c8` | **3 MAJOR**, 0 MINOR |
| 2 | `d8f56c8..0b62767` | **1 MAJOR**, 0 MINOR |
| 3 | `0b62767..a602f71` | **CLEAN** |

**Round 1 confirmed the number and rejected the sentence built on it.** `18` of `25` was reproducible
and correct; *"the seven that never touch the database"* was not the right partition. `auth.service.ts`
touches persisted data constantly — it just does so through `UsersService` and `RefreshTokenService`,
**both of which inject `PrismaService`**. The honest split is **direct injection**, and the mistake
produced the better lesson: *the `.service.ts` suffix promises no database access, and the absence of
an injection does not mean the absence of a database.* The role list was wrong in the other direction
too — *"the mail service and its messages"* would sweep in `contact-reply.service.ts`, which **does**
inject `Prisma`; the non-injecting one is `contact-mail.service.ts`. Both are now named as files.

**"Most" shipped again, in the same claim family, one round after being retracted.** Round 2 of the
*run-4* lane had already struck *"أغلب اختبارات الوحدة"* out of the `DI` vocabulary row. It reappeared
here in `src/prisma/README.md` — `22` of `61` is **36 %**. It now carries the measured numbers.
*Twice in one campaign, the same word, the same claim, in two different files. A retraction in one
file is not a fix for the sentence; the word has to be swept.*

**And an "accepted limitation" that was not accurate.** `media/README` recorded *"no `e2e` for `PDF`
upload"* as a known gap. `page-seo.e2e-spec.ts:376` uploads a real `resume.pdf` through
`POST /admin/media`, expects `201`, and asserts `kind === 'PDF'` — incidentally, as the control for a
different `422` assertion, but the path runs. *A limitation is a claim about the test suite and
decays exactly like any other.* Restated as partial coverage, with the file named. **Its two
neighbours were then checked rather than assumed** and both hold: `ci.yml` configures no `S3_*`, and
the `40 MP` ceiling (`MAX_INPUT_PIXELS`) is exercised in `media-processing.service.spec.ts`.

**Round 2's single MAJOR was a sentence that refuted itself one clause later.** The rewrite opened
with *"the service that **needs** the database injects `PrismaService` directly"* — a universal — and
the same paragraph then said `auth.service.ts` needs it and injects nothing. Fixed by one word:
**reaches it *by itself***. *The defect survived because the paragraph was read as an argument rather
than as a sequence of claims; each sentence has to be true on its own.*

### A coarse instrument flagged four services, and reading them cleared all four

Verifying that the six named services do no database work, a grep for
`prisma|Prisma|\.findMany|\.findUnique|\.create\(|\.update\(|\.delete\(` returned a hit in
four of them. Every one was a false positive, and only reading resolved them:

| File | The "hit" | What it actually is |
| --- | --- | --- |
| `mail.service.ts` | `this.sleepers.delete(...)` | a `Set`, not a table |
| `contact-mail.service.ts` | `import { ContactMessage } from '…/prisma/client'` | a **type-only** import |
| `media-processing.service.ts` | the word `Prisma` | a comment saying it is independent of Prisma |
| `preview-token.service.ts` | `.update(...)` | an `HMAC`, not a row |

*A pattern broad enough to be safe is broad enough to be useless on its own.* The peer independently
audited the same six by reading and reached the same verdict.

**Peer lane closed for run 5: 3 MAJOR → 1 MAJOR → CLEAN → CLEAN.**

### The prerequisite defect was a CLASS, and the first sweep stopped one line short

`data-mapper`/`repository` was found by the reader. Sweeping *the class* rather than the pair found
two more terms used bare in `PROJECT_GUIDE.md` whose explanations live only in documents the reading
order places later: **`idempotent`** (`§7`, article promotion — its only parenthetical is the
decision id `D07-3`, a citation and not a gloss; the explanations sit in `prisma/README.md` and
`articles/README.md`) and **`upsert`** (`§15`). Both now carry one clause at first use, and both
glosses were verified against source: the promotion is a single `updateMany` scoped to rows still
`SCHEDULED`, so a re-run matches nothing; `settings` and `seo` both call `prisma.*.upsert` per key.

*The instrument that found them was wrong in both directions, and only reading settled it.* Scoring
"is there a gloss near first use" by looking for a parenthetical marked `idempotent` **glossed**
(because `(D07-3)` is a parenthetical) and marked `seam` **unglossed** (because its gloss is the
Arabic *مقعد الاختبار* that **precedes** the English). Two false readings out of seven terms, in
opposite directions — a heuristic good enough to shortlist and never good enough to conclude.

**Round 4 closed the class, exhaustively.** The peer re-swept for any remaining term naming a
pattern, algorithm or protocol concept that a frontend engineer would need before it is explained,
and listed what it checked: `data-mapper`/`repository`, transaction/atomic commit, lazy connection,
cron/distributed lock, idempotency, singleton, upsert, `FTS`/`tsvector`/`GIN`, `JWT`/`HMAC`/pepper/
rotation, `RBAC`/default-deny, descriptors/`BlurHash`, concurrency, state machine, post-commit
sending, constant-time comparison. **No remaining qualifying term.** Both glosses accurate, both at
first use, nothing nearby falsified, no new absolute.

### The run-6 bundle and prompt — written after the corpus was final, not before

Bundle cut from the reviewed head by `scratchpad/build-bundle.sh`, corpus derived from
`git ls-tree` rather than a kept list: **27 files**; positive verify 27/27; **negative control**
corrupted one file and the checker flagged **exactly one**; restore 27/27; `zip` round-trip 27/27.
Files `chmod 444`; run-5 artifacts renamed `-SUPERSEDED`.

**The prompt was written after the last repair landed, which is the whole point.** Run 5's prompt was
drafted before its first peer finding and needed a re-validation pass that found four untested
repairs; this one was authored against the shipped tree, and each of its seventeen questions was then
checked to be answerable **from the bundle** by locating the sentence that settles it. It covers the
`data-mapper`/`repository` prerequisite, all six confirmed run-5 repairs plus the swept quantifier,
**four** unchanged controls carried from earlier gates (`422` on an unknown field, the `try/catch`
that does not exist, the two size limits, and which module `README` comes first), and keeps the
unscored open-ended pass — which has out-produced the scored questions in **all five runs**.
*Counted deliberately: the environment question and the CI-lane question read like controls and are
not — both target prose rewritten in run 4 **and** again in run 5, so they are repair tests. An
instrument that miscounts its own controls overstates how much of it is holding still.*

Checked by `grep`, not by intention: no pass criteria, no expected answers, no repair labels, no
severities, no prior-run history, no mention of the peer. Round 3 re-checked the amended sentence,
all 25 service files, every direct injector's Prisma usage, all seven non-injectors, `auth`'s
delegation path, and the parallel statement in `src/prisma/README.md` — no contradictory universal
remains and no new count was introduced.

## 11h. Run 6 — the regression CLOSED, and the unscored pass found a guarantee that was never made

Sixth cold reader, on a bundle verified blob-identical to `7a025be`.

**The prerequisite-order regression is CLOSED.** The reader read the guide linearly and reported no
architectural term needing a substantially later explanation, walked all fifteen vocabulary rows with
no forward dependency, and answered every run-5 repair question and every carried control coherently.
*Six runs to close a defect class that started as one misplaced table.*

**And the unscored pass produced the campaign's sharpest finding yet.** Third run in a row, and the
fifth of six overall, in which the section carrying no score out-produced the scored questions.

### F1 — the upload README promised a guarantee the code does not make

`media/README.md:84` said, **inside one clause**: *"cleanup never throws; and if objects remain,
`media.compensation_incomplete` is logged — **so there is neither an orphan row nor an orphan
object**."* If objects remain, an orphan object is precisely what exists, and
`media.service.ts:300-308` logs that case by name. The document also argued three sections earlier
that an orphan object is the *safer* failure. **It contradicted itself twice over.**

Repairing it took **three passes, and each pass produced a new false statement**:

| Pass | What I wrote | Why it was wrong |
| :-: | --- | --- |
| 1 | "no orphan row **absolutely** — the row is never committed on failure" | an absolute, unearned |
| 2 (self-review) | "the row is written last, so **every** failure that triggers compensation precedes it" | `logOverBudgetRenditions` and `toAdminEntity` run **after** `create` resolves, inside the same `try` — I checked the second and missed the first |
| 3 (peer round 2) | "…and that is **the only path** that produces an orphan row" | a rejected `create` **does not prove** `PostgreSQL` did not commit; a connection lost after commit looks identical, and there is no idempotency token or post-error reconciliation |

**Three absolutes in three consecutive attempts to remove an absolute.** The final text states what
the ordering earns — object-write failure precedes the row, so the window is *narrowed, not closed* —
and names the two limits instead of asserting past them.

### The false claim was inherited from a source comment, not invented by the docs

`media.service.ts:294` asserted *"Cleanup never throws: the caller must still rethrow / return."*
`cleanup()` awaits `storage.deleteMany` **bare**; the local adapter catches per key and cannot reject,
but the `R2` adapter awaits `client.send`, which can reject outright — and that rejection escapes
`cleanup`, pre-empts `compensate()`'s `throw error`, and **replaces the original upload failure while
logging neither the event nor the keys.**

**The correct statement already existed 175 lines away, for the sibling path.** `cleanupAfterDelete`
wraps the same call in `try` and its comment says exactly why: *"Only the LOCAL adapter is internally
total (it catches per key); the S3/R2 adapter can reject outright…"* **Two comments about the same
adapter, in one file, disagreeing** — and the README had faithfully copied the wrong one. *This is
the campaign's founding defect in its purest form: the document was not the liar; it was the honest
witness of a lying comment.* The upload comment now says what the code does.

### F2 — a category word where the test is not about the category

`media/README.md`'s e2e summary read *"non-image `422`"*, while the same file says `PDF` is the only
supported non-image type — so it read as though the supported type were rejected. The actual test is
`rejects a non-image (spoofed extension)` with a fixture of plain text named `evil.jpg`, asserting a
**row** count. Narrowed to the real input class, and *"(no orphan)"* tightened to *"(no orphan
**row**)"* to match both the test's own name and the invariant above.

### F3 — "not in preview" was true of the imports array and false about behaviour

The guide said you would not meet `locales` *"in `preview`"*. `preview.module.ts:13` imports only
`ArticlesModule`/`ProjectsModule` and injects no `LocalesService` — **but both public preview reads
delegate to `getPreviewById`, and `articles.service.ts:204` and `projects.service.ts:144` each call
`assertEnabled` first.** A newcomer would conclude preview requests skip locale validation. Both
sides now state the distinction, and the general rule with it: **a delegated dependency does not
appear in an `imports` list, so absence from the list is not absence of the behaviour.** Admin
token-mint routes take no locale and are correctly outside it.

### Classified: experiment artifacts, not defects

`openapi.json`, workflow files and source are **deliberately** absent from a documentation-only
bundle — the reader's inability to re-audit contract claims is the experiment's design, not a corpus
defect, and copying contract content into prose is exactly what §6.5 exists to avoid. The root
`prisma/README.md`'s doc-09 prerequisite resolves correctly under the primary-checkout layout and the
ownership boundary is stated in the sentence itself (§11f settled this once already).

### The peer lane on the run-6 repairs — six rounds, and the family only closed when the sweep stopped following the diff

| Round | Scope | Findings |
| :-: | --- | ---: |
| 1 | `7a025be..64f36c5` | 2 MAJOR |
| 2 | `64f36c5..f7dfe37` | 2 MAJOR |
| 3 | `f7dfe37..49c611b` | 2 MAJOR + 2 MINOR |
| 4 | **whole family, not the diff** | 2 MAJOR + 8 MINOR |
| 5 | `689ff08..a3e993f` | **0 MAJOR** + 9 MINOR |
| 6 | `a3e993f..a738cb9` | 0 MAJOR + 7 MINOR |
| 7 | `a738cb9..716a7c5` | 0 MAJOR + 1 MINOR |
| 8 | `716a7c5..e6d6b01` | **CLEAN** |

**Round 3 is the one that changed the method.** It found a stale comment **twenty lines above** the
one being repaired, contradicting it: `compensate()`'s own header still read *"any other failure
deletes every object this request uploaded and rethrows. No DB row exists at this point … so there is
never a partial row"* — three false clauses, sitting directly over the `cleanup()` comment that had
just been corrected. **The rule was already written down** — *retiring a claim in one file is not
evidence about the file beside it* — and it failed against a sibling **in the same function**.

So round 4 was dispatched **against the family, not the diff**: read every reliability, ordering,
atomicity, orphan and cleanup claim in the media source, the constants, both storage adapters and the
README. It returned **ten**, and they were all one defect in different words: **a probabilistic or
best-effort mechanism written up as a guarantee.**

| The claim | What the code does |
| --- | --- |
| "no-orphan compensation … compensated on any failure" | the thing `compensate()` now says it is not |
| "the raw upload is **never** persisted" | true of images; `processPdf` returns `input.buffer` and it is stored |
| "cleanup can **never** touch another asset's objects" · keys "**never** overwritten" | rests on `randomUUID()` alone — neither adapter uses create-only semantics |
| "a duplicate race **is resolved** to the winner" | unless cleanup rejects, the reread rejects or returns null, or mapping throws |
| "a lost response **rejects** locally" | *can* reject — the SDK retries three times by default |
| "the blocking transaction may have **rolled back**" | it cannot both cause the `P2003` and then roll back |
| an orphan is "bytes **no reader can observe**" | object URLs are public and cached a year; an issued URL still resolves |
| "`failed` alone, **never** the full key list" | on a total adapter rejection it **is** every key |
| "the widest WebP rendition — **never** the master" | the admin entity falls back to the master |
| "a further upload is rejected with `429`" | a dedup hit returns **before** the cap and consumes no slot |

**Round 5 then found nine more, and two of them were sentences that contradicted their own next
clause** — *"bytes no API response points at any more"* immediately followed by *"a URL already handed
out can still resolve"*, and an orphan called "bytes nobody sees" three sections after that exact
phrase had been corrected elsewhere. Also: the primary-URL comment still **ended with the sentence it
was correcting** (*"Not the large sanitized master"*), left dangling by my own edit.

*Five lessons, all re-earned:*

1. **A sweep that follows the diff finds what the diff touched.** Four rounds of diff-scoped review
   missed ten family members that one family-scoped round found.
2. **A repair is an edit and inherits the full review burden.** Every round on this family found
   defects created by the previous round's repair.
3. **Read the sentence you leave behind, not only the one you change** — twice a correction was
   grafted onto a clause that asserted the opposite.
4. **A guarantee is a claim about the worst case, not the common one.** Every entry in that table
   read as a guarantee and described a happy path.
5. **The document is often the honest witness of a lying comment.** The README's *"no orphan row nor
   orphan object"* was copied faithfully from `media.service.ts`, whose `cleanup()` comment asserted
   *"Cleanup never throws"* while the sibling `cleanupAfterDelete` — 175 lines away, same file, same
   adapter — said the opposite and wrapped it in `try`.
6. **An enumeration offered as evidence is a claim of completeness.** Round 6's own repair listed four
   nullable FKs and omitted three; round 7 caught it. Restated as *the single exception*
   (`ProjectGalleryItem.mediaAssetId`), which is exhaustive by construction — **a list invites the
   miss that a stated exception cannot make.** The same defect appeared earlier in the round when a
   seven-item count was backed by a six-item enumeration.

**Peer lane closed for run 6: 2 → 2 → 4 → 10 → 9 → 7 → 1 → CLEAN, over eight rounds.** Round 8
re-enumerated all eight blocking relations against `schema.prisma` and confirmed the inverse claim is
exhaustively true.

### The run-7 bundle and prompt — NARROW by design

The owner's instruction after run 6 was explicit: the formal questions passed, so the next reader
does **not** need another broad regression. The prompt is **eleven** questions, not seventeen, and it
is built to attack the one family that took eight peer rounds:

| Covers | Questions |
| --- | --- |
| The compensation invariant — what is guaranteed, what is not, what is logged | 1, 2 |
| Delete: is the object certainly gone; is a URL fetched an hour ago | 3 |
| Supported vs unsupported non-image, and stored-as-is vs transformed | 4 |
| Direct vs delegated locale validation, and how a reader can tell | 5, 6 |
| Unchanged controls carried from earlier gates | 7, 8, 9, 10, 11 |
| Unscored open assessment, pointed at over-certainty | Part 2 |

*Questions 1–3 are deliberately adversarial about certainty:* they ask what is **not** guaranteed and
treat "orphan object" and "orphan row" as two separate questions — because the defect this round
removed was exactly the conflation of the two. Part 2 asks specifically for **"any sentence that
promises more certainty than the rest of its own section does"**, which is the shape of every one of
the ten findings round 4 produced.

Bundle: **27 files**, corpus from `git ls-tree`, positive 27/27, negative control flagged exactly one
on corruption, restore 27/27, `zip` round-trip 27/27, and re-verified against the head that carries
it. Run-6 artifacts renamed `-SUPERSEDED`. Every question was checked answerable **from the bundle**.

*One check reported a false negative doing that:* the delete-sentence probe failed because the grep
pattern mis-escaped the `**bold**` markers around the very words it was looking for. The text was
there. **A failing probe is a claim about the corpus and needs the same scepticism as a passing one** —
this is the fourth instrument in this campaign to be wrong in the reassuring direction and the second
in the alarming one. Round 8
re-enumerated all eight blocking relations against `schema.prisma` and confirmed the inverse claim is
exhaustively true. *Eight rounds on one claim family is the most this campaign has spent anywhere —
and rounds 4 onward only became productive when the sweep stopped following the diff.*

### ⚠ OWNER-FACING — the shipped spec asserts a property the implementation does not provide

`.specify/specs/003-media-pipeline/spec.md:22` and `plan.md:29` record, as **acceptance conditions of
a shipped feature**, *"compensation on failure … no orphaned rows or objects"* and *"objects-before-row
+ compensation on failure; no orphans."* The README now documents two limits under which that does
not hold. **The `.specify` records were NOT edited:** convention 4.E makes them historical evidence,
and amending an accepted feature's acceptance criteria is a governance act, not documentation
cleanup. Queued for the owner alongside the two code-behaviour limits themselves, which this
documentation-only branch records and does not repair.

**Two further items are recorded rather than repaired, because both would change emitted
JavaScript** and this branch changes no behaviour:

- `media.service.ts`'s delete-cleanup log message says the objects **"remain"**, where *"potentially
  remain"* is what the code knows — on a total adapter rejection nothing is known to have been
  deleted. A log string is observable output, so it is left to the owner.
- `media.service.spec.ts`'s `describe` label reads **"compensation (no orphans)"**, while the block's
  own partial-cleanup test records a remaining object. A test label is a string literal in the
  emitted `JS`.

## 11i. Run 7 — the questions passed and the open pass found an ownership family

The narrow gate did its job: every taught concept came back correct — compensation as best-effort
rather than a guarantee, orphan object separated from orphan row, `204` separated from storage
cleanup and from a cached URL, transformed image bytes vs raw `PDF` bytes, preview locale
validation as delegated rather than owned, the `1 MiB` / `10 MiB` / `40 MP` split, unknown body
field → `422`, duplicate slug `P2002` through `AllExceptionsFilter`, reading order, env authority.
**Nothing in the scored set failed.** The whole yield came from the unscored pass, which is now
the fourth consecutive run where that is true.

### The findings, classified against source before any edit

| # | Reader's report | Verdict | What the source said |
| --- | --- | --- | --- |
| F1 | the guide calls the public surface read-only while module docs show public writes | **CONFIRMED, and wider than reported** | 22 `@Public()` sites, **4 non-GET** (`auth` login/refresh/logout, `contact`). A second overclaim in the same sentence: `health`, `health/ready`, `locales` and `redirects/resolve` are public reads returning no locale-resolved content |
| F2 | "type, size or structure → `422`" may conflate bytes with pixels | **CONFIRMED — self-contradiction inside one file** | `src/modules/README.md:198` said size → `422`; line 177 of the same file maps byte size over `10 MiB` to `413`. The `422` case is `MAX_INPUT_PIXELS` |
| F3 | `assertEnabled` credited with the platform-wide no-fallback rule | **CONFIRMED — four concepts, three owners** | the function is `findUnique` + `isEnabled`. Selection is per-module and itself split (nested relations filter in-query, the entity's own translation is picked in memory); the missing-translation outcome differs by module — `404` in articles/projects, `null` fields in `settings` and `seo` |
| F4 | `openapi.json` not inspectable | **EXPERIMENT ARTEFACT — no change** | the file is tracked (335 KB) and named as the decider in six places. A bundle limitation, not a repository defect. **Not** duplicated into READMEs |
| F5 | per-width byte budgets named without values | **NARROW POINTER GAP** | values are governed by doc 20 §4 / `D20-6` and mirrored in `RENDITION_BUDGETS`; **documentation does not own them**. The real gap was that the line named `RENDITION_WIDTHS` but not the budget symbol, against the file's own convention. Pointer added; the six numbers deliberately not copied |
| F6 | "all domain rules in services" vs a DTO-enforced invariant | **CONFIRMED** | `@IsIn(GRANTABLE_PERMISSIONS)` is the sole enforcement — the service writes the array through unchecked, the column is free text, and `prisma/seed.ts` writes it directly |

### What the round actually cost, and where the defects came from

Three peer rounds, and **the repairs were the defect source every time**:

| Round | Result | Where the findings landed |
| --- | --- | --- |
| 1 | **20 MAJOR + 1 MINOR** | 12 against `.specify/` (out of scope, §8); 1 already fixed; **5 in-corpus**, every one a sibling of a family I had "fixed at the named site" |
| 2 | **7 MAJOR** | **5 against text round 1's repairs wrote** |
| 3 | see the verdict recorded with the final head | — |

**The lesson is about the shape of my sweeps, not about care.** F1 was swept by searching the
Arabic surface terms (`سطح عام`, `قراءة عامّة`) and never by grepping `@Public()` in prose — which is
exactly why `src/common/README.md:41` ("every controller/DTO uses `@Public()`") survived until the
peer found it. Same shape for `availableLocales` and for the "missing translation → 404" claim,
each of which existed in two more places than the one I repaired. *A family sweep that greps the
words I happened to write is not a family sweep; it is a re-read of my own diff.*

**Two false universals were introduced BY the repairs and caught afterwards**, both in the round
whose subject is unverified universals:

- *"every other non-shape DTO validator is backed, because `@IsEnum` values are backed by a
  `schema.prisma` enum"* — `AdminProjectSortBy` and `SortOrder` are local TypeScript enums with no
  Prisma counterpart. The sorting question was wrong: not *which validator is this*, but **is the
  value it constrains stored at all**.
- *"the grant catalog is the only invariant enforced at the request boundary alone"* — the peer
  produced a second, and it is not a DTO: `IdempotencyKeyPipe` enforces the `Idempotency-Key`
  header's length and character set, `contact-reply.service.ts` stores the value as given, and the
  column is free `String`. The per-message uniqueness *is* `DB`-backed; the key's **shape** is not.
  My sweep had enumerated DTO validators and never looked at pipes. The text now names a **class
  with two known members** instead of an anomaly.

**And one sentence was refuted twice, for two different reasons** — the counterfactual "delete
`assertEnabled` and all you lose is the error's name". Round 2 pointed out it also guards
**writes**: the twelve locale foreign keys reference `Locale.code`, and `isEnabled` is a column,
not a constraint, so the `FK` proves existence and says nothing about enablement. Round 3's
predecessor pointed out it is not even true of reads: the guard tests **two** conditions, and a
locale that exists but is **disabled**, with stored translations, would become publicly readable.
*Unknown and disabled are not the same case, and the sentence had merged them.* Three attempts on
one counterfactual is this round's most expensive sentence.

### The instrument that destroyed work, and the one that lied

`git checkout -- <file>` was used to revert a link-checker negative control **in a dirty tree**,
and it reverted to `HEAD` — discarding the uncommitted F3 repair entirely. It was noticed only
because the next check looked for the repaired text. **Negative controls are reverted with a
`cp -p` copy taken before the probe, never with `git checkout`,** and the revert is verified by
hash against the pre-probe file.

The relative-link checker also reported **3 broken links at the baseline** on its first run. All
three were the cross-repo rebase failing because the baseline had been exported to a path whose
parent is not the sibling-repo parent — the instrument was mis-rooted, not the documents. Rewritten
to rebase from the `eslammuatamed-*` component wherever it appears, the honest reading is **0 broken
now, 0 at baseline, 0 introduced**, and its negative control flags exactly one injected bad link.
*This is the second time this specific instrument has produced a false alarm.*

### Emitted-behaviour proof for the one `.ts` change

`role.dto.ts`'s comment carried the same overclaim, so it was narrowed. The proof is a per-file
`sha256` manifest of `tsc -p tsconfig.build.json` output: **identical across all 216 emitted `.js`
files**. The instrument was negative-controlled **first** — changing `@MaxLength(60)` to `(61)`
moved `role.dto.js`'s hash — and the source was restored from a `cp -p` copy and hash-checked
against its pre-mutation value. `git diff <that head>..HEAD -- '*.ts'` is empty at every later
head, which is what carries the proof forward rather than leaving it pinned to a stale tree.

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

**Carried forward from run 7 — still open, none resolved by this round.**

| Item | State |
| --- | --- |
| `OD-A` (`D16-13` cited but absent from governance) | open, unchanged |
| `OD-B` (governing API release state stale + self-contradictory) | open, unchanged |
| Contract gap: `POST /api/v1/admin/media` can return `400`, undeclared in `openapi.json` | open — needs the doc 16 §3 contract flow, not this branch |
| `.github/workflows/ci.yml:161` comment vs the job's actual E2E steps | open, deferred outside the campaign corpus |
| `test/README` pure-unit row (~29) vs moved arithmetic | open — **not** replaced with a new number; that needs the whole 95-spec corpus classified per file |
| Upload-path implementation limits (cleanup not wrapped in `try`; a wholesale cleanup rejection replacing the original error and skipping the incomplete-compensation log; the catch boundary extending past `mediaAsset.create`; post-commit compensation against a committed row) | open — code behaviour, out of scope for a documentation branch |
| `.specify/specs/003-media-pipeline` acceptance language asserting stronger orphan guarantees than the implementation provides | open — **not** rewritten (convention 4.E) |
| Executable strings carrying the same over-certainty (`media.service.ts` delete-cleanup log says objects "remain"; `media.service.spec.ts` label "compensation (no orphans)") | open — both change emitted `JS`; owner's call |

*New evidence on the `.specify` item, not a new item.* The round-1 peer pass was scoped
repository-wide rather than to the diff, and returned **twelve** independent MAJOR findings against
`.specify/specs/003-media-pipeline/{spec,plan,tasks}.md` — unconditional no-orphan guarantees, a
`ParseFilePipe`/`MaxFileSizeValidator` upload path that does not exist in the code, dev static
serving of `STORAGE_LOCAL_DIR` that the app never registers, and object-metadata claims the local
adapter ignores. **These were reached without being told the item exists**, which is the useful
part: they are independent corroboration that the shipped acceptance records overclaim, not eight
new decisions. Still not edited here, and still the owner's call.

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

**Slices 3–5: proved with the compiler, not with a heuristic.** Per-slice "comment-only" checks
used a line filter that skips lines starting with `//`, `#`, `>`, `*`, `-`, `|`, a backtick or an
Arabic character — which a changed line of code could satisfy by accident. Re-proved with an
instrument that cannot be fooled that way: compile the baseline and the branch with
`tsc --removeComments` and diff the **emitted JavaScript**.

Across every touched TypeScript file, the emitted JS differs in exactly **six string literals**
and nothing else:

| Emitted difference | Kind |
| --- | --- |
| `describe('media descriptors (T7)'` → `'media descriptors'` | test label |
| `describe('image descriptor invariants (T7 correction)'` → `'image descriptor invariants'` | test label |
| `describe('… résumé descriptor (T7, FR-PUB-023)'` → `'… (FR-PUB-023)'` | test label |
| `describe('request body size limit (doc 19 §5, AD-7 — 1 MiB JSON)'` → `'… (doc 19 §5 — 1 MiB JSON)'` | test label |
| `` `…proves nothing about the C-6 race.` `` → `` `…proves nothing about the race.` `` | barrier-timeout diagnostic |
| `` `[β1 §9] concurrent same-key: …` `` → `` `[concurrent same-key] …` `` | `console.log` label (slice 5b) |

**Zero executable statements changed.** The figure was restated three times over this campaign
(four `describe()` labels → five strings → six), which is exactly why it is settled here rather
than reconstructed from a commit trail.

**This measurement carries a date, not a claim of finality.** An earlier version of this paragraph
said it was "re-taken at the final tip" and covered "45 touched TypeScript files". Both were wrong:
the tip moved 10 commits past the re-take, and the file count was never 45 at any tip (68 `.ts`
files are touched at the current one). *A measurement that calls itself final is a status claim
wearing a measurement's clothes* — see §0. The conclusion was re-verified at the current tip and
still holds at six strings; the count of files it ranges over is deliberately not restated, because
that number moves and this one does not.

A hand-written comment-stripper was tried first and reported six files differing, one of them
(`media-usage-invariant.spec.ts`) a pure comment change. **It was leaking comment text into the
comparison**, i.e. producing false positives. It was discarded rather than debugged: on a
question this load-bearing, the compiler already is the authority.

Two further checks the emitted-JS diff does not cover, both run and both clean:
- **No test selector was broken.** Nothing in any script, workflow or config selects on the four
  changed `describe()` strings (`--testNamePattern` and literal-string sweep: 0 hits outside the
  definitions themselves).
- **The rewritten module index matches reality.** `src/modules/README.md`'s alphabetical list was
  diffed programmatically against `ls src/modules/`: **18 = 18, nothing missing, nothing extra.**
  Checked because D-12's whole point is that a hand-maintained index drifts, and a typo in the
  replacement would have been that same defect with better prose.

**Slice 1b + 2 changed documentation and comments only.**

| Check | Result |
| --- | --- |
| files touched | 7 — `PROJECT_GUIDE.md`, `src/modules/README.md`, `src/modules/contact/README.md`, `src/prisma/README.md`, `scripts/deploy/README.md`, `prisma/README.md`, `prisma/schema.prisma` |
| `git diff` non-comment, non-prose lines | none |
| `npx prisma validate` | exit 0 (`schema.prisma` comment edited) |
| `npm run guard:docs` rot | **25 → 0** — the class is fully retired |
| `npm run guard:docs` archaeology | 64 → **62** (two `OD-2` sites removed with their narratives) |
| `npm run guard:docs:selftest` | 43/43 |
| `D16-13` citations repo-wide | **0** outside this ledger and the guard source (control: guard source still matches, 2) |
| relative links, all 5 touched docs | 0 broken, 0 introduced vs baseline `9af1aac`; negative control passes |

*Instrument note.* The first link check reported 32 broken links. All were cross-repo
`../eslammuatamed-docs/…` paths, which resolve from the primary checkout but not from a
worktree — the checker was rooted in the wrong place, not the documents. Re-run with cross-repo
paths rebased onto the real sibling layout and diffed against the baseline commit, the honest
reading is 0 broken now, 0 broken at baseline, **0 introduced**. A raw count with no baseline
would have read as 32 new defects.

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
| `40218b4` | docs(campaign): close phase 0 and make the ledger a complete checkpoint |
| `0e27801` | docs(learnability): retire the dead prisma-7-migration citations (slice 1) |
| `13a8af3` | docs(learnability): remove state reporting from code-adjacent docs (slices 1b + 2) |
| `8b80e58` | docs(campaign): record D-14 — the task ids are ambiguous, not merely unresolvable |
| `242fe7d` | docs(learnability): name the component instead of the task number (slice 3) |
| `444aaf3` | docs(learnability): retire the F9-* and P9-* archaeology families (slice 4a) |
| `b139d9b` | docs(learnability): retire the last archaeology families — guard is green (slice 4) |
| `f7bd434` | docs(learnability): retire the hyphenless phrase families (slice 5) |
| `8601563` | docs(campaign): checkpoint — corpus cleanup complete, phase 2 not started |
| `4c57f38` | fix(learnability): name the service that actually owns the resume-slot rule |
| `558d392` | docs(learnability): the route count is enforced, not merely recorded |
| `7f7a505` | docs(learnability): retire the 11B-beta and M1 chronology families (slice 5b) |
| `23da6e0` | docs(learnability): close the response-envelope obligation and record D-16 |
| `78579b1` | docs(campaign): make the ledger's own commit table true again |
| `443aa00` | docs(campaign): hand Phase 1 over — resume block rewritten for Phase 2 |
| `ad4955d` | docs(campaign): settle the emitted-JS figure at the final tip |
| `9e6e7ab` | docs(campaign): record that the fourth peer pass never returned |
| `4d6109f` | docs(campaign): note the one thing owed before the PR |
| `eff70d3` | docs(learnability): retire the alpha, digit-first and Stage families (slice 5c) |
| `bc30b05` | docs(campaign): record D-17 — the R* family is live governance, nearly retired |
| `ccceb7f` | docs(campaign): verify D-17's "harmless elsewhere" claim instead of asserting it |
| `78710bd` | docs(campaign): carry the two newest rules into the Phase 2 handoff |
| `4398d6d` | docs(campaign): the phase-0 dependency graph was never recorded here |
| `a0fd971` | docs(campaign): open Phase 2 with a durable in-flight register |
| `2ac8c48` | docs(campaign): slice 5c peer pass returned CLEAN — restate the debt exactly |
| `368d892` | docs(campaign): pre-register the difficulty model before the data lands |
| `2aa031f` | docs(learnability): explain which layer decides the status code (phase 2) |
| `a6d27f8` | docs(campaign): record the Phase 2 measurements and score the predictions |
| `a464ed2` | docs(campaign): reconcile the delegated datasets, correcting two of my numbers |

**Pushed to `origin/campaign/backend-learnability` as a durability checkpoint only.** No PR was
opened. `dev` and `main` were not touched. Nothing was deployed.
