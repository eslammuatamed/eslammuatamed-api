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
- **Run 2 happened, and the scoring gate PASSES: 10/10 on the main gate, 6/6 on the regression
  set — 16 of 16.** A second, uncoached, documentation-only reader recovered every repair *with
  its reason*, not just its fact.
- **And a real defect was standing the whole time.** Run 2's unscored, open-ended assessment found
  what none of the sixteen questions touched: this guide used framework vocabulary long before the
  reader reached the vocabulary table this campaign had just added — `decorators` at line 33 (§2),
  dependency injection at line 99 (§5), table at line 383 (§15, ~84% in). The declared reading
  order was right; **the physical order was never checked.** *A passing gate is not proof the
  corpus is sound — only that it answers those sixteen questions. In both runs the instrument that
  carries no score out-produced the one that does.*
  Repaired by **moving** the single table to the head of the guide, before §1, as a permanently
  **unnumbered** section — `README.md` cites §11 by number, so numbering it would silently break
  that citation. §15 keeps a back-reference, never a copy.
  Peer review rejected the first attempt: the carve-out excusing guards/pipes/interceptors/filters
  did not hold (§5 positions a pipe but never defines one; `DTO` and `ValidationPipe` appear in §4,
  *before* §5), so five bounded rows were added — one line each, with the official page that owns
  the teaching. All fourteen terms then had their first occurrence inside the block — but the
  block's own rows were still not in order, which run 4 found.
- **Run 3 scored the gate 16/16 again, and its targeted regression FAILED** — correctly. The
  placement fix had moved the vocabulary block to the head of the guide and then reproduced the
  original defect *inside the block*: `Guard → Pipe → Controller` and "بين الطلب والـ controller"
  both appear there, while `controller` was defined only in §5.
- **Its five open-ended findings were all confirmed, and two were worse than reported.** A
  lifecycle label calling `preview` "Planned" (it has a module, two controllers, four routes and a
  registration) — and the same defect class in a second file. A `settings` README advertising a
  route that does not exist. A `400` summary its own table falsified — and the retired model
  surviving in a second file. A prerequisite pointing at `docs/09-…`, which **no one could follow**:
  there is no `docs/` directory in this repository. And the media contract, where `openapi.json`
  showed the campaign's own general rule was **overbroad and named as its own example** the one
  field that breaks it (`PublicSiteSettingsEntity` has no `resumeAssetId`; `resumeAsset` replaces
  it). Four statements narrowed, not two.
- **Two peer rounds then found nine more, in the repairs themselves** — including that I claimed
  `preview` was the *only* thin-controller exception without sweeping the controllers. There are
  five. The corrected teaching is better than the claim it replaced: the line is not "no code in a
  controller", it is **no domain rules** — an HTTP-shaped decision belongs at the boundary, and
  `preview` is distinctive only because its decision is a *security* one (`403` would prove the
  draft exists).
- **An instrument was lying.** The link checker special-cased any `eslammuatamed-docs` path onto
  the primary checkout, so wrong-*depth* links passed. Rebuilt and negative-controlled; it
  immediately found three dead links this campaign had never seen. Full sweep: 61 files, 0 broken.
- **Open, owner-facing, deliberately not fixed here:** `POST /admin/media` can return `400`
  (missing `file` part) and `openapi.json` does not declare it. Declaring it changes the contract,
  which this documentation-only branch must not do — it needs the doc 16 §3 flow.
- **Run 4's regression failed too — on the block's *inside*.** Moving the vocabulary to the head
  fixed where it sits; nobody had ordered the rows within it. `DI` used `PrismaService` three rows
  before its definition, `@Global` used "dynamic module" one row before, and `controller` handed
  **domain rules** to a `service` that had *no row at all* — its meaning lived in §5. Sweeping all
  fourteen rows found a fourth the reader missed: `PrismaService` cites the lifecycle hooks defined
  below it. Reordered topologically, with one bounded `service` row added; the genuine
  `DI` ↔ `PrismaService` cycle is broken by stating the test seam without naming the class. The
  prose above the tables *described those forward references as deliberate*, so it was false the
  moment they were removed — it moved with them.
- **Six more from run 4's unscored pass, every one verified against code or contract first.** §11
  claimed the CI e2e lane runs `migrate deploy` → `db:seed`; the literal YAML runs neither, and
  **three** independently-worded copies of that mechanism existed, so §11 now owns the step list
  alone. `media/README` stated the descriptor rule with no exception — and here the sweep *cleared*
  its neighbours: a script over every schema in `openapi.json` proves `resumeAsset` is the only
  descriptor without a sibling raw id and `AdminSiteSettingsEntity.portrait` the only admin
  descriptor, so §6.5's two absolutes are exhaustively true and only the media README was overbroad.
  `projects/README` named the field `blurDataUrl`; the contract says `blurhash` and `blurDataUrl`
  appears nowhere else in the repository. §10 read as the validated environment set while naming 20
  of 29 variables. `test/README` counted six types above a table of seven.
- **The reading-order finding inverted under verification.** The reader doubted that `articles` and
  `projects` import `media`. They do — `imports: [LocalesModule, MediaModule, RedirectsModule]` in
  both, plus `MediaDescriptorResolver` in both constructors. **The guide was right and the module
  READMEs were wrong**, and sweeping the family found four bad dependency maps rather than two, plus
  an `articles/README` absolute — "no other module imports `ArticlesService`" — that `PreviewModule`
  falsifies. *Two reader findings were experiment artifacts and are recorded as such, not "fixed":
  `openapi.json` is absent from the bundle but present in the repository, and the doc-09 pointer
  resolves correctly under the real checkout layout.*
- **A count was left alone on purpose, and that decision survived being wrong.** `test/README`'s
  type table sums to 93 files. A first census said the true total was 90, implying one row should
  read 26; that census had missed two of jest's four declared roots. The real total is 95, so the
  residual points the *other* way. Had the first number been written in, the corpus would now carry
  a confident falsehood. The row keeps its `~` until all 95 specs are classified per file.
- **One item remains:** a new uncoached reader on a bundle from the current head — internal
  vocabulary ordering, each confirmed run-4 repair, a few unchanged controls, and an unscored
  open-ended pass kept.
- The provenance guard has four known blind spots (pattern family, file selection, token boundary,
  alphabet). The corpus is clean by *independent sweep*, not because the guard says so. Widening it
  is queued and deliberately not required for this branch.
- Two governance items, **OD-A** and **OD-B**, are untouched and remain the owner's. This branch
  only stopped propagating them into code-adjacent docs.

## Scope

Ends here. **No `dev` → `main` promotion and no production deployment** are authorized or performed;
`dev` and `main` are unchanged at the baseline. Full history, findings and evidence are in
`.campaign/backend-learnability-ledger.md`, whose §0 is the single source of current state.
