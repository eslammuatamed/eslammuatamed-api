import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MediaKind, MediaVariantFormat, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { InjectPinoLogger } from 'nestjs-pino';
import type { PinoLogger } from 'nestjs-pino';
import {
  buildPageMeta,
  PaginatedResult,
} from '../../common/pagination/page-meta';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalesService } from '../locales/locales.service';
import { MediaListQueryDto } from './dto/media-list-query.dto';
import { UpdateMediaAltDto } from './dto/update-media-alt.dto';
import {
  AdminMediaAssetEntity,
  AdminMediaVariantEntity,
} from './entities/admin-media-asset.entity';
import { MediaUsageEntity } from './entities/media-usage.entity';
import { IMMUTABLE_CACHE_CONTROL, MEDIA_KEY_ROOT } from './media.constants';
import { MediaInUseException } from './media-in-use.exception';
import {
  PDF_MIME_TYPE,
  RENDITION_BUDGETS,
  RENDITION_WIDTHS,
} from './media-processing.constants';
import { MediaProcessingService } from './media-processing.service';
import {
  ImageVariantFormat,
  ProcessedImageVariant,
} from './media-processing.types';
import { sanitizeFilename } from './media-processing.util';
import { ProcessingConcurrencyLimiter } from './processing-concurrency.limiter';
import { STORAGE_ADAPTER } from './storage/storage-adapter.interface';
import type { StorageAdapter } from './storage/storage-adapter.interface';

// The bytes + client hints a validated multipart upload hands the service. Neither hint is
// trusted for type — the T5 processor sniffs magic bytes — but the declared MIME routes IMAGE vs
// PDF (a mis-declared file is then rejected by the processor, never mis-persisted).
export interface MediaUploadInput {
  readonly buffer: Buffer;
  readonly originalFilename: string;
  readonly declaredMimeType: string;
}

export interface MediaUploadOutcome {
  readonly deduplicated: boolean;
  readonly asset: AdminMediaAssetEntity;
}

const ADMIN_INCLUDE = {
  variants: true,
  alts: true,
} satisfies Prisma.MediaAssetInclude;
type AdminMediaAsset = Prisma.MediaAssetGetPayload<{
  include: typeof ADMIN_INCLUDE;
}>;

// Every foreign key that can reference an asset (doc 10 §6). Selected in one query so usages and
// the delete-in-use check never fan out (no N+1).
const USAGE_INCLUDE = {
  articleCovers: { select: { id: true } },
  articleOgImages: { select: { id: true, articleId: true, locale: true } },
  projectOgImages: { select: { id: true, projectId: true, locale: true } },
  galleryItems: { select: { id: true, projectId: true } },
  testimonialAvatars: { select: { id: true } },
  pageSeoOgImages: { select: { id: true, pageKey: true, locale: true } },
  resumeForSettings: { select: { id: true } },
} satisfies Prisma.MediaAssetInclude;

const FORMAT_TO_PRISMA: Record<ImageVariantFormat, MediaVariantFormat> = {
  webp: MediaVariantFormat.WEBP,
  avif: MediaVariantFormat.AVIF,
};

// The reusable central media library (D02-7): upload orchestration, SHA-256 dedup, no-orphan
// compensation, usages, and safe deletion. Objects are written before the DB row and compensated
// on any failure (D07-6). Processing runs inside the 2-wide concurrency cap (Q3); the raw upload is
// never persisted — everything comes from the T5 processor's sanitized outputs.
@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
    private readonly processing: MediaProcessingService,
    private readonly locales: LocalesService,
    private readonly limiter: ProcessingConcurrencyLimiter,
    @InjectPinoLogger(MediaService.name) private readonly logger: PinoLogger,
  ) {}

  // ── Upload (POST /admin/media) ────────────────────────────────────────────────────────────────
  async upload(input: MediaUploadInput): Promise<MediaUploadOutcome> {
    const contentHash = this.hashOriginalBytes(input.buffer);

    // Fast-path dedup BEFORE any processing (D09-13): a byte-identical re-upload resolves to the
    // existing asset — no Sharp, no object write, no concurrency slot consumed.
    const existing = await this.prisma.mediaAsset.findUnique({
      where: { contentHash },
      include: ADMIN_INCLUDE,
    });
    if (existing) {
      return { deduplicated: true, asset: this.toAdminEntity(existing) };
    }

    // A genuinely new asset processes under the memory-bounded concurrency cap (Q3, doc 19 §6).
    return this.limiter.run(() => this.processAndPersist(input, contentHash));
  }

  private async processAndPersist(
    input: MediaUploadInput,
    contentHash: string,
  ): Promise<MediaUploadOutcome> {
    // Every object for this asset lives under one random prefix, so a duplicate-race loser's keys
    // are disjoint from the winner's and cleanup can never touch another asset's objects.
    const prefix = randomUUID();
    return this.normalizeMime(input.declaredMimeType) === PDF_MIME_TYPE
      ? this.persistPdf(input, contentHash, prefix)
      : this.persistImage(input, contentHash, prefix);
  }

  private async persistImage(
    input: MediaUploadInput,
    contentHash: string,
    prefix: string,
  ): Promise<MediaUploadOutcome> {
    const processed = await this.processing.processImage({
      buffer: input.buffer,
      originalFilename: input.originalFilename,
      declaredMimeType: input.declaredMimeType,
    });

    const masterKey = this.masterKey(prefix);
    const plannedVariants = processed.variants.map((variant) => ({
      variant,
      key: this.variantKey(prefix, variant.width, variant.format),
    }));

    // Every object this request uploads is tracked so a failure can delete exactly them (D07-6).
    const uploaded: string[] = [];
    try {
      await this.storage.put({
        key: masterKey,
        body: processed.master.buffer,
        contentType: processed.master.mimeType,
        cacheControl: IMMUTABLE_CACHE_CONTROL,
      });
      uploaded.push(masterKey);

      for (const { variant, key } of plannedVariants) {
        await this.storage.put({
          key,
          body: variant.buffer,
          contentType: variant.mimeType,
          cacheControl: IMMUTABLE_CACHE_CONTROL,
        });
        uploaded.push(key);
      }

      // Objects are all written; the DB row is the commit point (D07-6).
      const asset = await this.prisma.mediaAsset.create({
        data: {
          kind: MediaKind.IMAGE,
          storageKey: masterKey,
          originalFilename: sanitizeFilename(input.originalFilename),
          mimeType: processed.master.mimeType,
          sizeBytes: processed.master.sizeBytes,
          contentHash,
          width: processed.master.width,
          height: processed.master.height,
          blurhash: processed.blurhash,
          variants: {
            create: plannedVariants.map(({ variant, key }) => ({
              format: FORMAT_TO_PRISMA[variant.format],
              width: variant.width,
              height: variant.height,
              storageKey: key,
              sizeBytes: variant.sizeBytes,
              overBudget: variant.overBudget,
            })),
          },
        },
        include: ADMIN_INCLUDE,
      });

      this.logOverBudgetRenditions(asset.id, plannedVariants);
      return { deduplicated: false, asset: this.toAdminEntity(asset) };
    } catch (error) {
      return this.compensate(error, contentHash, uploaded);
    }
  }

  private async persistPdf(
    input: MediaUploadInput,
    contentHash: string,
    prefix: string,
  ): Promise<MediaUploadOutcome> {
    const processed = await this.processing.processPdf({
      buffer: input.buffer,
      originalFilename: input.originalFilename,
      declaredMimeType: input.declaredMimeType,
    });

    const key = this.pdfKey(prefix);
    const uploaded: string[] = [];
    try {
      // Download headers are object metadata so R2 serves the PDF directly (D23-15, doc 19 §5).
      await this.storage.put({
        key,
        body: processed.buffer,
        contentType: processed.mimeType,
        cacheControl: IMMUTABLE_CACHE_CONTROL,
        contentDisposition: `attachment; filename="${processed.originalFilename}"`,
      });
      uploaded.push(key);

      // A PDF is never given variants, blurhash, or dimensions (service invariant, D09-11/12).
      const asset = await this.prisma.mediaAsset.create({
        data: {
          kind: MediaKind.PDF,
          storageKey: key,
          originalFilename: processed.originalFilename,
          mimeType: processed.mimeType,
          sizeBytes: processed.sizeBytes,
          contentHash,
        },
        include: ADMIN_INCLUDE,
      });

      return { deduplicated: false, asset: this.toAdminEntity(asset) };
    } catch (error) {
      return this.compensate(error, contentHash, uploaded);
    }
  }

  // The single compensation path for both kinds (D07-6). A duplicate-content race is resolved to
  // the winner; any other failure deletes every object this request uploaded and rethrows. No DB
  // row exists at this point (the create is the commit point), so there is never a partial row.
  private async compensate(
    error: unknown,
    contentHash: string,
    uploaded: string[],
  ): Promise<MediaUploadOutcome> {
    if (isUniqueViolationOnContentHash(error)) {
      await this.cleanup(uploaded, 'duplicate-race');
      const winner = await this.prisma.mediaAsset.findUnique({
        where: { contentHash },
        include: ADMIN_INCLUDE,
      });
      if (winner) {
        return { deduplicated: true, asset: this.toAdminEntity(winner) };
      }
      // A unique violation with no winner row should not happen; surface the original error.
      throw error;
    }

    await this.cleanup(uploaded, 'failed-upload');
    throw error;
  }

  // Deletes exactly the objects a failed/losing request uploaded. Partial failures are surfaced
  // structurally (never swallowed) — the doc-07-§6 model has no reconciliation job, so an operator
  // sees the orphan in the log. Cleanup never throws: the caller must still rethrow / return.
  private async cleanup(keys: string[], reason: string): Promise<void> {
    if (keys.length === 0) {
      return;
    }
    const result = await this.storage.deleteMany(keys);
    if (result.failed.length > 0) {
      this.logger.error(
        {
          event: 'media.compensation_incomplete',
          reason,
          failed: result.failed,
        },
        'Media object cleanup incomplete after a failed upload',
      );
    }
  }

  // ── List / detail (GET /admin/media[, /:id]) ─────────────────────────────────────────────────
  async list(
    query: MediaListQueryDto,
  ): Promise<PaginatedResult<AdminMediaAssetEntity>> {
    const where: Prisma.MediaAssetWhereInput = {};
    if (query.kind) {
      where.kind = query.kind;
    }
    const term = query.q?.trim();
    if (term) {
      // Search the sanitized filename and any locale's alt text (doc 10 §5).
      where.OR = [
        { originalFilename: { contains: term, mode: 'insensitive' } },
        { alts: { some: { alt: { contains: term, mode: 'insensitive' } } } },
      ];
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.mediaAsset.findMany({
        where,
        include: ADMIN_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.mediaAsset.count({ where }),
    ]);

    return new PaginatedResult(
      rows.map((row) => this.toAdminEntity(row)),
      buildPageMeta(query.page, query.perPage, total),
    );
  }

  async getAdmin(id: string): Promise<AdminMediaAssetEntity> {
    return this.toAdminEntity(await this.loadOrThrow(id));
  }

  // ── Per-locale alt (PATCH /admin/media/:id) ──────────────────────────────────────────────────
  async updateAlt(
    id: string,
    dto: UpdateMediaAltDto,
  ): Promise<AdminMediaAssetEntity> {
    const asset = await this.loadOrThrow(id);
    // Alt text belongs only to images (service invariant, doc 07 §4).
    if (asset.kind !== MediaKind.IMAGE) {
      throw new UnprocessableEntityException(
        'Alt text can only be set on image assets.',
      );
    }
    await this.locales.assertEnabled(dto.locale);

    if (dto.alt === null) {
      // null → remove this locale's row → "missing" (descriptor alt = null, no fallback).
      await this.prisma.mediaAssetAlt.deleteMany({
        where: { mediaAssetId: id, locale: dto.locale },
      });
    } else {
      // A string (including "") is stored verbatim; "" = intentionally decorative.
      await this.prisma.mediaAssetAlt.upsert({
        where: {
          mediaAssetId_locale: { mediaAssetId: id, locale: dto.locale },
        },
        create: { mediaAssetId: id, locale: dto.locale, alt: dto.alt },
        update: { alt: dto.alt },
      });
    }

    return this.getAdmin(id);
  }

  // ── Usages (GET /admin/media/:id/usages) ─────────────────────────────────────────────────────
  async usages(id: string): Promise<MediaUsageEntity[]> {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id },
      include: USAGE_INCLUDE,
    });
    if (!asset) {
      throw new NotFoundException('Media asset not found.');
    }
    return buildUsages(asset);
  }

  // ── Delete (DELETE /admin/media/:id) ─────────────────────────────────────────────────────────
  async remove(id: string): Promise<void> {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id },
      include: { ...USAGE_INCLUDE, variants: { select: { storageKey: true } } },
    });
    if (!asset) {
      throw new NotFoundException('Media asset not found.');
    }

    const usages = buildUsages(asset);
    if (usages.length > 0) {
      // Referenced → 409 with the structured usages; no row or object is touched (doc 10 §6).
      throw new MediaInUseException(usages);
    }

    // Objects first (idempotent), then the row — CASCADE removes variants + alts (D07-6). If any
    // object deletion fails we keep the row and surface it; an idempotent retry converges.
    const keys = [asset.storageKey, ...asset.variants.map((v) => v.storageKey)];
    const result = await this.storage.deleteMany(keys);
    if (result.failed.length > 0) {
      this.logger.error(
        {
          event: 'media.delete_cleanup_incomplete',
          assetId: id,
          failed: result.failed,
        },
        'Media object deletion incomplete; DB row retained for retry',
      );
      throw new ServiceUnavailableException(
        'Stored media objects could not be fully removed. Please retry.',
      );
    }

    await this.prisma.mediaAsset.delete({ where: { id } });
  }

  // ── Internals ────────────────────────────────────────────────────────────────────────────────
  private async loadOrThrow(id: string): Promise<AdminMediaAsset> {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id },
      include: ADMIN_INCLUDE,
    });
    if (!asset) {
      throw new NotFoundException('Media asset not found.');
    }
    return asset;
  }

  private hashOriginalBytes(buffer: Buffer): string {
    // SHA-256 of the ORIGINAL upload bytes (not the sanitized master), lowercase hex (D09-13).
    return createHash('sha256').update(buffer).digest('hex');
  }

  private normalizeMime(mime: string): string {
    return mime.split(';')[0]?.trim().toLowerCase() ?? '';
  }

  private masterKey(prefix: string): string {
    return `${MEDIA_KEY_ROOT}/${prefix}/master.webp`;
  }

  private variantKey(
    prefix: string,
    width: number,
    format: ImageVariantFormat,
  ): string {
    return `${MEDIA_KEY_ROOT}/${prefix}/${width}-${format}.${format}`;
  }

  private pdfKey(prefix: string): string {
    return `${MEDIA_KEY_ROOT}/${prefix}/document.pdf`;
  }

  private logOverBudgetRenditions(
    assetId: string,
    plannedVariants: readonly { variant: ProcessedImageVariant; key: string }[],
  ): void {
    // Persisted `overBudget` (queryable) PLUS the structured pino event doc 20 §4 mandates.
    for (const { variant, key } of plannedVariants) {
      if (!variant.overBudget) {
        continue;
      }
      this.logger.warn(
        {
          event: 'media.rendition_over_budget',
          assetId,
          storageKey: key,
          width: variant.width,
          format: variant.format,
          bytes: variant.sizeBytes,
          budget: budgetForWidth(variant.width, variant.format),
          floorQuality: variant.quality,
        },
        'Rendition kept above its width×format budget at the quality floor (D20-6)',
      );
    }
  }

  private toAdminEntity(asset: AdminMediaAsset): AdminMediaAssetEntity {
    const variants: AdminMediaVariantEntity[] = [...asset.variants]
      .sort((a, b) => a.width - b.width)
      .map((variant) => ({
        format: variant.format,
        width: variant.width,
        height: variant.height,
        sizeBytes: variant.sizeBytes,
        url: this.storage.publicUrl(variant.storageKey),
        overBudget: variant.overBudget,
      }));

    const alts = [...asset.alts]
      .sort((a, b) => a.locale.localeCompare(b.locale))
      .map((alt) => ({ locale: alt.locale, alt: alt.alt }));

    return {
      id: asset.id,
      kind: asset.kind,
      url: this.primaryUrl(asset),
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      originalFilename: asset.originalFilename,
      width: asset.width,
      height: asset.height,
      blurhash: asset.blurhash,
      contentHash: asset.contentHash,
      variants,
      alts,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    };
  }

  // The primary URL: for a PDF its download; for an image the WIDEST WebP rendition — never the
  // large sanitized master (doc 07 §6, doc 10 §6). Every image has ≥ 1 WebP rendition.
  private primaryUrl(asset: AdminMediaAsset): string {
    if (asset.kind === MediaKind.PDF) {
      return this.storage.publicUrl(asset.storageKey);
    }
    const webp = asset.variants.filter(
      (variant) => variant.format === MediaVariantFormat.WEBP,
    );
    const widest = webp.reduce<(typeof webp)[number] | null>(
      (max, variant) =>
        max === null || variant.width > max.width ? variant : max,
      null,
    );
    return this.storage.publicUrl(
      widest ? widest.storageKey : asset.storageKey,
    );
  }
}

// Only the mapped `content_hash` unique can arbitrate a duplicate race; a storageKey collision
// (astronomically unlikely with random keys) must NOT be treated as a race and fetch-by-hash.
function isUniqueViolationOnContentHash(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false;
  }
  const target = error.meta?.target;
  const asText = Array.isArray(target)
    ? target.join(',')
    : typeof target === 'string'
      ? target
      : '';
  return asText.includes('content_hash') || asText.includes('contentHash');
}

// Structural relations shared by the usages and delete queries (decoupled from the exact include).
interface UsageRelations {
  articleCovers: { id: string }[];
  articleOgImages: { id: string; articleId: string; locale: string }[];
  projectOgImages: { id: string; projectId: string; locale: string }[];
  galleryItems: { id: string; projectId: string }[];
  testimonialAvatars: { id: string }[];
  pageSeoOgImages: { id: string; pageKey: string; locale: string }[];
  resumeForSettings: { id: string }[];
}

function budgetForWidth(width: number, format: ImageVariantFormat): number {
  const tier = RENDITION_WIDTHS.includes(width) ? width : 640;
  return RENDITION_BUDGETS[tier]?.[format] ?? 0;
}

function buildUsages(asset: UsageRelations): MediaUsageEntity[] {
  const usages: MediaUsageEntity[] = [];
  for (const article of asset.articleCovers) {
    usages.push({ type: 'article-cover', id: article.id });
  }
  for (const translation of asset.articleOgImages) {
    usages.push({
      type: 'article-og',
      id: translation.id,
      reference: {
        articleId: translation.articleId,
        locale: translation.locale,
      },
    });
  }
  for (const translation of asset.projectOgImages) {
    usages.push({
      type: 'project-og',
      id: translation.id,
      reference: {
        projectId: translation.projectId,
        locale: translation.locale,
      },
    });
  }
  for (const item of asset.galleryItems) {
    usages.push({
      type: 'project-gallery',
      id: item.id,
      reference: { projectId: item.projectId },
    });
  }
  for (const testimonial of asset.testimonialAvatars) {
    usages.push({ type: 'testimonial-avatar', id: testimonial.id });
  }
  for (const pageSeo of asset.pageSeoOgImages) {
    usages.push({
      type: 'page-seo-og',
      id: pageSeo.id,
      reference: { pageKey: pageSeo.pageKey, locale: pageSeo.locale },
    });
  }
  for (const settings of asset.resumeForSettings) {
    usages.push({ type: 'settings-resume', id: settings.id });
  }
  return usages;
}
