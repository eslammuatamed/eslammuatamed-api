import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { encode as encodeBlurhash } from 'blurhash';
import { loadEsm } from 'load-esm';
import sharp from 'sharp';
import {
  BLURHASH_COMPONENTS_X,
  BLURHASH_COMPONENTS_Y,
  BLURHASH_SAMPLE_SIZE,
  DELIVERED_FORMATS,
  IMAGE_FORMAT_MIME,
  IMAGE_TYPE_RULES,
  MASTER_QUALITY,
  MAX_INPUT_PIXELS,
  MAX_UPLOAD_BYTES,
  PDF_MIME_TYPE,
  QUALITY_LADDER,
  QUALITY_STEP,
  budgetTierFor,
  RENDITION_BUDGETS,
  RENDITION_WIDTHS,
} from './media-processing.constants';
import {
  ImageVariantFormat,
  ProcessedImage,
  ProcessedImageVariant,
  ProcessedPdf,
  ProcessImageInput,
  ProcessPdfInput,
} from './media-processing.types';
import {
  encodeWithinBudget,
  fileExtension,
  hasPdfStructure,
  sanitizeFilename,
} from './media-processing.util';

// `file-type@22` is pure ESM; this project compiles to CommonJS under `module: nodenext`, so a
// static `import 'file-type'` would not compile. `load-esm` (a declared direct dependency) is a tiny
// precompiled CJS wrapper whose `import()` TypeScript never downlevels — the same mechanism
// `@nestjs/common`'s own file-type validator uses (principle 16). The import is cached so it is paid
// once per process. Jest exercises this path with `NODE_OPTIONS=--experimental-vm-modules` (doc 18).
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

// One rendition target: the output width plus the budget-table tier it is measured against. An
// off-tier width (a sub-640 source rendition, or a D20-20 terminal rendition) borrows the smallest
// configured tier ≥ its own width — see `budgetTierFor`.
interface RenditionTarget {
  readonly width: number;
  readonly budgetKey: number;
}

// Pure media processing: untrusted bytes → sanitized, delivery-ready outputs. Deliberately
// independent of controllers, Prisma, and storage — it takes buffers + client hints and returns
// buffers + metadata, so `MediaService` owns hashing, key generation, persistence,
// uploads, and logging. It never persists or returns the raw upload (D07-6): everything derives from
// the sanitized master.
@Injectable()
export class MediaProcessingService {
  // Lightweight IMAGE identity validation (doc 19 §5): magic-byte sniff + extension/declared-MIME
  // consistency, with NO Sharp decode and no object writes. Exposed so the orchestration layer can
  // validate every upload — including a potential duplicate — before the dedup lookup, so a forged
  // filename/MIME can never bypass validation via the dedup fast path. Rejections are 422.
  async validateImageInput(input: ProcessImageInput): Promise<void> {
    const detected = await this.sniffMimeType(input.buffer);
    this.assertImageTypeConsistent(
      detected,
      input.originalFilename,
      input.declaredMimeType,
    );
  }

  // IMAGE path (doc 07 §6, doc 19 §5, doc 20 §4). Rejections are UnprocessableEntity (→ 422) — a
  // transport-agnostic signal the controller maps without this service touching request/response objects.
  async processImage(input: ProcessImageInput): Promise<ProcessedImage> {
    await this.validateImageInput(input);
    await this.assertWithinPixelCeiling(input.buffer);

    // Master: auto-orient from EXIF (`rotate()` with no args), strip all metadata (not calling
    // `withMetadata`), re-encode WebP q90 at the full — never upscaled — dimensions (doc 07 §6).
    const master = await sharp(input.buffer, {
      limitInputPixels: MAX_INPUT_PIXELS,
    })
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

  // Lightweight PDF identity validation (doc 19 §5, D19-9): extension + declared MIME + magic bytes
  // + 10 MiB size + %PDF-/%%EOF integrity, with NO Sharp and no object writes. Exposed for the same
  // reason as validateImageInput — every upload is validated before the dedup lookup. Rejections are 422.
  async validatePdfInput(input: ProcessPdfInput): Promise<void> {
    // Validate the ORIGINAL extension before sanitization could hide a rename (doc 19 §5).
    if (fileExtension(input.originalFilename) !== 'pdf') {
      throw new UnprocessableEntityException('The resume must be a .pdf file.');
    }
    if (this.normalizeMime(input.declaredMimeType) !== PDF_MIME_TYPE) {
      throw new UnprocessableEntityException(
        'The resume must be declared as application/pdf.',
      );
    }

    // Magic bytes are authoritative — a renamed/mis-declared file is caught here regardless.
    const detected = await this.sniffMimeType(input.buffer);
    if (detected !== PDF_MIME_TYPE) {
      throw new UnprocessableEntityException(
        `Unsupported resume content: ${detected ?? 'unrecognized'}. Expected application/pdf.`,
      );
    }

    if (input.buffer.length > MAX_UPLOAD_BYTES) {
      throw new UnprocessableEntityException(
        'The resume PDF exceeds the 10 MiB upload limit.',
      );
    }

    if (!hasPdfStructure(input.buffer)) {
      throw new UnprocessableEntityException(
        'The resume PDF is malformed or truncated.',
      );
    }
  }

  // PDF path (doc 19 §5, D19-9): the single non-image asset, resume-only. Validated but never
  // Sharp-processed and never given variants/blurhash. Which asset may occupy the resume slot is
  // `SettingsService`'s rule, not this service's.
  async processPdf(input: ProcessPdfInput): Promise<ProcessedPdf> {
    await this.validatePdfInput(input);
    return {
      kind: 'PDF',
      buffer: input.buffer,
      mimeType: PDF_MIME_TYPE,
      sizeBytes: input.buffer.length,
      originalFilename: sanitizeFilename(input.originalFilename),
    };
  }

  // Magic bytes are authoritative (doc 19 §5): the detected type must be an approved image, and the
  // client-supplied extension AND declared MIME must both agree with it. A rename (bytes vs
  // extension) or a spoofed Content-Type (bytes vs declared MIME) is a 422. The detected MIME is a
  // controlled `file-type` value; the untrusted extension/declared string is never echoed back.
  private assertImageTypeConsistent(
    detected: string | null,
    originalFilename: string,
    declaredMimeType: string,
  ): void {
    if (!detected) {
      throw new UnprocessableEntityException(
        'Unsupported image type: unrecognized. Allowed: JPEG, PNG, WebP, AVIF.',
      );
    }
    const rule = IMAGE_TYPE_RULES.find((r) => r.detectedMime === detected);
    if (!rule) {
      throw new UnprocessableEntityException(
        `Unsupported image type: ${detected}. Allowed: JPEG, PNG, WebP, AVIF.`,
      );
    }
    if (!rule.extensions.includes(fileExtension(originalFilename))) {
      throw new UnprocessableEntityException(
        `The file extension does not match the detected image content (${detected}).`,
      );
    }
    if (this.normalizeMime(declaredMimeType) !== rule.declaredMime) {
      throw new UnprocessableEntityException(
        `The declared content type does not match the detected image content (${detected}).`,
      );
    }
  }

  // Magic-byte sniff — the real type, never the extension or client Content-Type (doc 19 §5).
  private async sniffMimeType(input: Buffer): Promise<string | null> {
    const fileType = await loadFileType();
    const detected = await fileType.fileTypeFromBuffer(input);
    return detected?.mime ?? null;
  }

  // Reduce a declared Content-Type to a bare, comparable form (drop parameters, trim, lowercase).
  private normalizeMime(mime: string): string {
    return mime.split(';')[0]?.trim().toLowerCase() ?? '';
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

  // Doc 20 §4: the configured {640,1280,1920} widths ≤ the master width, plus the D20-20 source-bound
  // terminal rendition when the source falls STRICTLY between two configured tiers. Never upscales.
  //
  // The configured tiers are round numbers; real sources are not. Without the terminal rendition a
  // 1086px source delivered only 640px, discarding 446px of real detail and leaving every 2×/3× slot
  // to upscale. Binding the extra rendition to the source width keeps it truthful by construction: it
  // is the largest rendition that can exist without enlarging.
  //
  // The two exclusions are deliberate. A source EQUAL to a tier is already covered — adding it again
  // would duplicate a width. A source ABOVE the largest tier gets nothing extra: 1920 is a delivery
  // ceiling, and emitting a full-source rendition there would trade a bounded payload for unbounded
  // bytes. So the terminal rendition only ever fills a gap BELOW the ceiling.
  private planRenditions(masterWidth: number): RenditionTarget[] {
    const tiers = RENDITION_WIDTHS.filter((width) => width <= masterWidth);
    if (tiers.length === 0) {
      // Source narrower than the smallest tier: one rendition at its own width, so every image has ≥ 1.
      return [{ width: masterWidth, budgetKey: budgetTierFor(masterWidth) }];
    }

    const widths = [...tiers];
    const largestTier = RENDITION_WIDTHS[RENDITION_WIDTHS.length - 1] ?? 0;
    const widestPlanned = tiers[tiers.length - 1] ?? 0;
    // `masterWidth > widestPlanned` means it is not equal to any tier; `< largestTier` keeps it under
    // the ceiling. Together: strictly between two configured tiers.
    if (masterWidth > widestPlanned && masterWidth < largestTier) {
      widths.push(masterWidth);
    }

    return widths.map((width) => ({ width, budgetKey: budgetTierFor(width) }));
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
