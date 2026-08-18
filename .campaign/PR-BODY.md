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

- **The cold-reader exit gate RAN, and it is not passed yet.** A genuinely cold reader answered
  the ten questions from documentation alone. **Nine were answered correctly — four of the five in
  §A, and all five in §B** — including the three the campaign considered its hardest teaching
  problems (which layer rejects first, the `try/catch` that does not exist, the two unrelated size
  limits). The tenth is **question 2, from §A, scored as neither pass nor fail: the question
  itself was defective**, not the answer. It asked about an `/admin` route without stating that
  the global guards pass, so `429`/`401`/`403` all legitimately precede the intended `400` — and
  the corpus is *right* to teach that guards run before pipes. Rewritten to state that assumption,
  with the scored content moved to the ordering fact the reader actually had to know.
- **The run found four documentation defects the ten questions did not**, all verified against
  the code before being fixed, all fixed in this branch:
  - `README.md` claimed deployment is triggered by a `vX.Y.Z` tag and attaches `openapi.json` as a
    release artifact. Literal YAML says otherwise on both counts: `deploy.yml` has no tag trigger,
    and `openapi.json` is a CI upload artifact with no release step anywhere. `PROJECT_GUIDE` §11
    was already correct — the fix gives the mechanism a single owner instead of a second copy.
  - `PROJECT_GUIDE` §15 called `redirects` the reader's *first encounter* with `$transaction`. It
    is at least the fourth. What `redirects` is genuinely first at is transaction-boundary
    **ownership**, which is a different lesson and is now the one stated.
  - `mail` is a real prerequisite of `contact` — `contact`'s `PENDING`→`SENT`/`FAILED` machine is
    unreadable without three facts that live only in `mail/README.md` — and it was missing from
    the reading order entirely. Inserted. `auth → users` was checked as the same shape and
    deliberately handled differently: `users` is 24 lines with no controller and no routes, so it
    gets a clause, not a step.
  - The path sends a Vue/Nuxt reader into `src/config` and `src/prisma`, which open on `@Global`,
    providers, DI, `ConfigModule.forRoot` and lifecycle hooks with no definition anywhere earlier.
    Fixed with a bounded eight-row vocabulary table that defines each term *as this repo uses it*
    and hands the actual teaching to the official NestJS pages. Not a tutorial.
- **The reading order never respected prerequisites, and both the guide and the ledger said it
  did.** `articles` and `projects` are step 9 and both import `MediaModule`, which is step 10. The
  trade is deliberate and defensible — `media` is the heaviest module in the repo — but the claim
  was false. Corrected in place in both documents, not appended to.
- **A rerun is required before this branch is complete**, from a bundle rebuilt at the new head,
  by a different reader who has never seen these questions.
- The provenance guard has four known blind spots (pattern family, file selection, token boundary,
  alphabet). The corpus is clean by *independent sweep*, not because the guard says so. Widening it
  is queued and deliberately not required for this branch.
- Two governance items, **OD-A** and **OD-B**, are untouched and remain the owner's. This branch
  only stopped propagating them into code-adjacent docs.

## Scope

Ends here. **No `dev` → `main` promotion and no production deployment** are authorized or performed;
`dev` and `main` are unchanged at the baseline. Full history, findings and evidence are in
`.campaign/backend-learnability-ledger.md`, whose §0 is the single source of current state.
