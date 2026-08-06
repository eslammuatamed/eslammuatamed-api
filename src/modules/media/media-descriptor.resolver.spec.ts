import { MediaKind, MediaVariantFormat } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import {
  DescriptorImageInput,
  DescriptorPdfInput,
  MediaDescriptorResolver,
} from './media-descriptor.resolver';
import { StorageAdapter } from './storage/storage-adapter.interface';

const storage: jest.Mocked<StorageAdapter> = {
  put: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
  publicUrl: jest.fn((key: string) => `https://media.test/${key}`),
};

const logger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
} as unknown as PinoLogger;

const imageInput = (
  overrides: Partial<DescriptorImageInput> = {},
): DescriptorImageInput => ({
  id: 'img-1',
  width: 2400,
  height: 1350,
  blurhash: 'LEHV6nWB',
  variants: [
    {
      format: MediaVariantFormat.AVIF,
      width: 1920,
      height: 1080,
      storageKey: 'k/1920-avif.avif',
    },
    {
      format: MediaVariantFormat.WEBP,
      width: 640,
      height: 360,
      storageKey: 'k/640-webp.webp',
    },
    {
      format: MediaVariantFormat.WEBP,
      width: 1920,
      height: 1080,
      storageKey: 'k/1920-webp.webp',
    },
    {
      format: MediaVariantFormat.AVIF,
      width: 640,
      height: 360,
      storageKey: 'k/640-avif.avif',
    },
  ],
  alts: [
    { locale: 'en', alt: 'A desk' },
    { locale: 'ar', alt: '' },
  ],
  ...overrides,
});

const pdfInput = (
  overrides: Partial<DescriptorPdfInput> = {},
): DescriptorPdfInput => ({
  id: 'pdf-1',
  storageKey: 'k/document.pdf',
  originalFilename: 'resume.pdf',
  sizeBytes: 54_321,
  ...overrides,
});

describe('MediaDescriptorResolver', () => {
  const resolver = new MediaDescriptorResolver(storage, logger);

  beforeEach(() => jest.clearAllMocks());

  describe('resolveImage', () => {
    it('builds the image descriptor with the widest WebP as the primary URL', () => {
      const d = resolver.resolveImage(imageInput(), 'en');
      expect(d.id).toBe('img-1');
      expect(d.kind).toBe(MediaKind.IMAGE);
      expect(d.url).toBe('https://media.test/k/1920-webp.webp'); // widest WebP, not AVIF, not master
      expect(d.blurhash).toBe('LEHV6nWB');
    });

    // D10-14. The fixture master is 2400×1350 while its widest WebP is 1920×1080, so this asserts the
    // whole point: the top-level triple describes the RENDITION, never the private master.
    it('sources url, width and height from the same widest public WebP — not the master', () => {
      const d = resolver.resolveImage(imageInput(), 'en');
      expect(d.url).toBe('https://media.test/k/1920-webp.webp');
      expect(d.width).toBe(1920);
      expect(d.height).toBe(1080);

      // The self-consistency invariant stated as the contract states it: whatever `url` points at,
      // `width`/`height` are that file's dimensions.
      const pointedAt = d.variants.find((v) => v.url === d.url);
      expect(pointedAt).toBeDefined();
      expect(d.width).toBe(pointedAt?.width);
      expect(d.height).toBe(pointedAt?.height);
    });

    // The master's dimensions are the ones a naive client would have turned into `${url} ${width}w`.
    it('never reports the private master dimensions at the top level', () => {
      const input = imageInput();
      const d = resolver.resolveImage(input, 'en');
      expect(input.width).toBe(2400); // master, per the fixture
      expect(d.width).not.toBe(input.width);
      expect(d.height).not.toBe(input.height);
    });

    it('exposes every variant deterministically (width asc, format asc) with only public fields', () => {
      const d = resolver.resolveImage(imageInput(), 'en');
      expect(d.variants).toEqual([
        {
          format: 'AVIF',
          width: 640,
          height: 360,
          url: 'https://media.test/k/640-avif.avif',
        },
        {
          format: 'WEBP',
          width: 640,
          height: 360,
          url: 'https://media.test/k/640-webp.webp',
        },
        {
          format: 'AVIF',
          width: 1920,
          height: 1080,
          url: 'https://media.test/k/1920-avif.avif',
        },
        {
          format: 'WEBP',
          width: 1920,
          height: 1080,
          url: 'https://media.test/k/1920-webp.webp',
        },
      ]);
      // No admin/internal fields leak on a variant.
      for (const v of d.variants) {
        expect(Object.keys(v).sort()).toEqual([
          'format',
          'height',
          'url',
          'width',
        ]);
      }
    });

    it('resolves alt to the requested locale', () => {
      expect(resolver.resolveImage(imageInput(), 'en').alt).toBe('A desk');
    });

    it('preserves an empty-string alt (decorative)', () => {
      expect(resolver.resolveImage(imageInput(), 'ar').alt).toBe('');
    });

    it('returns alt: null for a missing locale (no cross-locale fallback)', () => {
      expect(resolver.resolveImage(imageInput(), 'fr').alt).toBeNull();
    });

    it('does not expose overBudget, storage keys, content hash, or a master URL', () => {
      const d = resolver.resolveImage(imageInput(), 'en');
      expect(Object.keys(d).sort()).toEqual([
        'alt',
        'blurhash',
        'height',
        'id',
        'kind',
        'url',
        'variants',
        'width',
      ]);
      const serialized = JSON.stringify(d);
      expect(serialized).not.toContain('overBudget');
      expect(serialized).not.toContain('storageKey');
      expect(serialized).not.toContain('contentHash');
      expect(serialized).not.toContain('master');
    });

    it('prefers the widest WebP even when a larger AVIF exists', () => {
      const d = resolver.resolveImage(
        imageInput({
          variants: [
            {
              format: MediaVariantFormat.AVIF,
              width: 1920,
              height: 1080,
              storageKey: 'k/1920-avif.avif',
            },
            {
              format: MediaVariantFormat.WEBP,
              width: 1280,
              height: 720,
              storageKey: 'k/1280-webp.webp',
            },
          ],
        }),
        'en',
      );
      expect(d.url).toBe('https://media.test/k/1280-webp.webp');
    });
  });

  describe('image descriptor invariants (T7 correction)', () => {
    it('selects the widest WebP when both WebP and AVIF variants exist (no invariant error)', () => {
      const d = resolver.resolveImage(imageInput(), 'en');
      expect(d.url).toBe('https://media.test/k/1920-webp.webp');
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('raises a controlled internal error for an AVIF-only image (never an AVIF primary URL)', () => {
      const avifOnly = imageInput({
        variants: [
          {
            format: MediaVariantFormat.AVIF,
            width: 1920,
            height: 1080,
            storageKey: 'k/1920-avif.avif',
          },
        ],
      });

      expect(() => resolver.resolveImage(avifOnly, 'en')).toThrow(
        /invariant violated/i,
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'media.descriptor_invariant_violation',
          assetId: 'img-1',
          reason: expect.stringContaining('WebP'),
        }),
        expect.any(String),
      );
    });

    it('raises a controlled internal error when width or height is missing (never a 0 dimension)', () => {
      expect(() =>
        resolver.resolveImage(imageInput({ width: null }), 'en'),
      ).toThrow(/invariant violated/i);
      expect(() =>
        resolver.resolveImage(imageInput({ height: null }), 'en'),
      ).toThrow(/invariant violated/i);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'media.descriptor_invariant_violation',
          reason: expect.stringContaining('width/height'),
        }),
        expect.any(String),
      );
    });
  });

  describe('resolvePdf', () => {
    it('builds the PDF descriptor with URL, filename, and size only', () => {
      const d = resolver.resolvePdf(pdfInput());
      expect(d).toEqual({
        id: 'pdf-1',
        kind: MediaKind.PDF,
        url: 'https://media.test/k/document.pdf',
        filename: 'resume.pdf',
        sizeBytes: 54_321,
      });
    });

    it('has no variants, dimensions, or blurhash', () => {
      const d = resolver.resolvePdf(pdfInput());
      expect(Object.keys(d).sort()).toEqual([
        'filename',
        'id',
        'kind',
        'sizeBytes',
        'url',
      ]);
    });
  });
});
