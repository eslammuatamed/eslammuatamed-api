import { ImageTypeRule, ImageVariantFormat } from './media-processing.types';

// ── Type allowlist + consistency rules (doc 19 §5, D19-6/9) ─────────────────────────────────────
// Raster images only; GIF dropped, SVG forbidden (SVG is script-capable and has no magic bytes, so
// `file-type` returns undefined for it → no rule matches). Each approved type pins the detected
// magic-byte MIME (authoritative), the declared MIME it must be uploaded as, and the extensions that
// may name it — JPEG deliberately allows both `.jpg` and `.jpeg`. Extension + declared MIME are
// cross-checked against the detected type, so a rename or spoofed Content-Type is rejected.
export const IMAGE_TYPE_RULES: readonly ImageTypeRule[] = [
  {
    detectedMime: 'image/jpeg',
    declaredMime: 'image/jpeg',
    extensions: ['jpg', 'jpeg'],
  },
  { detectedMime: 'image/png', declaredMime: 'image/png', extensions: ['png'] },
  {
    detectedMime: 'image/webp',
    declaredMime: 'image/webp',
    extensions: ['webp'],
  },
  {
    detectedMime: 'image/avif',
    declaredMime: 'image/avif',
    extensions: ['avif'],
  },
];

// PDF is the single non-image kind and only ever attaches to the resume slot (a T6 concern).
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
// Configured delivered widths, never upscaled. A source narrower than the smallest width yields a
// single rendition at its own width, and a source strictly between two of these widths additionally
// yields a terminal rendition at its own width (D20-20) — both live in the service's planner.
export const RENDITION_WIDTHS: readonly number[] = [640, 1280, 1920];

// ── Per-width×format byte budgets (doc 20 §4 table, D20-6) ──────────────────────────────────────
// "KB" in the doc is decimal (1000 B) — written distinctly from the binary "MiB" upload cap, so the
// unit is intentional. Budgets are keyed to the configured rendition-width tiers.
export const RENDITION_BUDGETS: Readonly<
  Record<number, Readonly<Record<ImageVariantFormat, number>>>
> = {
  640: { webp: 90_000, avif: 60_000 },
  1280: { webp: 150_000, avif: 100_000 },
  1920: { webp: 200_000, avif: 140_000 },
};

// The budget tier a rendition is measured against: the SMALLEST configured tier ≥ its own width
// (doc 20 §4, D20-20). One rule covers both off-tier cases. The sub-640 rendition already borrowed
// the 640 row because a smaller image sits comfortably under it; a D20-20 terminal rendition extends
// that upward, so an 1086px rendition is measured against the 1280 row. Borrowing the tier ABOVE the
// width — never below — is what keeps the ceiling honest: measuring 1086px against the 640 row would
// fail renditions that are entirely reasonable for their size. A width above every tier clamps to the
// largest row; the planner never emits one, so this is a total-function guard, not a live path.
export function budgetTierFor(width: number): number {
  const tier = RENDITION_WIDTHS.find((candidate) => candidate >= width);
  return tier ?? RENDITION_WIDTHS[RENDITION_WIDTHS.length - 1] ?? 0;
}

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
