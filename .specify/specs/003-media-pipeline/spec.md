# Feature 003 — Media Pipeline (API)

**Feature Branch:** `003-media-pipeline`
**Milestone:** M2 — API Complete (doc 24 §2). **Status:** 🚧 **In progress** — approved & underway (Q1–Q4 resolved 2026-07-18). Doc-first committed (docs branch `2623b15`, PR #2 open); **T1–T5 complete**, **next task T6**. API branch local/unpushed.
**Governing docs:** 02 §4 (FR-DSH-030–034, D02-7), 07 §6 (D07-6), 08, 09 §3/§4 (D09-11/12/13), 10 §5/§6 (D10-10), 15, 16, 18, 19 §5/§6 (D19-6/D19-9), 20 §4 (D20-6), 23 §1 (D23-15).
**Requirements carried:** FR-DSH-030 (upload + grid + search + per-locale alt), FR-DSH-031 (usage-protected deletion), FR-DSH-032 (validation + processing pipeline), FR-DSH-033 (reusable central library), FR-DSH-034 (SHA-256 duplicate detection), FR-DSH-070 (settings resume file), FR-PUB-023 (resume PDF download), FR-PUB-032 (case-study gallery images), FR-CNT-010/020/060 (cover / gallery / avatar references), FR-DSH-050 (per-entity OG image), NFR-001 (image performance), NFR-005 (strict validation). Owner design approval 2026-07-18 (7-point directive + Q1–Q4 resolutions).

## Problem

Feature 002 shipped the content modules **image-incomplete** (its own recorded exit state): projects, articles, testimonials, settings, and page-SEO all *reference* `MediaAsset`s (cover / gallery / avatar / OG / resume) but there is **no media module** — no upload, no processing, no storage, and no way to turn a `mediaAssetId` into a renderable URL. The `MediaAsset` / `MediaAssetAlt` tables, the `media.{read,create,update,delete}` permission keys, and the `StorageDriver` (`local` / `s3`) config all exist from M1 but are unused; `sharp`, an S3 SDK, `blurhash`, and `@types/multer` are not yet installed. Feature 003 builds the reusable-library pipeline that **populates and serves** media — completing the doc 10 catalog for the M2 gate and unblocking the M4 public site's images and the resume download.

## Scope (what ships)

1. **StorageAdapter (D07-4) — the DI seam.** An interface (`put`/`delete`/`url` over key + buffer + content-type + optional content-disposition) plus two implementations: a **local-filesystem adapter** (dev/tests: writes under `STORAGE_LOCAL_DIR`, served at `PUBLIC_MEDIA_URL` = the API `/media` path in dev) and an **S3-compatible adapter** to Cloudflare R2 in production (`@aws-sdk/client-s3`, `region: 'auto'`, `endpoint`/`bucket`/credentials from env). No business code touches a storage SDK directly. Storage keys are **randomized and immutable**. Every object is written with its `Content-Type`; image objects (master + renditions) carry an immutable `Cache-Control: public, max-age=31536000, immutable`, and the resume PDF adds `Content-Disposition: attachment`. Public URLs are always composed from the configured **media origin**, never the API origin (doc 19 §5).
2. **Image processing (IMAGE kind).** Allowlist **JPEG / PNG / WebP / AVIF** (GIF out of scope, SVG forbidden — D19-6). Pipeline: multipart buffer → **SHA-256 of the original bytes** (the dedup key, D09-13) → magic-byte sniff (framework `ParseFilePipe` validator, principle 16) → **40 MP decoded-pixel ceiling** (`sharp` `limitInputPixels: 40_000_000`, set explicitly) → `sharp` auto-orient + strip all metadata. **The raw upload is never persisted:** `sharp` produces a sanitized **canonical master** (full auto-oriented dimensions ≤ 40 MP, never upscaled; **WebP q90**) that `MediaAsset.storageKey`/`mimeType` (`image/webp`)/`sizeBytes`/`width`/`height` describe, retained for regeneration. From the master, **delivered renditions** are generated at **640 / 1280 / 1920** ≤ the master width (a source below 640 px yields **one** rendition at its own width, so every image has ≥ 1) × **WebP + AVIF**, each a `MediaAssetVariant` (D09-11) meeting its doc 20 §4 width×format budget (quality ladder to a floor; `overBudget` flag if the floor is still over). **blurhash** from the master. The descriptor's primary `url` is the **widest WebP rendition** — never the master.
3. **PDF processing (PDF kind — resume/CV only).** `application/pdf` accepted **only** for the resume slot (D02-7, D19-9); validated by magic bytes + extension + size + basic structural integrity; **not** processed by `sharp`, no variants; `MediaAsset.storageKey`/`mimeType`/`sizeBytes` describe the PDF itself. Its download headers (`Content-Type: application/pdf`, `Content-Disposition: attachment`, sanitized filename) are set as **storage-object metadata at upload** so R2 serves them directly (the API is not in the prod delivery path — D23-15; dev static-serve honors the same). Attaches to `SiteSettings.resumeAssetId`; replacing the resume repoints the FK and **retains** the prior asset until it is explicitly deleted while unreferenced.
4. **Media module — admin endpoints** under `/admin/media` (all guarded by the existing `media.*` permission keys; default-deny, never `@Public()`): `POST /admin/media` (multipart upload, image or resume PDF → **201** new / **200** existing with `meta.deduplicated: true`); `GET /admin/media` (grid: paginated `{data, meta}`, **search over sanitized `originalFilename` + alt text**, `kind` filter, sort whitelist); `GET /admin/media/{id}`; `PATCH /admin/media/{id}` (per-locale alt text on images); `GET /admin/media/{id}/usages` (structured list — **every** FK: article cover, article/project OG, project gallery, testimonial avatar, page-SEO OG, `SiteSettings.resumeAssetId`); `DELETE /admin/media/{id}` (**409 + structured usages** when referenced; hard delete of row + variants + stored objects when unreferenced). `POST /admin/media` throttle: **10/min per authenticated user + IP** and a **2-wide in-process processing limit** (a third in-flight upload → **429 + `Retry-After`**, no queue — doc 19 §6).
5. **Reusable central library + dedupe (D02-7, FR-DSH-033/034).** Upload-once / reference-by-id; content is never re-uploaded per use. A **SHA-256 `contentHash`** of the **original bytes** identifies content (unique); a new upload returns **201**, a byte-identical duplicate returns **200** with the existing asset and **`meta: { deduplicated: true }`** (envelope-consistent, D10-3). A concurrent duplicate race is arbitrated by the DB unique constraint — the losing request **deletes every object it uploaded**, fetches the winning asset, and returns it (no orphans).
6. **Public media descriptors — additive, non-breaking (D10-10).** Public project / article / testimonial / settings / page-SEO responses **keep their existing media IDs** and additively gain a resolved **media descriptor**. Image: `{ id, kind, url, width, height, blurhash, alt, variants[{format,width,height,url}] }` — `url` = the **widest WebP rendition** (not the master); `alt` = **`string | null`** (`null` = no alt row for `?locale=`, no cross-locale fallback per doc 07 §4; `""` = intentionally decorative). PDF: `{ id, kind, url, filename, sizeBytes }`. All `url`s absolute on the media origin. Descriptors resolve in the **same query** as the parent (Prisma `include`) — **no N+1** (doc 20 §7). No `*Id` field is removed → no `/api/v1` break (D10-1).
7. **Schema — clean model, one additive migration (doc 09).** `MediaAsset` gains `kind` (`MediaKind` IMAGE/PDF), `contentHash` (SHA-256 of the original bytes, **unique**), `originalFilename` (sanitized); `width`/`height`/`blurhash` (of the master) become image-only. New `MediaAssetVariant` child (`format` `MediaVariantFormat` WEBP/AVIF, `width`, `height`, `storageKey` unique, `sizeBytes`, `overBudget` Boolean default false; `@@unique([mediaAssetId, format, width])`; `CASCADE` with its asset). `MediaAssetAlt` unchanged (per-locale, images only). Tables are empty → clean model, **no backfill**. New enums `MediaKind`, `MediaVariantFormat`. Fix-forward (doc 09 §6).
8. **Config (doc 23 §1, D23-15).** Add `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` to `env.validation` + `.env.example`, **required only when `STORAGE_DRIVER=s3`** (conditional validation). `STORAGE_DRIVER` is **fail-closed** — only `local`|`s3` (an unknown value is rejected at boot), the provider factory selects the backend via an **exhaustive switch** (no silent fallback), and **production requires `s3`** (local is dev/test only). Dev serves `STORAGE_LOCAL_DIR` at the `/media` path. R2 client follows current official `@aws-sdk/client-s3` / R2 docs (principle 16); **no speculative checksum/compat workaround without a proving integration test** (owner directive).
9. **Reliability & security rails (docs 07 §6, 19 §5/§6).** Objects written **before** the DB row; **compensation on failure** (delete uploaded objects; clean partial variants) — no orphaned rows or objects (D07-6), including the duplicate-race loser. Processing concurrency capped at **2 per instance** (429 + `Retry-After` beyond it, no queue). 10 MiB upload cap (multipart, independent of the 1 MiB JSON limit). Object metadata: `Content-Type` on all, immutable `Cache-Control` on images, `Content-Disposition: attachment` on the resume PDF. Storage internals/credentials never surface in responses or errors.
10. **Contract + quality rails.** Swagger + class-validator decorators with realistic examples on every new DTO/entity; `npm run contract:export` stays DB-free; unit specs (Prisma + StorageAdapter mocked) + e2e per module with `jest-openapi` contract assertions; `route-permissions` metadata present on every new admin route; `openapi.json` re-exported; `npm run lint && npx tsc --noEmit && npm test` green. (Magic-byte-validation tests run with `NODE_OPTIONS=--experimental-vm-modules`, doc 18.)

## Image-master rule (deterministic, testable)

- **Dimensions:** the source's intrinsic pixel dimensions **after `sharp` auto-orient**, never upscaled; the whole pipeline is gated by the 40 MP decoded-pixel ceiling (so the master is ≤ 40 MP).
- **Encoding:** **WebP, quality 90**, all metadata stripped (`image/webp`). This single canonical sanitized format is the regeneration source; lossless/PNG masters were rejected as needlessly large for web-quality regeneration.
- **`MediaAsset` describes the master:** `storageKey` (master object), `mimeType` `image/webp`, `sizeBytes` (master bytes), `width`/`height` (master = source, post-orient), `blurhash` (sampled from the master).
- **Renditions ≠ master:** delivered renditions are `{640,1280,1920} ≤ masterWidth` (or `{masterWidth}` when the master is < 640 px) × {WebP, AVIF}, each a `MediaAssetVariant`. The master is never a rendition and never the descriptor `url`.

## Performance budgets (final; doc 20 §4)

Per **delivered rendition, by width × format** (usage-independent — the browser selects via `sizes`/`srcset`):

| Rendition width | Typical slot                  | WebP ≤ | AVIF ≤ |
| --------------- | ----------------------------- | ------ | ------ |
| 640 px          | mobile / thumbnail            | 90 KB  | 60 KB  |
| 1280 px         | in-content / gallery          | 150 KB | 100 KB |
| 1920 px         | hero / full-bleed / OG source | 200 KB | 140 KB |

Encoder: WebP starts **q78**, AVIF **q55**; the step rule is explicit — **`nextQuality = max(minQuality, currentQuality − 8)`** with floors **WebP q55 / AVIF q40**. If the floor still exceeds budget, the rendition is kept and marked **`overBudget`** — a **persisted boolean on `MediaAssetVariant`** (queryable in the admin surface) **and** a structured pino log event (asset id, storage key, width, format, bytes, budget, floor quality), never only a free-text message; delivery-non-blocking, and **not** in the public descriptor. The WebP-q90 master is exempt (never delivered). These supersede the old flat hero/OG 200 KB & gallery 150 KB caps — the same numbers now sit on the 1920/1280 WebP rows, keyed to width, not usage.

## Model & doc-first changes (doc 01 principle 1) — STAGED, awaiting review

Doc-first gate satisfied ahead of code: docs are **amended and staged** on the `003-media-pipeline` docs branch (uncommitted; roadmap untouched; no handoff/memory file):

- **doc 02 → v1.4.0** — FR-DSH-030–034; §8 non-goal carves out the resume PDF; **D02-7**.
- **doc 07 → v1.1.0** — §6 rewritten (kinds, image-master pipeline, PDF path, StorageAdapter + object metadata, processing concurrency, resume retention); **D07-6**.
- **doc 09 → v1.4.0** — `MediaAsset` reconciled (`kind`/`contentHash` of original bytes/`originalFilename`; master semantics); new `MediaAssetVariant`; enums; **D09-11/12/13**. One additive migration.
- **doc 10 → v1.3.0** — §5 media catalog; §6 descriptor (widest-WebP `url`, `alt` `string|null`), 201/200 dedup + race, usages enumeration; **D10-10**.
- **doc 19 → v1.3.0** — §5 allowlist (GIF dropped, PDF-resume, **40 MP** explicit ceiling, filename sanitization, object-metadata download headers); §6 throttle (10/min user+IP) + 2-wide concurrency; **D19-9**.
- **doc 20 → v1.2.0** — §4 widths 640/1280/1920 × WebP+AVIF from a WebP-q90 master, **per-width×format budget table** + quality ladder + `overBudget`, immutable `Cache-Control`, 40 MP ceiling; **D20-6**.
- **doc 23 → v1.3.0** — §1 R2 storage + direct delivery, `S3_*` env, object metadata, no-speculative-workaround; **D23-15**.
- **Migration** — one additive migration; empty tables, no backfill.

## Acceptance criteria

- [ ] Migration adds `MediaKind`, `MediaVariantFormat`, `MediaAsset.{kind,contentHash(unique),originalFilename}`, and `MediaAssetVariant`; `prisma validate`/`format` clean; `migrate deploy` applies; `contract:export` green with **no DB**.
- [ ] `POST /admin/media` accepts a real JPEG/PNG/WebP/AVIF fixture, sniffs it by magic bytes (renamed non-image + SVG → **422**), never persists the raw upload, stores a **WebP-q90 master**, generates WebP+AVIF renditions at 640/1280/1920 ≤ master width (no upscaling; a <640 px source → one own-width rendition), computes `blurhash`, and returns the asset + variants + a `201`.
- [ ] Uploading the **same bytes twice** returns **200** with the existing asset and **`meta.deduplicated: true`** (no duplicate object/row); the hash is of the **original** bytes.
- [ ] A simulated **concurrent duplicate race** ends with one asset; the losing request leaves **no** orphaned object and returns the winner.
- [ ] Decoded-pixel boundary: an image at exactly **40,000,000 px** is accepted; one above is rejected before processing (explicit `limitInputPixels`, not Sharp's default).
- [ ] Each rendition meets its width×format budget or, at the quality floor (`nextQuality = max(minQuality, currentQuality−8)`), is kept with **`overBudget = true`** persisted on the variant **and** a structured log event; the upload never fails for being over budget.
- [ ] Every image object has `Content-Type` + immutable `Cache-Control`; the resume PDF has `Content-Type: application/pdf` + `Content-Disposition: attachment` (object metadata).
- [ ] A PDF is accepted **only** for the resume slot, not Sharp-processed, and downloadable; a PDF to a non-resume upload is rejected.
- [ ] `GET /admin/media` paginates `{data, meta}`, searches over sanitized `originalFilename` + alt, filters by `kind`; `PATCH` sets per-locale alt (invalid locale → 422); PDFs accept no alt.
- [ ] `GET /admin/media/{id}/usages` lists **every** FK incl `SiteSettings.resumeAssetId`; `DELETE` a referenced asset → **409** with usages; deleting an unreferenced asset removes row + variants + objects.
- [ ] Public responses **retain** `*Id` fields **and** carry a descriptor: image `url` = widest WebP rendition, `alt` distinguishes **`null`** (missing locale) from **`""`** (decorative) in the DTO **and** the OpenAPI schema; a list endpoint returning N assets issues **no** per-asset query (no N+1).
- [ ] Upload throttle: **429** past 10/min (per user+IP) and past 2 concurrent processing uploads, with `Retry-After`.
- [ ] Compensation tests cover **partial variant upload failure**, **DB failure after object upload**, and **duplicate-race cleanup** — none leave an orphan.
- [ ] Every new protected route declares an existing `media.*` key; `route-permissions.spec` passes; 401 without token, 403 on permission violation.
- [ ] e2e green with `jest-openapi` (`NODE_OPTIONS=--experimental-vm-modules`); `openapi.json` re-exported; `npm run lint && npx tsc --noEmit && npm test` green with no database.
- [ ] docs 02/07/09/10/19/20/23 revised (doc-first) with decision-log entries + version bumps, committed before any API code lands.

## Resolved decisions (owner, 2026-07-18)

- **Q1 — dedupe:** hard **unique** SHA-256 of the **original uploaded bytes**; new → **201**, duplicate → **200** + existing asset with **`meta: { deduplicated: true }`** (envelope-consistent, D10-3). Concurrent race: DB unique constraint authoritative; the loser deletes every object it uploaded, fetches and returns the winner, no orphans (D09-13, D10-10).
- **Q2 — decoded-pixel ceiling:** exactly **40,000,000** px; `sharp` `limitInputPixels` set explicitly; boundary accept (=40 MP) and reject (>40 MP) tested (D19-9, D20-6).
- **Q3 — upload throttle:** **10/min** per authenticated user **and** IP, **plus** a max **2 concurrently processing** uploads per API instance; excess → **429 + `Retry-After`**, **no queue** (D19-9).
- **Q4 — missing-locale alt:** descriptor `alt` is always **`string | null`**; no cross-locale fallback; **`null`** = missing translation, **`""`** = intentionally decorative; the distinction is preserved and tested in DTO validation and OpenAPI (D10-10, doc 07 §4).

## Out of scope (owner-confirmed)

- **General document/PDF library** — PDF scoped to the single resume/CV asset only (D02-7).
- **Media population / real content** — pipeline only; content is the M3 track (D24-3).
- **Dashboard media UI** (upload widget, grid, alt editor) — web M3.
- **Redirects `resolve`, contact intake, preview tokens** — Feature 004.
- **API hardening** (full throttle audit, backup workflow, NFR-006 latency smoke) — Feature 005.
- **Per-article generated OG images / OG templates** — M4 / backlog (doc 24 §3).
- **On-the-fly image transformation / image-transform CDN** — rejected (D23-15).
- **`<NuxtImg>` frontend consumption of the descriptors** — web M4; this feature ships the API contract only.

## Revisions

- **2026-07-18 (rev 3 — T4 correction)** — Storage-driver selection hardened to fail closed (T4,
  commit `56be678`): `STORAGE_DRIVER` accepts only `local`|`s3` (unknown → boot failure), the provider
  factory uses an exhaustive switch with no fallback, and production requires `s3` (local rejected).
  Config-validation tests added. No schema or contract change.
- **2026-07-18 (rev 2 — draft)** — Owner resolved Q1–Q4 and added model/perf/metadata clarifications: original-bytes SHA-256 dedupe with 201/200 + race cleanup; 40 MP explicit ceiling; 10/min-per-user+IP throttle + 2-wide concurrency (429/Retry-After, no queue); `alt: string|null` (null vs ""); sanitized **WebP-q90 image master** (raw never persisted) with descriptor `url` = widest WebP rendition; **per-width×format performance budgets** + quality ladder + `overBudget`; object metadata (Content-Type, immutable Cache-Control, PDF Content-Disposition); usages enumerate every FK incl the resume; compensation tests for partial-variant / DB-failure / duplicate-race. Docs 07/09/10/19/20/23 updated in place (versions unchanged — same staged branch). Open questions cleared.
- **2026-07-18 (rev 1 — draft)** — Initial spec for owner review encoding the 7-point approval; doc-first amendments staged; Q1–Q4 carried.
