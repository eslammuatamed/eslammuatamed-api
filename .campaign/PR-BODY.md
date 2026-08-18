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

`typecheck` 0 · `lint` 0 · **61 suites / 1273 tests** (re-run this round) · guard GREEN · self-test 43/43 ·
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
- **Three peer rounds on the run-4 repair, and the middle one is the lesson.** Round 1 returned
  **7 MAJOR + 1 MINOR**, round 2 **5 MAJOR + 2 MINOR**, round 3 **0 MAJOR + 1 MINOR**. Four of round
  2's five MAJORs were defects the *repair* introduced, not survivors of it — including my own
  unswept quantifier ("every `*.service.ts` owns domain rules": `AppConfigService`, `PrismaService`
  and `MailService` do not), and a correction that put the line on directory location while both
  counter-examples live in the same directory. **Fixing is not a safe operation on this corpus.**
  One peer finding was pushed back on with an enumeration and the original number stands.
- **A document and the comment beside it were made to disagree in the same hour.** The media README
  was corrected to name `seo` a current consumer while `media.module.ts` and
  `media-descriptor.resolver.ts` kept calling it "a future page-SEO read"; `env.validation.ts` and
  `.env.example` both still said every SMTP field becomes required when enabled, which
  `SMTP_SECURE` does not. The sweep that should have caught it searched documents, and the claim
  also lived in `.ts`. Those three `.ts` files changed — **comments only**, proved by compiling both
  sides with `tsc --removeComments` to byte-identical output, with a negative control confirming an
  appended statement does show up.
- **Two of this round's own instruments produced a false green before they produced evidence.** The
  vocabulary-ordering checker located its table by hard-coded line numbers, so when the block grew
  it silently read 13 of 15 rows and passed; the comment-only proof compared two empty directories,
  because `zsh` does not word-split an unquoted multi-line variable. Both now assert their subject's
  size before reporting, and both are negative-controlled with exit codes read directly rather than
  through a pipe, which had masked them.
- **Run 5: the vocabulary block passes, and the same defect was one level up.** A fifth reader walked
  all fifteen rows and reported no forward dependency — four runs of work on that block holds. Then
  §4 calls Prisma *"the `data-mapper` (no `repository` layer)"* and §5 builds an architectural
  decision on the contrast, while **both terms are defined only in `src/prisma/README.md`**, which
  the guide's own reading order places *after* the guide. Defined now in one bounded line at first
  use; the full argument stays where it was.
- **Six more from its unscored pass, and the census had to come before the wording.** *"Every service
  injects `PrismaService`"* is false — and so was `prisma/README`'s softer *"almost every"*: of 25
  `*.service.ts` files besides `PrismaService` itself, **18** inject it and **7** do not. The count
  was never the lesson; the lesson is that no repository layer sits between a service and Prisma, and
  that **the `.service.ts` suffix promises no database access while the absence of an injection does
  not mean the absence of a database** — `auth.service.ts` reaches the database through `users` and
  `refresh-token`. Also: the test seam is the **constructor**, not the DI container; the reading path
  claimed exactly three modules lay outside it and `users` is a fourth, previously left with no slot
  at all; `projects/README` said `ogImageId` "remains a raw reference", which reads as *and nothing
  else*, while the contract carries both it and `ogImage`; `media/README` called résumé-PDF upload
  the module's work and then, under accepted limitations, said it was outside the module's scope —
  the subject was wrong, it is outside the e2e tests; and `test/README`'s e2e file map read as an
  inventory while naming 11 of 34.
- **An "accepted limitation" had decayed like any other claim.** *"No e2e for PDF upload"* is false:
  `page-seo.e2e-spec.ts` uploads a real `resume.pdf` through `POST /admin/media`, expects `201` and
  asserts `kind === PDF`. Its two neighbouring limitations were then checked rather than assumed, and
  both hold.
- **And "most" shipped twice, one round apart, in the same claim family.** It was struck from the DI
  vocabulary row by one peer round and reappeared in `src/prisma/README.md` the next — 22 of 61 is
  36%. **A retraction in one file is not a fix for the word.** The peer lane on the run-5 repairs ran
  **3 MAJOR → 1 MAJOR → CLEAN**, and that single round-2 MAJOR was a sentence its own next clause
  refuted.
- **Run 6 closed the prerequisite-order class.** A sixth reader read the guide linearly and reported
  nothing out of order — six runs after the defect began as one misplaced vocabulary table. Its
  unscored pass then found the sharpest finding of the campaign.
- **The media README promised a guarantee the code does not make, and it had copied it from a source
  comment.** *"Cleanup never throws; and if objects remain, `media.compensation_incomplete` is logged
  — so there is neither an orphan row nor an orphan object"* — one clause denying what the clause
  before it states, and `media.service.ts` logs exactly that case by name. The false half was
  inherited: `cleanup()`'s own comment asserted *"Cleanup never throws"* while awaiting `deleteMany`
  bare, and the sibling `cleanupAfterDelete` — 175 lines away, same file, same adapter — said the
  opposite and wrapped it in `try`. **The document was the honest witness of a lying comment.**
- **Repairing it took eight peer rounds — 2, 2, 4, 10, 9, 7, 1, clean — and three of my first three
  attempts each shipped a new absolute:** "absolutely", then "every failure", then "the only path".
  The last fell because a rejected `create` does not prove PostgreSQL did not commit.
- **Round 4 changed the method, and that is the transferable part.** Three diff-scoped rounds each
  found defects created by the previous repair, including a stale comment *twenty lines above* the one
  being fixed. Dispatched against the claim *family* instead of the diff, the next round returned ten
  findings — every one a probabilistic or best-effort mechanism written up as a guarantee: "the raw
  upload is never persisted" (true of images, false of PDFs), "cleanup can never touch another asset's
  objects" (rests on `randomUUID()` alone), "never the master" (the admin entity falls back), "a
  further upload is rejected with 429" (a dedup hit never reaches the cap), and six more. Two later
  rounds found sentences contradicting their own next clause, and one found a plain factual error —
  a column documented as `text` that is named `alt`.
- **Two other run-6 findings, both confirmed:** the e2e summary's *"non-image → 422"* is a category the
  test is not about (its fixture is plain text with a spoofed image extension, and PDF is a supported
  type accepted with `201`); and the guide said you would not meet `locales` *"in preview"* — true of
  the imports array and false about behaviour, since both preview reads delegate to `getPreviewById`
  where `assertEnabled` runs. **A delegated dependency does not appear in an imports list.**
- **Run 7 passed on every taught concept and the open pass carried the round.** Compensation as
  best-effort, orphan object separated from orphan row, `204` separated from storage cleanup and
  from a cached URL, transformed image bytes vs raw `PDF` bytes, delegated locale validation, the
  `1 MiB` / `10 MiB` / `40 MP` split, `P2002` → `422`, reading order, env authority — all correct.
  The unscored pass produced the entire yield, for the fourth consecutive run.
- **What it found was one family wearing five faces: a summary claiming ownership it does not have.**
  The guide called the whole unauthenticated surface read-only — there are four `@Public()` writes
  (`auth` login/refresh/logout, `contact`) and several public reads that return no localized content
  at all. A `422` row said media rejects a file's "size", eleven lines below the row mapping byte
  size to `413` — the `422` case is pixels. `locales/README` credited `assertEnabled` with the
  platform-wide no-fallback rule, when its body is `findUnique` plus an `isEnabled` check and the
  actual behaviour is split across per-module query shapes whose missing-translation outcome is not
  even uniform (`404` in articles/projects, `null` fields in `settings` and `seo`). And "domain rules
  are all in the service" had counter-examples worth teaching rather than hiding.
- **The counter-example turned out to be a class, not an anomaly — and finding that took two
  corrections.** The storable-grant catalog is enforced only by `@IsIn(GRANTABLE_PERMISSIONS)`: the
  service writes the array through unchecked, the column is free text, and `prisma/seed.ts` writes
  it directly. I wrote that it was the *only* such case. It is not: `IdempotencyKeyPipe` enforces the
  `Idempotency-Key` header's length and character set while the service stores the value as given —
  the per-message uniqueness is `DB`-backed, the key's **shape** is not. My sweep had enumerated DTO
  validators and never looked at pipes.
- **A category that gains a member every round is the wrong category.** Told the grant catalog was
  the only boundary-only invariant, the next round produced a second; told it was a class of two, the
  round after produced a third (`Role.name`'s length cap). The measurement ends the regress:
  `schema.prisma` has **zero** `@db.VarChar`/`@db.Char`, so every length and shape cap in the
  repository is boundary-only by construction. What is actually distinctive about the grant catalog
  is that it constrains **meaning**, not size — and among constraints of that kind it is the only one
  with nothing behind it. That passage was rewritten three times and only the third version rests on
  a fact one grep can refute.
- **An edit can falsify a number in a file it never touches.** Growing `media/README.md` made a
  count in the module-README template ("shortest 37 lines, longest 136") stale. Counts in this round
  were either given their derivation or removed, including two numerals the repairs had themselves
  introduced.
- **An instrument can be wrong because it is pointed at the wrong artifact, and it happened twice.**
  I argued every length and shape cap is boundary-only, evidence being zero `@db.VarChar` in
  `schema.prisma`. `Prisma` cannot represent `CHECK` constraints — they live in migration `SQL` and
  never appear in the schema. Ten exist; two of them back shape at the column. Later, a census of
  locale filtering matched `Prisma` include syntax only and missed a raw-`SQL` `JOIN` doing the same
  job. **Both censuses returned confident, clean-looking zeros, and neither was weak evidence — each
  was no evidence at all.** The repository had even said so, in a migration comment I had not read.
- **Repairing a named line is not repairing a family.** One file carried two "the only place that can
  prevent it" comments; the first was corrected and the second left asserting the opposite. A
  repo-wide sweep of enforcement universals in source comments followed — the two others it found
  were verified TRUE and left alone.
- **One passage was rewritten four times and only stopped needing repair when it stopped
  enumerating.** Every earlier version of the locale-ownership cell listed examples, and every round
  found the member the list omitted. The version that holds states the rule the census supports.
- **The peer rounds cost 20 MAJOR, then 7, 4, 7, 3 and 3, and the repairs were the defect source
  every time.** Of
  round 1's five in-corpus findings, every one was a sibling of a family I had already "fixed" at its
  named site — because I had swept the Arabic words I happened to write rather than grepping
  `@Public()`, `availableLocales`, and the `404` claim across the corpus. Five of round 2's seven were
  against text round 1's repairs had written, including two false universals introduced *in the round
  whose subject is unverified universals*. **The convergence is the evidence the method worked; the first number is the evidence it was needed.** And the lane did not end on a round count — it ended when a round found nothing.
- **One sentence was refuted twice, for two different reasons,** and it is the best single artefact
  of the round: "delete the locale check and all you lose is the error's name". It also guards
  **writes** — the locale foreign keys reference `Locale.code` and `isEnabled` is a column, not a
  constraint. And it is not true of reads either — the guard tests *two* conditions, and a locale
  that exists but is **disabled**, with stored translations, would become publicly readable. Unknown
  and disabled are not the same case.
- **`openapi.json` was reported unreadable and is not a defect.** It is tracked and named as the
  deciding authority in six places; the reader's bundle simply did not carry it. Contract content was
  **not** duplicated into READMEs to make a bundle self-contained. Likewise the per-width byte budgets
  are governed by doc 20 §4 and mirrored in `RENDITION_BUDGETS`; the repair names that authority and
  deliberately does **not** copy the six numbers into prose.
- **One `.ts` file changed, and only a comment in it.** Emitted `JavaScript` is byte-identical across
  all **216** files (`sha256` manifest of `tsc -p tsconfig.build.json`), with the instrument
  negative-controlled first — a real `@MaxLength` change moved the hash.
- **An enumeration of code sites in prose is structurally unstable; the rule behind it is not.**
  Seven of eight peer rounds found something in one passage, and every repair but the last was a
  more precise list of modules — each round finding the site the previous list omitted. The version
  that holds states the rule and cites a per-service census as its derivation. The counterweight is
  equally important: generalising swept away a **true** exception an earlier version had stated
  correctly (media `alt` text is never query-filtered, in any module), so the final text carries the
  rule *and* the exception.
- **The peer lane ended CLEAN on the exact final tree**, not on a round count — 20, 7, 4, 7, 3, 3,
  1, then nothing, the last two rounds narrow and claim-numbered.
- **One item remains:** a narrow Run-8 cold regression from this exact head, over the concepts this
  round changed.
- The provenance guard has four known blind spots (pattern family, file selection, token boundary,
  alphabet). The corpus is clean by *independent sweep*, not because the guard says so. Widening it
  is queued and deliberately not required for this branch.
- Two governance items, **OD-A** and **OD-B**, are untouched and remain the owner's. This branch
  only stopped propagating them into code-adjacent docs.

## Scope

Ends here. **No `dev` → `main` promotion and no production deployment** are authorized or performed;
`dev` and `main` are unchanged at the baseline. Full history, findings and evidence are in
`.campaign/backend-learnability-ledger.md`, whose §0 is the single source of current state.
