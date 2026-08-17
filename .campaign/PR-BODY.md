# Backend Learnability, Documentation and Code Comprehension

Documentation and comments only. **No application behaviour, test assertion or API contract
changes.** Proved with the compiler, not a line filter: baseline and branch compiled with
`tsc --removeComments` and the emitted JavaScript diffed — it differs in **six string literals**
(four test labels, two diagnostic messages) and **zero executable statements**.

## Why this branch exists

The code-adjacent documentation had drifted into three failure modes that a green test suite
cannot detect, because none of them are behaviour:

1. **Unresolvable citations.** Comments and docs cited a research file that does not exist, and
   decision ids that resolve nowhere in authoritative governance.
2. **Fast-rotting state.** Deployment status, release-freeze status and completion status written
   next to code, where they go stale silently and become confident lies.
3. **Identifiers standing in for names.** Comments referred to components by campaign task number
   (`T6`), and seven feature specs each restart numbering at `T1` — so one token named one of seven
   possible things.

## What changed

| Measure | Before | After |
| --- | ---: | ---: |
| Campaign archaeology references | 68 | **0** |
| Fast-rotting state claims | 25 | **0** |
| Hyphenless campaign phrases | 96 | **5** (all deliberate keeps, each with a recorded reason) |
| `npm run guard:docs` | RED | **GREEN** |

Plus new learning material, all derived from measurement rather than opinion: which layer decides
each HTTP status code, a reading order for a newcomer, the module README template, a testing
curriculum, and one request traced end to end.

## Two defects worth calling out

**Four implemented modules were documented as "not yet written".** `PROJECT_GUIDE.md` listed
`redirects`, `contact`, `preview` and `seo` under *Planned — not yet written*, and told the reader
in its own words not to treat anything outside `Shipped` as existing. All four have controllers,
services, specs and READMEs, and all four are registered in `app.module.ts`.

**A comment named the wrong class.** The campaign itself introduced this: mapping task ids to
component names uniformly attributed a résumé-slot rule to `MediaService` when `SettingsService`
enforces it — the misattributing comment sat four lines above the code that does the check. Caught
by peer review, not by any gate. It is worse than the ambiguous token it replaced, because a
confident wrong name reads as authoritative.

## Verification

`prisma validate` 0 · `typecheck` 0 · **61 suites / 1273 tests** · guard GREEN · self-test 43/43 ·
all four workflow YAMLs parse · guard-independent sweep for every archaeology and chronology family
returns zero, with passing positive controls.

## What is NOT done, stated plainly

- **The cold-reader exit gate has not been run.** It is defined in the ledger as ten questions
  answerable from documentation alone, each with a plausible wrong answer. It requires a reader who
  has not worked on this repository, which disqualifies every agent involved here. **This is the
  one criterion that decides whether the work teaches, and only the owner can run it.**
- The provenance guard has four known blind spots (pattern family, file selection, token boundary,
  alphabet). The corpus is clean by *independent sweep*, not because the guard says so. Widening it
  is queued and deliberately not required for this branch.
- Two governance items, **OD-A** and **OD-B**, are untouched and remain the owner's. This branch
  only stopped propagating them into code-adjacent docs.

## Scope

Ends here. **No `dev` → `main` promotion and no production deployment** are authorized or performed;
`dev` and `main` are unchanged at the baseline. Full history, findings and evidence are in
`.campaign/backend-learnability-ledger.md`, whose §0 is the single source of current state.
