import { Inject, Injectable } from '@nestjs/common';
import { MediaKind, MediaVariantFormat } from '@prisma/client';
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
  ) {}

  // Image descriptor: primary `url` is the widest WebP rendition (never the master, doc 07 §6);
  // `alt` is the requested locale's alt, or null when that translation is absent (no fallback, "" kept).
  resolveImage(
    asset: DescriptorImageInput,
    locale: string,
  ): PublicMediaImageDescriptor {
    const variants: PublicMediaVariantDescriptor[] = [...asset.variants]
      .sort((a, b) => a.width - b.width || a.format.localeCompare(b.format))
      .map((variant) => ({
        format: variant.format,
        width: variant.width,
        height: variant.height,
        url: this.storage.publicUrl(variant.storageKey),
      }));

    const altRow = asset.alts.find((row) => row.locale === locale);

    return {
      id: asset.id,
      kind: MediaKind.IMAGE,
      url: this.storage.publicUrl(this.widestWebpKey(asset.variants)),
      // IMAGE assets always carry dimensions (DB CHECK, doc 09); the ?? 0 is an unreachable guard.
      width: asset.width ?? 0,
      height: asset.height ?? 0,
      blurhash: asset.blurhash,
      alt: altRow ? altRow.alt : null,
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

  // Widest WebP rendition preferred; falls back to the widest rendition of any format if (never, for
  // a valid image) no WebP exists. The master is never a candidate — the input carries no master key.
  private widestWebpKey(variants: readonly DescriptorVariantInput[]): string {
    const webp = variants.filter(
      (variant) => variant.format === MediaVariantFormat.WEBP,
    );
    const pool = webp.length > 0 ? webp : variants;

    let widest = pool[0];
    if (!widest) {
      // Unreachable for a valid image (T5 produces ≥ 1 rendition); never emit the master.
      throw new Error('Image media asset has no renditions.');
    }
    for (const variant of pool) {
      if (variant.width > widest.width) {
        widest = variant;
      }
    }
    return widest.storageKey;
  }
}
