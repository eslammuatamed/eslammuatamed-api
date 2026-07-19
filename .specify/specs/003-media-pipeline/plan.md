# Plan 003 — Media Pipeline (API)

**Status:** 🚧 In progress — approved & underway (Q1–Q4 resolved 2026-07-18). Doc-first committed (docs PR #2); **T1–T8 complete** (deps `e828ebd`, schema `55d8f90`, storage `56be678`, processing `5ee7344`, media module `31f9b25`, public descriptors `989f3e7`, permission wiring + upload throttle `7c8d3e4`; T1–T7 SHAs are pre-rebase). **Next task: T9** (Swagger + contract export). API branch local/unpushed. Note: page-SEO descriptor deferred (no public SEO endpoint exists — separate task); résumé exposed via `GET /settings/site` (descriptor only).

Architecture is already decided in the governing docs — this plan **binds** them to the feature.
Unlike Feature 002 (module build-out on an existing schema, no new deps), Feature 003 is a
**new subsystem**: a storage abstraction, an image/PDF processing pipeline, a new module, a
schema reconciliation, and the first **new runtime dependencies** since M1. Every choice below is
bound from the amended docs, not re-decided here.

## Bindings (decision IDs are law)

- **Layering & modules:** doc 07 §1–2 (D07-1/2) — thin controllers, services own logic,
  `PrismaService` direct (no repository layer). Module-local and detachable (`src/modules/media`);
  cross-module access via exported services only; storage SDK never touched by business code.
- **Storage:** doc 07 §6 (D07-4) — `StorageAdapter` interface is the DI seam; local FS (dev/tests)
  / R2 S3-compatible (prod, D23-3/15). Randomized immutable keys; public URLs on the media origin
  (doc 19 §5, doc 23 §1).
- **Schema:** doc 09 (D09-11/12/13) — `MediaAsset` reconciled + `MediaAssetVariant` +
  `MediaKind`/`MediaVariantFormat`, **one additive migration** (empty tables, no backfill).
  Fix-forward (doc 09 §6).
- **Processing:** doc 20 §4 (D20-6) widths 640/1280/1920 × WebP+AVIF, never upscale; doc 19 §5
  (D19-6/9) magic-byte sniff, decoded-pixel ceiling, metadata strip, GIF-out / SVG-forbidden,
  PDF-resume-only.
- **Contract:** doc 10 (D10-1…6, D10-10) — `{data, meta}` envelope, RFC 7807, `?locale=` resolution
  (public) vs full map (admin), **additive** media descriptors (IDs retained), no N+1.
- **Authorization:** doc 19 §3 (D19-8) — `@RequirePermission` + `PermissionsGuard`; the `media.*`
  keys already exist; every new route declares one; conservative upload throttle (doc 19 §6).
- **Reliability:** doc 07 §6 (D07-6) — objects-before-row + compensation on failure; no orphans.
- **Testing:** doc 18 §2 — Jest unit (Prisma + StorageAdapter mocked) + supertest e2e with
  `jest-openapi` contract assertions; magic-byte tests run with `NODE_OPTIONS=--experimental-vm-modules`.

## Decision — StorageAdapter and R2 client (official docs, principle 16)

One `StorageAdapter` interface (`put`/`delete`/`url` over a key + buffer + object metadata: content-type,
`Cache-Control: public, max-age=31536000, immutable` for images, and `Content-Disposition: attachment`
for the resume PDF — all set at write time since R2 delivers directly, D23-15), two
implementations: `LocalStorageAdapter` (dev/tests, writes `STORAGE_LOCAL_DIR`, served at the `/media`
path) and `S3StorageAdapter` (prod, `@aws-sdk/client-s3`, `region: 'auto'`, `endpoint`/`bucket`/
credentials from env; `PutObjectCommand`/`DeleteObjectCommand`). Selected by `STORAGE_DRIVER` in a
provider factory. The R2 client follows the **current official** `@aws-sdk/client-s3` / Cloudflare R2
docs; **no speculative checksum or compatibility workaround is added without an integration test
proving it is required** (owner directive — the restoration review flagged a possible R2 `NotImplemented`
checksum issue; it is verified empirically, not pre-worked-around).

## Decision — variant representation (explicit table, owner directive)

The owner chose an **explicit `MediaAssetVariant` table** (D09-11) over the convention-derived keys
proposed in the restoration review. Each rendition's real `width`/`height`/`sizeBytes`/`storageKey`
is a row, so the API lists only the variants that actually exist (a smaller source produces fewer
rows — no upscaling), and the frontend composes nothing. Recorded rejected alternative: convention-
derived keys / a JSON manifest column — cleaner schema but no queryable per-rendition truth.

## Decision — image master, renditions & budgets (resolved Q2 + master rule)

The raw upload is **never persisted**. `sharp` produces a sanitized **canonical master** — full
auto-oriented dimensions (≤ the **40,000,000 px** `limitInputPixels` ceiling, set explicitly; never
upscaled), **WebP quality 90**, all metadata stripped — and `MediaAsset` (`storageKey`/`mimeType`
`image/webp`/`sizeBytes`/`width`/`height`/`blurhash`) describes **that master**, kept for regeneration.
Delivered **renditions** are `{640,1280,1920} ≤ masterWidth` (or `{masterWidth}` when the master is
< 640 px, so every image has ≥ 1) × WebP+AVIF, each a `MediaAssetVariant`. Per-rendition byte budgets
are **by width × format** (doc 20 §4 table); the encoder starts WebP q78 / AVIF q55 and steps down by
**`nextQuality = max(minQuality, currentQuality − 8)`** (floors WebP q55 / AVIF q40), keeping a rendition
still over at the floor rather than failing the upload and recording **`overBudget`** as a persisted
`MediaAssetVariant` boolean **and** a structured pino log event (searchable, not a free-text message). The descriptor's primary `url` is the **widest WebP rendition**,
never the master. Deterministic and testable (fixture-driven).

## Decision — processing concurrency & throttle (resolved Q3)

`POST /admin/media` is rate-limited to **10/min keyed by authenticated user + IP** and, because Sharp
is memory-heavy and a rate cap alone can't stop a burst, bounded to **at most 2 uploads processing
concurrently per API instance** via an in-process concurrency limiter (a simple semaphore/`p-limit`-style
guard, no new queue infrastructure). A third in-flight upload fails fast with **429 + `Retry-After`**.

## Decision — magic-byte validation via the framework (principle 16)

Content sniffing uses NestJS's `ParseFilePipe` file-type validator — which reads the buffer's magic
number by default (since `@nestjs/common` 11.0.20, loading `file-type` via `load-esm` internally) —
**not** a hand-rolled `file-type` import. This satisfies D19-6 without the pure-ESM/CommonJS friction
of importing `file-type` directly in this `nodenext`/CommonJS build. Any sniffing outside the pipe
(e.g. PDF structural integrity) uses `load-esm` the same way. Multer uses **memoryStorage** so the
buffer feeds both the validator and Sharp. Two size layers: Multer `limits.fileSize` + a
`MaxFileSizeValidator` (10 MiB). Jest that exercises the validator runs with
`NODE_OPTIONS=--experimental-vm-modules`.

## Decision — dedupe (contentHash), resolved Q1

SHA-256 of the **original uploaded bytes**, **unique** (D09-13). A new upload returns **201**; a
byte-identical duplicate returns **200** + the existing asset with **`meta: { deduplicated: true }`**
(envelope-consistent, D10-3). The concurrent
duplicate race is arbitrated by the DB unique constraint — on the losing insert the request **deletes
every object it uploaded**, fetches the winner, and returns it (no orphans). Hashing the original input
(not the sanitized master) is what makes exact re-uploads dedupe even though only the master is stored. On
the fast path the hash is checked **before** Sharp runs (a duplicate pays no processing); the unique-constraint
catch is only the race backstop.

## Decision — public descriptors are additive (D10-10)

Existing `*Id` fields stay; a resolved media **descriptor** is added and resolved in the **same**
Prisma query (`include`) — no N+1, non-breaking (`/api/v1` unchanged, D10-1). A small URL builder
composes media-origin absolute URLs from `storageKey` + `PUBLIC_MEDIA_URL`. The web repo consumes
descriptors during M4; this feature ships the contract only.

## New dependencies (doc 16 §4 gate)

Unlike 002 (none), this feature adds runtime deps — each justified, latest stable, first-party or
ecosystem-standard:

- **`sharp`** — the ecosystem-standard image processor (doc 07 §6 / doc 20 §4 mandate it). Native
  prebuilt binary must match the deploy target (see Verification).
- **`@aws-sdk/client-s3`** — official S3 client for the R2 adapter (D07-4 / D23-3).
- **`blurhash`** — the reference LQIP encoder (doc 09 `blurhash`, doc 20 §4).
- **`@types/multer`** (dev) — types for `Express.Multer.File`. `multer` and `file-type` are already
  present transitively; `file-type` is consumed only via the framework validator (no direct import),
  so it needs no direct dependency unless out-of-pipe sniffing is added (then via `load-esm`).

All pass the doc 16 §4 policy (maintained, standard, latest stable); `npm audit` (high+) stays green.

## Module build order

`docs revision (doc-first, staged)` → `dependencies` → `schema + migration` →
`StorageAdapter (local + S3) + config` ∥ `processing service (Sharp image / PDF)` →
`media module (admin endpoints, dedupe, usages, compensation)` →
`public descriptor resolution (existing modules)` → `permission wiring + upload throttle` →
`contract export` → `e2e + CI` → `integration verification`.

## Structure (doc 08 §2)

New `src/modules/media/`: `media.admin.controller.ts`, `media.service.ts`,
`media-processing.service.ts`, `storage/` (`storage-adapter.interface.ts`, `local-storage.adapter.ts`,
`s3-storage.adapter.ts`, provider factory), `dto/`, `entities/` (incl. the shared media-descriptor
entity), `media.module.ts`, unit specs beside sources. Config edits: `src/config/env.validation.ts` +
`app-config.service.ts` + `.env.example` (S3_* conditional on `STORAGE_DRIVER=s3`). Dev static serving
of `STORAGE_LOCAL_DIR` at `/media` (conditional on `STORAGE_DRIVER=local`). Additive descriptor
resolution edits in the existing `projects` / `articles` / `testimonials` / `settings` / `seo` read
paths (read-shape only, no write changes). E2e specs in `test/`. `media.*` keys already in
`src/modules/access-control/permissions.ts`.

## Cross-repo & doc-first sequencing

1. **Docs repo first** — docs 02/07/09/10/19/20/23 (staged on `003-media-pipeline`); the doc-first
   gate (principle 1). Committed before any API code lands; code that outruns it is a defect.
2. **API repo** — dependencies → schema + migration → adapter/processing → module → descriptors →
   contract export.
3. **Contract adoption** — descriptors are additive; the web repo regenerates types and consumes them
   in its own atomic commit during M4 (doc 16 §3), not part of this API feature.

## Verification

Lint + typecheck + unit pass with **no database** (`contract:export` stays DB-free; StorageAdapter +
Prisma mocked). E2e + migrate run against `eslammuatamed_test` with a real image fixture — variant
generation (widths present, no upscaling), `blurhash`, dedupe (same bytes → existing asset), 409
delete-in-use, descriptor present on a public response, and a **query-count assertion** proving no
N+1 — plus compensation/orphan tests for **partial variant failure**, **DB failure after object
upload**, and **duplicate-race cleanup** (none leave an object). Additional targeted tests: 40 MP
decoded-pixel **boundary** (accept =40 MP / reject >40 MP); per-width×format budget + `overBudget`
floor behavior; object metadata (`Content-Type`, immutable `Cache-Control`, PDF `Content-Disposition`);
`alt` **`null` vs `""`** preserved through DTO + OpenAPI; upload **429** past 10/min and past 2 concurrent.
Magic-byte tests run with `NODE_OPTIONS=--experimental-vm-modules`. **Deploy note (doc 23):** `sharp`'s native
binary must match the Ubuntu-24 x64/glibc VPS — the CI build runner must be linux/x64/glibc (or install
`--os=linux --cpu=x64 --libc=glibc`) so the SSH-transferred `node_modules` runs; recorded here though
the deploy-gate itself is Feature 005. Contract re-exported + committed. Both-repo CI stays independent
(D18-3).
