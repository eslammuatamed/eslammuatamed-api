import { ImageVariantFormat } from './media-processing.types';

// ── Type allowlists (doc 19 §5, D19-6/9) ────────────────────────────────────────────────────────
// Raster images only; GIF dropped, SVG forbidden (SVG is script-capable and has no magic bytes, so
// `file-type` returns undefined for it → it fails this allowlist). PDF is the single non-image kind
// and only ever attaches to the resume slot (a T6 concern).
export const ALLOWED_IMAGE_MIME_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
];

export const PDF_MIME_TYPE = 'application/pdf';

// ── Decode & size limits (doc 19 §5, D19-9) ─────────────────────────────────────────────────────
// Explicit 40 MP decoded-pixel ceiling — Sharp's own default is far higher — as a decompression-bomb
// guard. Exactly 40,000,000 px is accepted; anything greater is rejected before processing.
export const MAX_INPUT_PIXELS = 40_000_000;

// 10 MiB multipart upload cap (binary MiB, distinct from the decimal-KB rendition budgets below),
// enforced here for the PDF path as defence in depth alongside the controller's Multer limit (T8).
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// ── Master encoding (doc 07 §6, doc 20 §4) ──────────────────────────────────────────────────────
// The raw upload is never persisted: Sharp produces one sanitized canonical master in WebP q90 at
// the full auto-oriented dimensions, retained only for future rendition regeneration.
export const MASTER_QUALITY = 90;

// ── Rendition widths (doc 20 §4, D20-6) ─────────────────────────────────────────────────────────
// Delivered widths, never upscaled. A source narrower than the smallest width yields a single
// rendition at its own width (see the service), so every image has at least one rendition.
export const RENDITION_WIDTHS: readonly number[] = [640, 1280, 1920];

// ── Per-width×format byte budgets (doc 20 §4 table, D20-6) ──────────────────────────────────────
// "KB" in the doc is decimal (1000 B) — written distinctly from the binary "MiB" upload cap, so the
// unit is intentional. Budgets are keyed to the rendition-width tier (a sub-640 rendition uses the
// 640 tier — the smallest — since a smaller image is expected to sit comfortably under it).
export const RENDITION_BUDGETS: Readonly<
  Record<number, Readonly<Record<ImageVariantFormat, number>>>
> = {
  640: { webp: 90_000, avif: 60_000 },
  1280: { webp: 150_000, avif: 100_000 },
  1920: { webp: 200_000, avif: 140_000 },
};

// ── Quality ladder (doc 20 §4, D20-6) ───────────────────────────────────────────────────────────
// Per codec: start quality, floor, and the shared step. The stepping rule itself lives in
// `encodeWithinBudget` (media-processing.util): nextQuality = max(floor, current − step).
export const QUALITY_LADDER: Readonly<
  Record<ImageVariantFormat, { readonly start: number; readonly floor: number }>
> = {
  webp: { start: 78, floor: 55 },
  avif: { start: 55, floor: 40 },
};

export const QUALITY_STEP = 8;

export const IMAGE_FORMAT_MIME: Readonly<Record<ImageVariantFormat, string>> = {
  webp: 'image/webp',
  avif: 'image/avif',
};

// The two delivered codecs, generated for every selected width (doc 20 §4).
export const DELIVERED_FORMATS: readonly ImageVariantFormat[] = [
  'webp',
  'avif',
];

// ── BlurHash (doc 09, doc 20 §4) ────────────────────────────────────────────────────────────────
// Sampled from a tiny decode of the sanitized master (not the raw upload). 4×3 components is the
// conventional LQIP balance for landscape-leaning imagery.
export const BLURHASH_COMPONENTS_X = 4;
export const BLURHASH_COMPONENTS_Y = 3;
export const BLURHASH_SAMPLE_SIZE = 32;
