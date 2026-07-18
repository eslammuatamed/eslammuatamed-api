// Deterministic, storage-agnostic outputs of the media processing pipeline (T5). The service
// returns buffers + metadata only; generating storage keys, computing the content hash, persisting
// rows, and uploading objects are the orchestration layer's job (T6). `kind` mirrors the Prisma
// `MediaKind` string values so T6 persists it without a mapping, but this module never imports the
// Prisma client — processing stays independent of persistence.

export type ImageVariantFormat = 'webp' | 'avif';

// One delivered rendition (a future MediaAssetVariant row). Carries everything T6 needs to persist
// the row and, for an over-budget rendition, emit the doc 20 §4 structured log event (width, format,
// bytes) — T5 deliberately does not log; it returns the facts.
export interface ProcessedImageVariant {
  readonly format: ImageVariantFormat;
  readonly mimeType: string;
  readonly buffer: Buffer;
  readonly width: number;
  readonly height: number;
  readonly sizeBytes: number;
  /** Final encoder quality the ladder settled on (doc 20 §4). */
  readonly quality: number;
  /** Still over its width×format budget at the quality floor (D20-6); delivery-non-blocking. */
  readonly overBudget: boolean;
}

// The sanitized canonical master (a future MediaAsset row for an IMAGE). WebP q90, full
// auto-oriented dimensions, never upscaled — retained for regeneration, never delivered directly.
export interface ProcessedImageMaster {
  readonly buffer: Buffer;
  readonly mimeType: 'image/webp';
  readonly width: number;
  readonly height: number;
  readonly sizeBytes: number;
  readonly quality: number;
}

export interface ProcessedImage {
  readonly kind: 'IMAGE';
  readonly master: ProcessedImageMaster;
  readonly variants: readonly ProcessedImageVariant[];
  /** LQIP sampled from the sanitized master (never the raw upload). */
  readonly blurhash: string;
}

// A validated resume PDF (a future MediaAsset row for a PDF). Stored as-is — never Sharp-processed,
// no variants, no blurhash. `originalFilename` is already sanitized for display/search + the
// download header T6 writes as object metadata (doc 19 §5).
export interface ProcessedPdf {
  readonly kind: 'PDF';
  readonly buffer: Buffer;
  readonly mimeType: 'application/pdf';
  readonly sizeBytes: number;
  readonly originalFilename: string;
}

export type ProcessedMedia = ProcessedImage | ProcessedPdf;
