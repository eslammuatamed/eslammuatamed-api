import {
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MediaKind, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PinoLogger } from 'nestjs-pino';
import sharp from 'sharp';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalesService } from '../locales/locales.service';
import { MediaInUseException } from './media-in-use.exception';
import { MediaProcessingService } from './media-processing.service';
import { ProcessedImage, ProcessedPdf } from './media-processing.types';
import { MediaService } from './media.service';
import { ProcessingCapacityExceededException } from './processing-capacity.exception';
import { ProcessingConcurrencyLimiter } from './processing-concurrency.limiter';
import { StorageAdapter } from './storage/storage-adapter.interface';

// ── Fixtures ─────────────────────────────────────────────────────────────────────────────────

const processedImage = (
  overrides: Partial<ProcessedImage> = {},
): ProcessedImage => ({
  kind: 'IMAGE',
  master: {
    buffer: Buffer.from('master-webp'),
    mimeType: 'image/webp',
    width: 1920,
    height: 1080,
    sizeBytes: 210_000,
    quality: 90,
  },
  variants: [
    {
      format: 'webp',
      mimeType: 'image/webp',
      buffer: Buffer.from('w640'),
      width: 640,
      height: 360,
      sizeBytes: 40_000,
      quality: 78,
      overBudget: false,
    },
    {
      format: 'avif',
      mimeType: 'image/avif',
      buffer: Buffer.from('a640'),
      width: 640,
      height: 360,
      sizeBytes: 30_000,
      quality: 55,
      overBudget: false,
    },
  ],
  blurhash: 'LEHV6nWB2yk8',
  ...overrides,
});

const processedPdf = (overrides: Partial<ProcessedPdf> = {}): ProcessedPdf => ({
  kind: 'PDF',
  buffer: Buffer.from('%PDF-1.4 ... %%EOF'),
  mimeType: 'application/pdf',
  sizeBytes: 54_321,
  originalFilename: 'resume.pdf',
  ...overrides,
});

const imageAssetRow = (overrides: Record<string, unknown> = {}): never =>
  ({
    id: 'asset-1',
    kind: MediaKind.IMAGE,
    storageKey: 'media/px/master.webp',
    originalFilename: 'photo.jpg',
    mimeType: 'image/webp',
    sizeBytes: 210_000,
    contentHash: 'hash-1',
    width: 1920,
    height: 1080,
    blurhash: 'LEHV6nWB2yk8',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    variants: [
      {
        id: 'v-webp',
        mediaAssetId: 'asset-1',
        format: 'WEBP',
        width: 640,
        height: 360,
        storageKey: 'media/px/640-webp.webp',
        sizeBytes: 40_000,
        overBudget: false,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        id: 'v-webp-2',
        mediaAssetId: 'asset-1',
        format: 'WEBP',
        width: 1920,
        height: 1080,
        storageKey: 'media/px/1920-webp.webp',
        sizeBytes: 190_000,
        overBudget: false,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
    ],
    alts: [],
    ...overrides,
  }) as never;

const pdfAssetRow = (overrides: Record<string, unknown> = {}): never =>
  ({
    id: 'pdf-1',
    kind: MediaKind.PDF,
    storageKey: 'media/px/document.pdf',
    originalFilename: 'resume.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 54_321,
    contentHash: 'hash-pdf',
    width: null,
    height: null,
    blurhash: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    variants: [],
    alts: [],
    ...overrides,
  }) as never;

const p2002 = (target: string[]): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '6.0.0',
    meta: { target },
  });

// A minimal structurally-valid PDF (real %PDF- magic + %%EOF trailer) for the validation tests.
const VALID_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
  'latin1',
);

const imageUpload = () => ({
  buffer: Buffer.from('raw-image-bytes'),
  originalFilename: 'photo.jpg',
  declaredMimeType: 'image/jpeg',
});

const pdfUpload = () => ({
  buffer: Buffer.from('raw-pdf-bytes'),
  originalFilename: 'resume.pdf',
  declaredMimeType: 'application/pdf',
});

// ── Suite ────────────────────────────────────────────────────────────────────────────────────

describe('MediaService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let locales: DeepMockProxy<LocalesService>;
  let processing: {
    processImage: jest.Mock;
    processPdf: jest.Mock;
    validateImageInput: jest.Mock;
    validatePdfInput: jest.Mock;
  };
  let storage: jest.Mocked<StorageAdapter>;
  let limiter: ProcessingConcurrencyLimiter;
  let logger: PinoLogger;
  let service: MediaService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    locales = mockDeep<LocalesService>();
    processing = {
      processImage: jest.fn(),
      processPdf: jest.fn(),
      // Identity validation runs before dedup; default to passing so the existing suites (which use
      // synthetic buffers) exercise the orchestration, not the real magic-byte checks.
      validateImageInput: jest.fn().mockResolvedValue(undefined),
      validatePdfInput: jest.fn().mockResolvedValue(undefined),
    };
    storage = {
      put: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      deleteMany: jest.fn().mockResolvedValue({ deleted: [], failed: [] }),
      publicUrl: jest.fn((key: string) => `https://media.test/${key}`),
    };
    limiter = new ProcessingConcurrencyLimiter();
    logger = {
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    } as unknown as PinoLogger;
    service = new MediaService(
      prisma,
      storage,
      processing as unknown as MediaProcessingService,
      locales,
      limiter,
      logger,
    );
  });

  const putKeys = (): string[] =>
    storage.put.mock.calls.map((call) => call[0].key);

  describe('upload — new asset', () => {
    it('processes an image, uploads master + variants, then creates the row', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(null); // no dedup hit
      processing.processImage.mockResolvedValue(processedImage());
      prisma.mediaAsset.create.mockResolvedValue(imageAssetRow());

      const outcome = await service.upload(imageUpload());

      expect(outcome.deduplicated).toBe(false);
      expect(processing.processImage).toHaveBeenCalledTimes(1);
      // 1 master + 2 variants uploaded before the row.
      expect(storage.put).toHaveBeenCalledTimes(3);
      const keys = putKeys();
      expect(keys[0]).toMatch(/^media\/[0-9a-f-]+\/master\.webp$/);
      expect(keys.some((k) => k.endsWith('/640-webp.webp'))).toBe(true);
      expect(keys.some((k) => k.endsWith('/640-avif.avif'))).toBe(true);
      // Master + image renditions carry an immutable Cache-Control.
      for (const call of storage.put.mock.calls) {
        expect(call[0].cacheControl).toBe(
          'public, max-age=31536000, immutable',
        );
      }
      const createArg = prisma.mediaAsset.create.mock.calls[0]![0];
      expect(createArg.data.kind).toBe(MediaKind.IMAGE);
      expect(createArg.data.mimeType).toBe('image/webp');
      expect(createArg.data.blurhash).toBe('LEHV6nWB2yk8');
      expect(createArg.data.variants?.create).toHaveLength(2);
    });

    it('processes a PDF into one asset with no variants or blurhash', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(null);
      processing.processPdf.mockResolvedValue(processedPdf());
      prisma.mediaAsset.create.mockResolvedValue(pdfAssetRow());

      const outcome = await service.upload(pdfUpload());

      expect(outcome.deduplicated).toBe(false);
      expect(processing.processPdf).toHaveBeenCalledTimes(1);
      expect(processing.processImage).not.toHaveBeenCalled();
      expect(storage.put).toHaveBeenCalledTimes(1);
      const putArg = storage.put.mock.calls[0]![0];
      expect(putArg.key).toMatch(/\/document\.pdf$/);
      expect(putArg.contentType).toBe('application/pdf');
      expect(putArg.contentDisposition).toBe(
        'attachment; filename="resume.pdf"',
      );
      const createArg = prisma.mediaAsset.create.mock.calls[0]![0];
      expect(createArg.data.kind).toBe(MediaKind.PDF);
      expect(createArg.data.variants).toBeUndefined();
      expect(createArg.data.blurhash).toBeUndefined();
      expect(createArg.data.width).toBeUndefined();
    });

    it('hashes the ORIGINAL upload bytes (lowercase SHA-256 hex)', async () => {
      const upload = imageUpload();
      const expected = createHash('sha256').update(upload.buffer).digest('hex');
      prisma.mediaAsset.findUnique.mockResolvedValue(null);
      processing.processImage.mockResolvedValue(processedImage());
      prisma.mediaAsset.create.mockResolvedValue(imageAssetRow());

      await service.upload(upload);

      expect(prisma.mediaAsset.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { contentHash: expected } }),
      );
      expect(prisma.mediaAsset.create.mock.calls[0]![0].data.contentHash).toBe(
        expected,
      );
      expect(expected).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('upload — deduplication', () => {
    it('returns 200-shaped { deduplicated: true } without processing on a hash hit', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(imageAssetRow());

      const outcome = await service.upload(imageUpload());

      expect(outcome.deduplicated).toBe(true);
      expect(outcome.asset.id).toBe('asset-1');
      expect(processing.processImage).not.toHaveBeenCalled();
      expect(processing.processPdf).not.toHaveBeenCalled();
      expect(storage.put).not.toHaveBeenCalled();
      expect(prisma.mediaAsset.create).not.toHaveBeenCalled();
    });
  });

  // T6 correction: identity validation (magic-byte + extension + declared-MIME consistency) must run
  // on EVERY upload BEFORE the dedup lookup, so a duplicate carrying a forged filename/MIME is
  // rejected (422) rather than deduplicated. A real MediaProcessingService validates real bytes;
  // none of these cases reach Sharp (they either fail validation or hit dedup), so no real image
  // processing runs.
  describe('upload — validation before deduplication', () => {
    let realProcessing: MediaProcessingService;
    let realService: MediaService;

    const jpegBytes = (): Promise<Buffer> =>
      sharp({
        create: { width: 8, height: 8, channels: 3, background: '#ff0000' },
      })
        .jpeg()
        .toBuffer();

    beforeEach(() => {
      realProcessing = new MediaProcessingService();
      realService = new MediaService(
        prisma,
        storage,
        realProcessing,
        locales,
        limiter,
        logger,
      );
    });

    it('accepts a valid duplicate JPEG (.jpg, image/jpeg) → 200 deduplicated, no Sharp, no storage', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(imageAssetRow());
      const sharpSpy = jest.spyOn(realProcessing, 'processImage');

      const outcome = await realService.upload({
        buffer: await jpegBytes(),
        originalFilename: 'photo.jpg',
        declaredMimeType: 'image/jpeg',
      });

      expect(outcome.deduplicated).toBe(true);
      expect(sharpSpy).not.toHaveBeenCalled();
      expect(storage.put).not.toHaveBeenCalled();
    });

    it('rejects an existing JPEG re-uploaded as .png → 422, no Sharp, no storage', async () => {
      const sharpSpy = jest.spyOn(realProcessing, 'processImage');

      await expect(
        realService.upload({
          buffer: await jpegBytes(),
          originalFilename: 'photo.png',
          declaredMimeType: 'image/jpeg',
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      expect(sharpSpy).not.toHaveBeenCalled();
      expect(storage.put).not.toHaveBeenCalled();
      expect(prisma.mediaAsset.findUnique).not.toHaveBeenCalled();
    });

    it('rejects an existing JPEG declared image/png → 422, no Sharp, no storage', async () => {
      const sharpSpy = jest.spyOn(realProcessing, 'processImage');

      await expect(
        realService.upload({
          buffer: await jpegBytes(),
          originalFilename: 'photo.jpg',
          declaredMimeType: 'image/png',
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      expect(sharpSpy).not.toHaveBeenCalled();
      expect(storage.put).not.toHaveBeenCalled();
      expect(prisma.mediaAsset.findUnique).not.toHaveBeenCalled();
    });

    it('rejects a PDF uploaded as .jpg declared image/jpeg → 422, no Sharp, no storage', async () => {
      const sharpSpy = jest.spyOn(realProcessing, 'processImage');

      await expect(
        realService.upload({
          buffer: VALID_PDF,
          originalFilename: 'resume.jpg',
          declaredMimeType: 'image/jpeg',
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      expect(sharpSpy).not.toHaveBeenCalled();
      expect(storage.put).not.toHaveBeenCalled();
      expect(prisma.mediaAsset.findUnique).not.toHaveBeenCalled();
    });

    it('rejects a PDF declared application/octet-stream → 422, no Sharp, no storage', async () => {
      const sharpSpy = jest.spyOn(realProcessing, 'processImage');

      await expect(
        realService.upload({
          buffer: VALID_PDF,
          originalFilename: 'resume.pdf',
          declaredMimeType: 'application/octet-stream',
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      expect(sharpSpy).not.toHaveBeenCalled();
      expect(storage.put).not.toHaveBeenCalled();
      expect(prisma.mediaAsset.findUnique).not.toHaveBeenCalled();
    });

    it('accepts a valid duplicate with uppercase .JPG and image/jpeg → 200 deduplicated', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(imageAssetRow());
      const sharpSpy = jest.spyOn(realProcessing, 'processImage');

      const outcome = await realService.upload({
        buffer: await jpegBytes(),
        originalFilename: 'PHOTO.JPG',
        declaredMimeType: 'image/jpeg',
      });

      expect(outcome.deduplicated).toBe(true);
      expect(sharpSpy).not.toHaveBeenCalled();
    });
  });

  describe('upload — concurrent duplicate race', () => {
    it('resolves the losing insert to the winner and deletes its own objects', async () => {
      prisma.mediaAsset.findUnique
        .mockResolvedValueOnce(null) // dedup miss → proceed
        .mockResolvedValueOnce(imageAssetRow({ id: 'winner' })); // winner fetched after P2002
      processing.processImage.mockResolvedValue(processedImage());
      prisma.mediaAsset.create.mockRejectedValue(p2002(['content_hash']));

      const outcome = await service.upload(imageUpload());

      expect(outcome.deduplicated).toBe(true);
      expect(outcome.asset.id).toBe('winner');
      // The loser deletes exactly the objects it uploaded (master + both variants).
      expect(storage.deleteMany).toHaveBeenCalledTimes(1);
      expect(storage.deleteMany).toHaveBeenCalledWith(putKeys());
    });

    it('does not treat a storageKey unique violation as a hash race', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(null);
      processing.processImage.mockResolvedValue(processedImage());
      prisma.mediaAsset.create.mockRejectedValue(p2002(['storage_key']));

      await expect(service.upload(imageUpload())).rejects.toBeInstanceOf(
        Prisma.PrismaClientKnownRequestError,
      );
      // Objects still cleaned up, but no fetch-a-winner-by-hash.
      expect(storage.deleteMany).toHaveBeenCalledWith(putKeys());
      expect(prisma.mediaAsset.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('upload — compensation (no orphans, D07-6)', () => {
    it('cleans up prior objects when a variant upload fails partway', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(null);
      processing.processImage.mockResolvedValue(processedImage());
      storage.put
        .mockResolvedValueOnce(undefined) // master
        .mockResolvedValueOnce(undefined) // first variant
        .mockRejectedValueOnce(new Error('object store down')); // second variant

      await expect(service.upload(imageUpload())).rejects.toThrow(
        'object store down',
      );
      expect(prisma.mediaAsset.create).not.toHaveBeenCalled();
      const keys = putKeys();
      // Only the two that succeeded are cleaned up.
      expect(storage.deleteMany).toHaveBeenCalledWith([keys[0], keys[1]]);
    });

    it('cleans up every object when the DB write fails after uploads', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(null);
      processing.processImage.mockResolvedValue(processedImage());
      prisma.mediaAsset.create.mockRejectedValue(new Error('db exploded'));

      await expect(service.upload(imageUpload())).rejects.toThrow(
        'db exploded',
      );
      expect(storage.deleteMany).toHaveBeenCalledWith(putKeys());
    });

    it('surfaces a partial cleanup failure structurally', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(null);
      processing.processImage.mockResolvedValue(processedImage());
      prisma.mediaAsset.create.mockRejectedValue(new Error('db exploded'));
      storage.deleteMany.mockResolvedValue({
        deleted: [],
        failed: [{ key: 'media/px/master.webp', reason: 'network' }],
      });

      await expect(service.upload(imageUpload())).rejects.toThrow(
        'db exploded',
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'media.compensation_incomplete',
          failed: [{ key: 'media/px/master.webp', reason: 'network' }],
        }),
        expect.any(String),
      );
    });
  });

  describe('upload — overBudget logging (doc 20 §4)', () => {
    it('emits a structured pino event for a rendition kept over budget', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(null);
      processing.processImage.mockResolvedValue(
        processedImage({
          variants: [
            {
              format: 'webp',
              mimeType: 'image/webp',
              buffer: Buffer.from('big'),
              width: 640,
              height: 640,
              sizeBytes: 140_000,
              quality: 55,
              overBudget: true,
            },
          ],
        }),
      );
      prisma.mediaAsset.create.mockResolvedValue(imageAssetRow());

      await service.upload(imageUpload());

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'media.rendition_over_budget',
          width: 640,
          format: 'webp',
          bytes: 140_000,
          budget: 90_000,
          floorQuality: 55,
        }),
        expect.any(String),
      );
    });
  });

  describe('upload — concurrency cap (Q3)', () => {
    it('accepts two in-flight uploads and rejects the third with 429', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(null);
      prisma.mediaAsset.create.mockResolvedValue(imageAssetRow());

      // Hold two processing jobs in flight.
      let release1!: () => void;
      let release2!: () => void;
      processing.processImage
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              release1 = () => resolve(processedImage());
            }),
        )
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              release2 = () => resolve(processedImage());
            }),
        );

      const first = service.upload(imageUpload());
      const second = service.upload(imageUpload());
      await Promise.resolve(); // let both enter the limiter

      await expect(service.upload(imageUpload())).rejects.toBeInstanceOf(
        ProcessingCapacityExceededException,
      );

      release1();
      release2();
      await Promise.all([first, second]);
    });
  });

  describe('list', () => {
    it('searches filename and alt text and filters by kind', async () => {
      prisma.$transaction.mockResolvedValue([[imageAssetRow()], 1] as never);

      await service.list({
        page: 1,
        perPage: 12,
        skip: 0,
        take: 12,
        q: 'desk',
        kind: MediaKind.IMAGE,
      });

      const findArg = prisma.mediaAsset.findMany.mock.calls[0]![0];
      expect(findArg?.where?.kind).toBe(MediaKind.IMAGE);
      expect(findArg?.where?.OR).toEqual([
        { originalFilename: { contains: 'desk', mode: 'insensitive' } },
        { alts: { some: { alt: { contains: 'desk', mode: 'insensitive' } } } },
      ]);
      expect(findArg?.orderBy).toEqual({ createdAt: 'desc' });
    });

    it('builds an admin entity whose url is the widest WebP rendition', async () => {
      prisma.$transaction.mockResolvedValue([[imageAssetRow()], 1] as never);

      const result = await service.list({
        page: 1,
        perPage: 12,
        skip: 0,
        take: 12,
      });

      expect(result.data[0]!.url).toBe(
        'https://media.test/media/px/1920-webp.webp',
      );
      expect(result.meta.total).toBe(1);
    });
  });

  describe('updateAlt (null vs "")', () => {
    it('rejects alt on a PDF asset', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(pdfAssetRow());

      await expect(
        service.updateAlt('pdf-1', { locale: 'en', alt: 'x' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(prisma.mediaAssetAlt.upsert).not.toHaveBeenCalled();
    });

    it('stores an empty string verbatim (decorative)', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(imageAssetRow());

      await service.updateAlt('asset-1', { locale: 'en', alt: '' });

      expect(locales.assertEnabled).toHaveBeenCalledWith('en');
      expect(prisma.mediaAssetAlt.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: { mediaAssetId: 'asset-1', locale: 'en', alt: '' },
          update: { alt: '' },
        }),
      );
      expect(prisma.mediaAssetAlt.deleteMany).not.toHaveBeenCalled();
    });

    it('removes the row for a null alt (missing translation)', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(imageAssetRow());

      await service.updateAlt('asset-1', { locale: 'en', alt: null });

      expect(prisma.mediaAssetAlt.deleteMany).toHaveBeenCalledWith({
        where: { mediaAssetId: 'asset-1', locale: 'en' },
      });
      expect(prisma.mediaAssetAlt.upsert).not.toHaveBeenCalled();
    });
  });

  describe('usages', () => {
    it('enumerates every foreign-key relation', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue({
        id: 'asset-1',
        articleCovers: [{ id: 'article-1' }],
        articleOgImages: [{ id: 'at-1', articleId: 'article-2', locale: 'en' }],
        projectOgImages: [{ id: 'pt-1', projectId: 'project-1', locale: 'ar' }],
        galleryItems: [{ id: 'g-1', projectId: 'project-2' }],
        testimonialAvatars: [{ id: 't-1' }],
        pageSeoOgImages: [{ id: 'ps-1', pageKey: 'home', locale: 'en' }],
        resumeForSettings: [{ id: 's-1' }],
        portraitForSettings: [{ id: 's-1' }],
      } as never);

      const usages = await service.usages('asset-1');

      expect(usages.map((u) => u.type).sort()).toEqual([
        'article-cover',
        'article-og',
        'page-seo-og',
        'project-gallery',
        'project-og',
        'settings-portrait',
        'settings-resume',
        'testimonial-avatar',
      ]);
      expect(usages.find((u) => u.type === 'article-og')?.reference).toEqual({
        articleId: 'article-2',
        locale: 'en',
      });
    });

    it('404s an unknown asset', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(null);
      await expect(service.usages('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    const unreferenced = (): never =>
      ({
        id: 'asset-1',
        storageKey: 'media/px/master.webp',
        variants: [{ storageKey: 'media/px/640-webp.webp' }],
        articleCovers: [],
        articleOgImages: [],
        projectOgImages: [],
        galleryItems: [],
        testimonialAvatars: [],
        pageSeoOgImages: [],
        resumeForSettings: [],
        portraitForSettings: [],
      }) as never;

    it('409s a referenced asset and touches no data', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue({
        id: 'asset-1',
        storageKey: 'media/px/master.webp',
        variants: [],
        articleCovers: [{ id: 'article-1' }],
        articleOgImages: [],
        projectOgImages: [],
        galleryItems: [],
        testimonialAvatars: [],
        pageSeoOgImages: [],
        resumeForSettings: [],
        portraitForSettings: [],
      } as never);

      await expect(service.remove('asset-1')).rejects.toBeInstanceOf(
        MediaInUseException,
      );
      expect(storage.deleteMany).not.toHaveBeenCalled();
      expect(prisma.mediaAsset.delete).not.toHaveBeenCalled();
    });

    it('deletes objects then the row when unreferenced', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(unreferenced());

      await service.remove('asset-1');

      expect(storage.deleteMany).toHaveBeenCalledWith([
        'media/px/master.webp',
        'media/px/640-webp.webp',
      ]);
      expect(prisma.mediaAsset.delete).toHaveBeenCalledWith({
        where: { id: 'asset-1' },
      });
    });

    it('does not delete the row when object deletion fails', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(unreferenced());
      storage.deleteMany.mockResolvedValue({
        deleted: ['media/px/master.webp'],
        failed: [{ key: 'media/px/640-webp.webp', reason: 'network' }],
      });

      await expect(service.remove('asset-1')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(prisma.mediaAsset.delete).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'media.delete_cleanup_incomplete' }),
        expect.any(String),
      );
    });

    it('404s an unknown asset', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
