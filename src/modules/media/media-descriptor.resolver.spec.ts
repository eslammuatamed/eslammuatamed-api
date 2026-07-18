import { MediaKind, MediaVariantFormat } from '@prisma/client';
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
  const resolver = new MediaDescriptorResolver(storage);

  describe('resolveImage', () => {
    it('builds the image descriptor with the widest WebP as the primary URL', () => {
      const d = resolver.resolveImage(imageInput(), 'en');
      expect(d.id).toBe('img-1');
      expect(d.kind).toBe(MediaKind.IMAGE);
      expect(d.url).toBe('https://media.test/k/1920-webp.webp'); // widest WebP, not AVIF, not master
      expect(d.width).toBe(2400);
      expect(d.height).toBe(1350);
      expect(d.blurhash).toBe('LEHV6nWB');
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
