import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { encode as encodeBlurhash } from 'blurhash';
import { loadEsm } from 'load-esm';
import sharp from 'sharp';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  BLURHASH_COMPONENTS_X,
  BLURHASH_COMPONENTS_Y,
  BLURHASH_SAMPLE_SIZE,
  DELIVERED_FORMATS,
  IMAGE_FORMAT_MIME,
  MASTER_QUALITY,
  MAX_INPUT_PIXELS,
  MAX_UPLOAD_BYTES,
  PDF_MIME_TYPE,
  QUALITY_LADDER,
  QUALITY_STEP,
  RENDITION_BUDGETS,
  RENDITION_WIDTHS,
} from './media-processing.constants';
import {
  ImageVariantFormat,
  ProcessedImage,
  ProcessedImageVariant,
  ProcessedPdf,
} from './media-processing.types';
import {
  encodeWithinBudget,
  hasPdfStructure,
  sanitizeFilename,
} from './media-processing.util';

// `file-type@22` is pure ESM; this project compiles to CommonJS under `module: nodenext`, so a
// static `import 'file-type'` would not compile. `load-esm` is a tiny precompiled CJS wrapper whose
// `import()` TypeScript never downlevels — the same mechanism `@nestjs/common`'s own file-type
// validator uses (principle 16). The import is cached so it is paid once per process. Jest exercises
// this path with `NODE_OPTIONS=--experimental-vm-modules` (doc 18).
interface FileTypeResult {
  readonly ext: string;
  readonly mime: string;
}
interface FileTypeModule {
  fileTypeFromBuffer(
    input: Uint8Array | ArrayBuffer,
  ): Promise<FileTypeResult | undefined>;
}

let fileTypeModule: Promise<FileTypeModule> | undefined;
function loadFileType(): Promise<FileTypeModule> {
  fileTypeModule ??= loadEsm<FileTypeModule>('file-type');
  return fileTypeModule;
}

// One rendition target: the output width plus the budget-table tier it is measured against (a
// sub-640 rendition borrows the 640 tier — the smallest).
interface RenditionTarget {
  readonly width: number;
  readonly budgetKey: number;
}

// Pure media processing (T5): untrusted bytes → sanitized, delivery-ready outputs. Deliberately
// independent of controllers, Prisma, and storage — it takes buffers and returns buffers + metadata,
// so the orchestration layer (T6) owns hashing, key generation, persistence, uploads, and logging.
// It never persists or returns the raw upload (D07-6): everything derives from the sanitized master.
@Injectable()
export class MediaProcessingService {
  // IMAGE path (doc 07 §6, doc 19 §5, doc 20 §4). Rejections are UnprocessableEntity (→ 422) — a
  // transport-agnostic signal the controller maps without T5 touching request/response objects.
  async processImage(input: Buffer): Promise<ProcessedImage> {
    const mime = await this.sniffMimeType(input);
    if (!mime || !ALLOWED_IMAGE_MIME_TYPES.includes(mime)) {
      throw new UnprocessableEntityException(
        `Unsupported image type: ${mime ?? 'unrecognized'}. Allowed: JPEG, PNG, WebP, AVIF.`,
      );
    }

    await this.assertWithinPixelCeiling(input);

    // Master: auto-orient from EXIF (`rotate()` with no args), strip all metadata (not calling
    // `withMetadata`), re-encode WebP q90 at the full — never upscaled — dimensions (doc 07 §6).
    const master = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .webp({ quality: MASTER_QUALITY })
      .toBuffer({ resolveWithObject: true });
    const masterWidth = master.info.width;
    const masterHeight = master.info.height;

    const blurhash = await this.computeBlurhash(master.data);
    const variants = await this.buildRenditions(master.data, masterWidth);

    return {
      kind: 'IMAGE',
      master: {
        buffer: master.data,
        mimeType: 'image/webp',
        width: masterWidth,
        height: masterHeight,
        sizeBytes: master.data.length,
        quality: MASTER_QUALITY,
      },
      variants,
      blurhash,
    };
  }

  // PDF path (doc 19 §5, D19-9): the single non-image asset, resume-only. Validated but never
  // Sharp-processed and never given variants/blurhash. Attaching it to the resume slot is a T6 rule.
  async processPdf(
    input: Buffer,
    originalFilename: string,
  ): Promise<ProcessedPdf> {
    if (!/\.pdf$/i.test(originalFilename.trim())) {
      throw new UnprocessableEntityException('The resume must be a .pdf file.');
    }

    const mime = await this.sniffMimeType(input);
    if (mime !== PDF_MIME_TYPE) {
      throw new UnprocessableEntityException(
        `Unsupported resume type: ${mime ?? 'unrecognized'}. Expected application/pdf.`,
      );
    }

    if (input.length > MAX_UPLOAD_BYTES) {
      throw new UnprocessableEntityException(
        'The resume PDF exceeds the 10 MiB upload limit.',
      );
    }

    if (!hasPdfStructure(input)) {
      throw new UnprocessableEntityException(
        'The resume PDF is malformed or truncated.',
      );
    }

    return {
      kind: 'PDF',
      buffer: input,
      mimeType: PDF_MIME_TYPE,
      sizeBytes: input.length,
      originalFilename: sanitizeFilename(originalFilename),
    };
  }

  // Magic-byte sniff — the real type, never the extension or client Content-Type (doc 19 §5).
  private async sniffMimeType(input: Buffer): Promise<string | null> {
    const fileType = await loadFileType();
    const detected = await fileType.fileTypeFromBuffer(input);
    return detected?.mime ?? null;
  }

  // Explicit 40 MP ceiling (D19-9): reject before any processing. The header is read WITHOUT
  // `limitInputPixels` (metadata only parses the header — no pixels are allocated even for a
  // decompression bomb), so the explicit pixel-count check below produces a clean 422 instead of
  // Sharp's raw decode error. The actual processing pipeline still sets `limitInputPixels`
  // explicitly as defence in depth. Pixel count is orientation-invariant, so pre-orient dimensions
  // are correct here.
  private async assertWithinPixelCeiling(input: Buffer): Promise<void> {
    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(input).metadata();
    } catch {
      throw new UnprocessableEntityException(
        'Image dimensions could not be read.',
      );
    }
    const pixels = (metadata.width ?? 0) * (metadata.height ?? 0);
    if (pixels === 0) {
      throw new UnprocessableEntityException(
        'Image dimensions could not be read.',
      );
    }
    if (pixels > MAX_INPUT_PIXELS) {
      throw new UnprocessableEntityException(
        'Image exceeds the 40,000,000px decoded-pixel ceiling.',
      );
    }
  }

  // BlurHash LQIP from a tiny decode of the sanitized master (never the raw upload).
  private async computeBlurhash(masterBuffer: Buffer): Promise<string> {
    const { data, info } = await sharp(masterBuffer)
      .raw()
      .ensureAlpha()
      .resize(BLURHASH_SAMPLE_SIZE, BLURHASH_SAMPLE_SIZE, { fit: 'inside' })
      .toBuffer({ resolveWithObject: true });
    return encodeBlurhash(
      new Uint8ClampedArray(data),
      info.width,
      info.height,
      BLURHASH_COMPONENTS_X,
      BLURHASH_COMPONENTS_Y,
    );
  }

  private async buildRenditions(
    masterBuffer: Buffer,
    masterWidth: number,
  ): Promise<ProcessedImageVariant[]> {
    const variants: ProcessedImageVariant[] = [];
    for (const target of this.planRenditions(masterWidth)) {
      for (const format of DELIVERED_FORMATS) {
        variants.push(await this.buildRendition(masterBuffer, format, target));
      }
    }
    return variants;
  }

  // Doc 20 §4: the {640,1280,1920} widths ≤ the master width; a source narrower than 640 yields one
  // rendition at its own width so every image has ≥ 1. Never upscales.
  private planRenditions(masterWidth: number): RenditionTarget[] {
    const tiers = RENDITION_WIDTHS.filter((width) => width <= masterWidth);
    if (tiers.length === 0) {
      return [{ width: masterWidth, budgetKey: 640 }];
    }
    return tiers.map((width) => ({ width, budgetKey: width }));
  }

  private async buildRendition(
    masterBuffer: Buffer,
    format: ImageVariantFormat,
    target: RenditionTarget,
  ): Promise<ProcessedImageVariant> {
    const { start, floor } = QUALITY_LADDER[format];
    const budgets = RENDITION_BUDGETS[target.budgetKey];
    if (!budgets) {
      // Unreachable: budgetKey is always one of the table's tiers.
      throw new Error(`No budget for rendition width tier ${target.budgetKey}`);
    }

    const encode = (quality: number): Promise<Buffer> => {
      const pipeline = sharp(masterBuffer).resize({
        width: target.width,
        withoutEnlargement: true,
      });
      return format === 'webp'
        ? pipeline.webp({ quality }).toBuffer()
        : pipeline.avif({ quality }).toBuffer();
    };

    const ladder = await encodeWithinBudget(encode, {
      startQuality: start,
      floorQuality: floor,
      step: QUALITY_STEP,
      budgetBytes: budgets[format],
    });

    const rendition = await sharp(ladder.buffer).metadata();
    return {
      format,
      mimeType: IMAGE_FORMAT_MIME[format],
      buffer: ladder.buffer,
      width: rendition.width ?? target.width,
      height: rendition.height ?? 0,
      sizeBytes: ladder.buffer.length,
      quality: ladder.quality,
      overBudget: ladder.overBudget,
    };
  }
}
