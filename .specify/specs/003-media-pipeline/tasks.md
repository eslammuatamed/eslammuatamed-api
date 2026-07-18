# Tasks 003 — Media Pipeline (API)

Executor: Opus (Codex-assisted, coordinator-reviewed). Each task cites its governing doc; check
off only with its verification done. `[P]` = parallelizable with siblings. **Tasks run only after
the owner approves the spec + plan** (Q1–Q4 resolved 2026-07-18). Dependency spine:
**T1 → T2 → T3 → {T4, T5} → T6 → T7 → T8 → T9 → T10 → T11** (T4/T5 parallel after T3; T6 needs both).

- [x] T1 — Doc-first revisions (docs repo; doc 01 principle 1) **[gate]** — done: docs 2623b15, pushed as PR #2
  - `eslammuatamed-docs` on branch `003-media-pipeline`: **doc 02** v1.4.0 (FR-DSH-030–034, D02-7),
    **doc 07** v1.1.0 (§6 rewrite, D07-6), **doc 09** v1.4.0 (`MediaAsset` reconcile + `MediaAssetVariant`
    + enums, D09-11/12/13), **doc 10** v1.3.0 (media endpoints + descriptor contract, D10-10), **doc 19**
    v1.3.0 (§5/§6, D19-9; D19-6 unchanged), **doc 20** v1.2.0 (D20-6), **doc 23** v1.3.0 (D23-15) — each
    with decision-log entries + version bumps. Roadmap untouched; no handoff/memory file.
  - **Verify:** docs committed with decision IDs + version bumps **before** any API code lands. (Diffs
    are staged now; commit on owner approval.)
- [x] T2 — Dependencies (doc 16 §4 gate) — done: e828ebd
  - Add `sharp`, `@aws-sdk/client-s3`, `blurhash` (runtime) and `@types/multer` (dev). `multer` +
    `file-type` already present transitively; `file-type` used only via the framework validator.
  - **Verify:** lockfile committed; `npm audit --audit-level=high` clean; `contract:export` still
    DB-free; `sharp` loads on a linux/x64/glibc build (deploy-target match — plan Verification).
- [x] T3 — Schema + migration (doc 09, D09-11/12/13) — done: 55d8f90 (amended; redundant index removed)
  - `MediaAsset` + `kind` (`MediaKind`), `contentHash` (SHA-256 of the **original upload bytes**, **unique**), `originalFilename`;
    `width`/`height`/`blurhash` image-only. New `MediaAssetVariant` (`format` `MediaVariantFormat`,
    `width`, `height`, `storageKey` unique, `sizeBytes`, `overBudget` Boolean default false;
    `@@unique([mediaAssetId, format, width])`; CASCADE). New enums `MediaKind`, `MediaVariantFormat`.
    One additive migration (empty tables, no backfill).
  - **Verify:** `prisma validate` + `format` clean; `migrate deploy` applies; M1/002 unit+e2e still green;
    `contract:export` DB-free green.
- [x] T4 [P] — StorageAdapter + config (doc 07 §6 D07-4, doc 23 §1 D23-15) — done: 56be678 (driver fails closed; prod requires s3)
  - `StorageAdapter` interface + `LocalStorageAdapter` (dev/tests) + `S3StorageAdapter` (R2,
    `@aws-sdk/client-s3`, region `auto`); provider factory on `STORAGE_DRIVER`. Add `S3_*` env
    (conditional when `STORAGE_DRIVER=s3`) to `env.validation` + `.env.example`; dev static serving of
    `STORAGE_LOCAL_DIR` at `/media`. Randomized immutable keys; media-origin URL builder; `put` writes
    object metadata (content-type; immutable `Cache-Control: public, max-age=31536000, immutable` for
    images; `Content-Disposition: attachment` for the resume PDF — so R2 serves each correctly on direct
    fetch, D23-15).
  - **Verify:** unit — local adapter round-trip, key randomization, URL composition, driver factory,
    object metadata (image `Cache-Control` immutable; PDF `Content-Disposition`); S3 adapter unit with
    mocked client; env boot rejects missing `S3_*` when `driver=s3`. **No** speculative R2 checksum
    workaround unless a T10 integration test proves it needed.
- [ ] T5 [P] — Processing service (doc 20 §4 D20-6, doc 19 §5 D19-6/9) — *needs T3*
  - Image: content-sniff (framework `ParseFilePipe` magic-byte validator), **40 MP `limitInputPixels`**
    (explicit), `sharp` auto-orient + strip metadata → sanitized **WebP-q90 master** (full dims, no upscale;
    the raw upload is never persisted; `MediaAsset` describes the master; `blurhash` from it) → **renditions**
    640/1280/1920 ≤ master width (a <640 px source → one own-width rendition) × WebP+AVIF, each meeting its
    doc 20 §4 width×format budget via the explicit ladder **`nextQuality = max(minQuality, currentQuality−8)`**
    (floors WebP q55 / AVIF q40); a rendition still over at the floor is kept with **`overBudget=true`** on the
    variant **and** a structured pino log event. PDF: validate (magic bytes + ext + size + integrity), **no** Sharp, no variants.
  - **Verify:** unit with fixtures — master is WebP-q90 at source dims; rendition widths present + **none
    above master** (no upscale); a <640 px source yields exactly one own-width rendition; `blurhash`
    non-empty; EXIF stripped; renamed non-image + SVG → rejected; **40 MP boundary** accept(=)/reject(>);
    each rendition ≤ budget or floor with `overBudget=true` persisted + a structured log line; PDF path produces no variants. Run with
    `NODE_OPTIONS=--experimental-vm-modules`.
- [ ] T6 — Media module: admin endpoints, dedupe, usages, compensation (doc 10 §5, doc 07 §6 D07-6)
  - `POST /admin/media` (multipart, image or resume PDF → **201** new / **200** existing with `meta.deduplicated: true`),
    `GET /admin/media` (paginated, search filename+alt, `kind` filter), `GET /admin/media/{id}`,
    `PATCH /admin/media/{id}` (per-locale alt), `GET /admin/media/{id}/usages`, `DELETE /admin/media/{id}`
    (409 + usages if referenced). Dedupe by `contentHash` of the original bytes (201 / 200 + `meta.deduplicated`), hash checked **before** Sharp on the fast path; **concurrent race**:
    DB-unique loser deletes its objects + returns the winner. Usage aggregation across **every** FK (article
    cover, article/project OG, project gallery, testimonial avatar, page-SEO OG, `SiteSettings.resumeAssetId`).
    Compensation (objects-before-row, delete-on-failure, partial-variant cleanup). Wire the **2-wide processing
    concurrency limiter** (429/`Retry-After`).
  - **Verify:** unit — new→201; duplicate→200 + `meta.deduplicated`; concurrent-race loser leaves no orphan + returns
    winner; usages across every relation incl resume; 409 on referenced delete; alt CRUD; PDF only to resume slot
    (attachment metadata, T4); compensation tests for **partial-variant / DB-failure / dup-race**; 429 past the
    concurrency limit.
- [ ] T7 — Public media descriptors (additive, doc 10 §6 D10-10)
  - Resolve `mediaAssetId` → descriptor on public `projects`/`articles`/`testimonials`/`settings`/`seo`
    read shapes; **retain** existing `*Id` fields; resolve in the parent query (Prisma `include`);
    media-origin URLs; image `url` = **widest WebP rendition**; `alt` = **`string | null`** per `?locale=`
    (`null` = missing, no fallback; `""` = decorative) — distinction preserved in the DTO **and** OpenAPI.
  - **Verify:** unit — descriptor shape (image `url`=widest WebP + `variants[]`; PDF); IDs retained;
    **query-count assertion → no N+1**; `alt: null` on missing-locale **vs** `""` decorative both round-trip.
- [ ] T8 — Permission wiring + upload throttle (D19-8, doc 19 §6)
  - Wire each new protected route to its existing `media.*` key (catalog already declares them); apply the
    conservative upload throttle to `POST /admin/media` (Q3).
  - **Verify:** `route-permissions.spec` green (no undeclared protected route); 401 without token, 403 on
    permission violation, 429 past the upload throttle.
- [ ] T9 — Swagger + contract export (doc 10 §1)
  - Exhaustive `@nestjs/swagger` + class-validator decorators + realistic examples on every new DTO/entity
    (incl. the descriptor with **nullable `alt`**, `variants[]`, and the upload **201 / 200** (200 carries `meta.deduplicated`)
    responses; the **admin** variant shape carries `overBudget`, the **public** descriptor omits it);
    `contract:export` emits valid OpenAPI **without a DB**; re-export `openapi.json`.
  - **Verify:** `contract:export` green with DB down; OpenAPI models `alt: string|null` and the 201/200
    upload shapes; diff reviewed (additive; no `*Id` removed).
- [ ] T10 — E2e suites + CI (doc 18 §2)
  - Supertest e2e: upload happy path (real image fixture → asset + WebP-q90 master described + renditions),
    **201** new / **200** duplicate (`meta.deduplicated`), 422 (renamed non-image / SVG / bad locale / PDF to
    non-resume), 401/403 authz, **429** past 10/min **and** past 2 concurrent (with `Retry-After`), 409
    delete-in-use, public descriptor present (widest-WebP `url`, `alt` null vs ""), **40 MP** boundary
    accept/reject, object headers on fetch (image immutable `Cache-Control`; PDF `Content-Disposition`).
    One R2 integration test decides whether any checksum config is actually required (owner directive).
    jest-openapi assertions; `NODE_OPTIONS=--experimental-vm-modules` in the e2e job.
  - **Verify:** e2e compiles + passes against `eslammuatamed_test`; unit-tier CI green locally.
- [ ] T11 — Integration verification (coordinator)
  - `migrate deploy` + `db:seed` + full e2e green on the test DB; compensation/orphan check; contract
    re-exported + committed; final `lint`/`typecheck`/`unit` green DB-free.
  - **Verify:** re-run seed is a no-op; all gates green; ready for PR.

## Not in this feature

General document/PDF library (resume-only); media population / real content (M3 content track);
dashboard media UI (web M3); redirects `resolve` + contact + preview (004); throttle audit / backup
workflow / NFR-006 latency smoke (005); per-article generated OG images / OG templates (M4/backlog);
on-the-fly transformation / image-transform CDN (rejected, D23-15); `<NuxtImg>` descriptor consumption
(web M4).
