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
> **Verify before doing anything** (zero-trust, per the campaign's own rule):
> ```
> git -C <worktree> rev-parse origin/campaign/backend-learnability   # campaign tip
> git -C <worktree> rev-parse origin/dev origin/main                 # both MUST be 9af1aac…
> npm run guard:docs:selftest && npm run guard:docs                  # 43/43, then GREEN
> ```
> The §9 commit table is generated from `git log`, so it is the authority on what landed.
>
> **One thing is owed before the PR, not before phase 2 starts:** a single peer pass over
> `7f7a505..HEAD`. The three delivered passes covered slices 1–5 and the wrong-class fix; the
> fourth was requested and never returned, so everything from `7f7a505` on carries author
> verification only (§5 records exactly what was verified and how). This does not block design
> work — it blocks opening the PR.
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
**FINAL PHASE 1 READING:** **0 archaeology + 0 rot + 5 phrases, all deliberate keeps.** `guard:docs` is GREEN, corroborated by a
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

**Phase 2 — learning architecture. NOT STARTED, and deliberately not started in this session.**
It is a design job that should begin from a clean corpus and a fresh context, with this ledger as
its only input. Starting it at the tail of six implementation slices is how design work inherits
tired judgement.

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
| `graph-derive` — module dependency graph, size/test/surface signal, concept load | re-derive the phase-0 input that was never recorded (§6) | **OUTSTANDING** |
| `readme-survey` — de-facto section template across the 17 module READMEs, divergence, depth, opening contract | input to the module template | **OUTSTANDING** |

Results land in **§10** (below) as compact tables. If a dispatched agent never returns, that is
recorded here as review debt in the same terms §5 uses — never silently upgraded into
"verified".

### Review debt — restated precisely, because it has materially shrunk

Slice 5c's pass returned **CLEAN on all three questions**, and it verified rather than re-read:
it traced `contact-reply.service.ts:220` → `contact-mail.service.ts` → `mail.service.ts:104-109`
to confirm the client key never reaches the provider header, and confirmed the *other* half of
that rewritten claim by reading `pino-logger.config.ts:46-64` — `req.headers` is logged wholesale
and the idempotency header is **not** in `redact.paths`, so "travels into log lines" is literally
true. It ran a positive control on its own sweep regexes (planted `11B`, `M1`, `Stage 2C`; all
three fired), so its clean Q3 is a real negative, not a broken instrument.

**Current debt — exact:**

| Commits | Review status |
| --- | --- |
| Slices 1, 1b, 2, 3, 4, 4a, 5 + the wrong-class fix | peer-reviewed |
| `7f7a505` (slice 5b) | peer-reviewed — Q1/Q2 clean; its Q3 produced slice 5c |
| `eff70d3` (slice 5c) | peer-reviewed — CLEAN |
| Ledger-prose commits after `eff70d3` (`bc30b05` → `a0fd971`) | **unreviewed** — this file's own prose only, no source touched |

**So the debt is now confined to this ledger's prose.** No source or documentation change on the
branch is unreviewed. Stated this precisely rather than carrying forward the older, larger claim,
because overstating debt is as much a truthfulness failure as understating it — and understating
it is the one that ships. Still a **PR** gate, not a phase-2 blocker (owner direction).

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

*Scoring happens in §10 once the measurements land. If the data contradicts either prediction, the
contradiction is recorded there and the model is changed — not the prediction.*

## 10. Phase 2 measurements

*(Empty until the dispatched investigations return. Data lands here rather than in a session
transcript, because §6 already recorded one "extracted" result that was lost exactly that way.)*

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

**Slices 3–5: proved with the compiler, not with a heuristic.** Per-slice "comment-only" checks
used a line filter that skips lines starting with `//`, `#`, `>`, `*`, `-`, `|`, a backtick or an
Arabic character — which a changed line of code could satisfy by accident. Re-proved with an
instrument that cannot be fooled that way: compile the baseline and the branch with
`tsc --removeComments` and diff the **emitted JavaScript**.

Across all **45** touched TypeScript files, the emitted JS differs in exactly **five string
literals** and nothing else:

| Emitted difference | Kind |
| --- | --- |
| `describe('media descriptors (T7)'` → `'media descriptors'` | test label |
| `describe('image descriptor invariants (T7 correction)'` → `'image descriptor invariants'` | test label |
| `describe('… résumé descriptor (T7, FR-PUB-023)'` → `'… (FR-PUB-023)'` | test label |
| `describe('request body size limit (doc 19 §5, AD-7 — 1 MiB JSON)'` → `'… (doc 19 §5 — 1 MiB JSON)'` | test label |
| `` `…proves nothing about the C-6 race.` `` → `` `…proves nothing about the race.` `` | barrier-timeout diagnostic |
| `` `[β1 §9] concurrent same-key: …` `` → `` `[concurrent same-key] …` `` | `console.log` label (slice 5b) |

**Zero executable statements changed, across the whole campaign.** Re-taken at the final tip, so
this table is the complete picture and not a per-slice snapshot. The running count was corrected
twice: commit messages first said "four `describe()` labels", then five strings; the true figure
is **six string literals** — four test labels and two diagnostic messages. Recorded here because
the ledger, not any commit message, is the durable record, and because a number that was restated
twice is exactly the kind a reader should be able to see settled in one place.

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

**Pushed to `origin/campaign/backend-learnability` as a durability checkpoint only.** No PR was
opened. `dev` and `main` were not touched. Nothing was deployed.
