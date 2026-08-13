import { Inject, Injectable, Optional } from '@nestjs/common';
import { MediaKind, MediaVariantFormat } from '../../generated/prisma/client';
import { InjectPinoLogger } from 'nestjs-pino';
import type { PinoLogger } from 'nestjs-pino';
import {
  PublicMediaImageDescriptor,
  PublicMediaPdfDescriptor,
  PublicMediaVariantDescriptor,
} from './entities/media-descriptor.entity';
import { STORAGE_ADAPTER } from './storage/storage-adapter.interface';
import type { StorageAdapter } from './storage/storage-adapter.interface';

// Structural inputs (decoupled from the exact Prisma include). The IMAGE input deliberately has NO
// master `storageKey` — the resolver cannot accidentally emit the master as a public URL. The alt is
// resolved by the caller's `?locale=`.
export interface DescriptorVariantInput {
  readonly format: MediaVariantFormat;
  readonly width: number;
  readonly height: number;
  readonly storageKey: string;
}
export interface DescriptorImageInput {
  readonly id: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly blurhash: string | null;
  readonly variants: readonly DescriptorVariantInput[];
  readonly alts: readonly { readonly locale: string; readonly alt: string }[];
}
export interface DescriptorPdfInput {
  readonly id: string;
  readonly storageKey: string;
  readonly originalFilename: string;
  readonly sizeBytes: number;
}

// Maps already-loaded media data to the PUBLIC descriptor contract (doc 10 §6). Pure per call — it
// NEVER queries Prisma, so a list mapper can call it per row without an N+1. Reusable across
// projects/articles/testimonials/settings (and a future page-SEO read). Exported from MediaModule.
@Injectable()
export class MediaDescriptorResolver {
  constructor(
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
    // Injected in the app (global LoggerModule); optional so `new MediaDescriptorResolver(storage)`
    // in unit tests needs no stub. Used only on the (should-never-happen) invariant-violation path.
    @Optional()
    @InjectPinoLogger(MediaDescriptorResolver.name)
    private readonly logger?: PinoLogger,
  ) {}

  // Image descriptor: primary `url` is the widest PUBLIC WebP rendition — NEVER an AVIF or the master
  // (doc 07 §6, doc 10 §6). `alt` is the requested locale's alt, or null when that translation is
  // absent (no fallback, "" kept). Width/height/WebP are hard invariants for an IMAGE asset (doc 09
  // CHECK + T5): a violation is an internal data bug → a controlled 500, never a faked value or an
  // AVIF URL.
  //
  // D10-14: `url`, `width` and `height` describe ONE file — the rendition `url` points at. They are
  // deliberately NOT the master's dimensions. The two disagreed before: a 1086px source resolved to a
  // 640×853 rendition URL carrying `width: 1086`, so a client building the natural candidate
  // (`${url} ${width}w`) advertised a 640px file as 1086w — inventing the falsely-labelled source the
  // contract exists to prevent. The master's own dimensions stay private with the master.
  /**
   * @param altOverride PER-USAGE alt owned by the consuming relation (D09-22).
   *
   * ALT PRECEDENCE, normative for every future consumer: `MediaAssetAlt` is asset-level DEFAULT
   * metadata for the media library; a consuming relation that defines its own localized alt owns
   * the published accessibility text for THAT usage and WINS. One asset reused in two places can
   * legitimately need two different descriptions, so a single global alt cannot be the universal
   * meaning of the asset.
   *
   * `undefined` means "this usage defines no alt of its own" — fall back to the asset default.
   * `null` means "this usage explicitly has no alt" and does NOT fall back, because falling back
   * would silently publish a library default the owner never reviewed for this context.
   */
  resolveImage(
    asset: DescriptorImageInput,
    locale: string,
    altOverride?: string | null,
  ): PublicMediaImageDescriptor {
    // Invariants first — fail fast before any URL is built, so an AVIF-only or dimensionless asset
    // can never surface a partial descriptor. The master dimensions are still checked (a
    // dimensionless row is a corrupt asset) even though they are no longer what is returned.
    if (asset.width === null || asset.height === null) {
      this.failInvariant(asset.id, 'image is missing width/height');
    }
    const primary = this.widestWebp(asset.id, asset.variants);
    const primaryUrl = this.storage.publicUrl(primary.storageKey);

    const variants: PublicMediaVariantDescriptor[] = [...asset.variants]
      .sort((a, b) => a.width - b.width || a.format.localeCompare(b.format))
      .map((variant) => ({
        format: variant.format,
        width: variant.width,
        height: variant.height,
        url: this.storage.publicUrl(variant.storageKey),
      }));

    const altRow = asset.alts.find((row) => row.locale === locale);
    const alt =
      altOverride === undefined ? (altRow ? altRow.alt : null) : altOverride;

    return {
      id: asset.id,
      kind: MediaKind.IMAGE,
      url: primaryUrl,
      width: primary.width,
      height: primary.height,
      blurhash: asset.blurhash,
      alt,
      variants,
    };
  }

  resolvePdf(asset: DescriptorPdfInput): PublicMediaPdfDescriptor {
    return {
      id: asset.id,
      kind: MediaKind.PDF,
      url: this.storage.publicUrl(asset.storageKey),
      filename: asset.originalFilename,
      sizeBytes: asset.sizeBytes,
    };
  }

  // The widest WebP rendition — no fallback to AVIF or the master. Every IMAGE asset has ≥ 1 WebP
  // rendition (T5); its absence is an internal invariant violation, not a client error. Returns the
  // whole variant, not just its key: D10-14 needs its width/height for the top-level descriptor, and
  // sourcing all three from one object is what makes them self-consistent by construction.
  private widestWebp(
    assetId: string,
    variants: readonly DescriptorVariantInput[],
  ): DescriptorVariantInput {
    const webp = variants.filter(
      (variant) => variant.format === MediaVariantFormat.WEBP,
    );

    let widest = webp[0];
    if (!widest) {
      this.failInvariant(assetId, 'image has no WebP rendition');
    }
    for (const variant of webp) {
      if (variant.width > widest.width) {
        widest = variant;
      }
    }
    return widest;
  }

  // Controlled internal error for a violated image descriptor invariant. Emits a structured event
  // for ops (asset id + reason — never storage keys) and throws a plain Error, which
  // AllExceptionsFilter renders as a generic 500 with no internals leaked (the project's controlled
  // internal-error pattern). `never` return narrows the caller past the guard.
  private failInvariant(assetId: string, reason: string): never {
    this.logger?.error(
      { event: 'media.descriptor_invariant_violation', assetId, reason },
      'Public image descriptor invariant violated',
    );
    throw new Error(
      `Public image descriptor invariant violated for asset ${assetId}: ${reason}`,
    );
  }
}
