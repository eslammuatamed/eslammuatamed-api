import { UnprocessableEntityException } from '@nestjs/common';
import sharp from 'sharp';
import { MediaProcessingService } from './media-processing.service';
import {
  MASTER_QUALITY,
  QUALITY_LADDER,
  RENDITION_WIDTHS,
} from './media-processing.constants';

// ── Fixture helpers (real Sharp-generated buffers so the magic-byte sniff sees real formats) ─────

const solid = (
  width: number,
  height: number,
  color = { r: 40, g: 90, b: 160 },
) =>
  sharp({
    create: { width, height, channels: 3, background: color },
  });

const solidJpeg = (w: number, h: number) => solid(w, h).jpeg().toBuffer();
const solidPng = (w: number, h: number) => solid(w, h).png().toBuffer();
const solidWebp = (w: number, h: number) =>
  solid(w, h).webp({ quality: 80 }).toBuffer();
const solidAvif = (w: number, h: number) =>
  solid(w, h).avif({ quality: 50 }).toBuffer();

// Deterministic high-entropy noise via a seeded LCG — incompressible, so it blows every budget even
// at the quality floor (used for the overBudget path).
const noisePng = (width: number, height: number, seed: number) => {
  const channels = 3;
  const raw = Buffer.allocUnsafe(width * height * channels);
  let state = seed >>> 0;
  for (let i = 0; i < raw.length; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    raw[i] = state & 0xff;
  }
  return sharp(raw, { raw: { width, height, channels } }).png().toBuffer();
};

const VALID_PDF = Buffer.from(
  [
    '%PDF-1.4',
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj',
    'trailer<</Root 1 0 R/Size 4>>',
    '%%EOF',
    '',
  ].join('\n'),
  'latin1',
);

describe('MediaProcessingService', () => {
  const service = new MediaProcessingService();

  describe('image validation (doc 19 §5, D19-6/9)', () => {
    it.each(['jpeg', 'png', 'webp', 'avif'] as const)(
      'accepts a real %s image',
      async (format) => {
        const buffers = {
          jpeg: () => solidJpeg(120, 80),
          png: () => solidPng(120, 80),
          webp: () => solidWebp(120, 80),
          avif: () => solidAvif(120, 80),
        };
        const result = await service.processImage(await buffers[format]());
        expect(result.kind).toBe('IMAGE');
      },
    );

    it('rejects a GIF (dropped — D19-9)', async () => {
      const gif = await solid(16, 16).gif().toBuffer();
      await expect(service.processImage(gif)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });

    it('rejects an SVG (forbidden — D19-6; no magic bytes)', async () => {
      const svg = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>',
      );
      await expect(service.processImage(svg)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });

    it('rejects a spoofed non-image (arbitrary bytes)', async () => {
      const text = Buffer.from('this is definitely not an image file');
      await expect(service.processImage(text)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });

    it('rejects a PDF renamed as an image (magic bytes win over extension)', async () => {
      await expect(service.processImage(VALID_PDF)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });
  });

  describe('40 MP decoded-pixel ceiling (D19-9, Q2)', () => {
    it('accepts an image at exactly 40,000,000 px', async () => {
      const at = await solidPng(8000, 5000); // 40,000,000
      const result = await service.processImage(at);
      expect(result.master.width).toBe(8000);
      expect(result.master.height).toBe(5000);
    }, 60000);

    it('rejects an image above 40,000,000 px before processing', async () => {
      const over = await solidPng(8000, 5001); // 40,008,000
      await expect(service.processImage(over)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    }, 60000);
  });

  describe('sanitization (doc 07 §6, doc 19 §5)', () => {
    it('auto-orients from EXIF orientation (dimensions swap for a rotated image)', async () => {
      const oriented = await solid(120, 60)
        .withMetadata({ orientation: 6 }) // 90° — display dims become 60×120
        .jpeg()
        .toBuffer();
      const result = await service.processImage(oriented);
      expect(result.master.width).toBe(60);
      expect(result.master.height).toBe(120);
    });

    it('strips all metadata / embedded payloads from the master', async () => {
      const withExif = await solid(64, 64)
        .withExif({ IFD0: { ImageDescription: 'do-not-leak' } })
        .jpeg()
        .toBuffer();
      const result = await service.processImage(withExif);
      const masterMeta = await sharp(result.master.buffer).metadata();
      expect(masterMeta.exif).toBeUndefined();
    });
  });

  describe('canonical master (doc 07 §6, doc 20 §4)', () => {
    it('produces a WebP-q90 master at the full source dimensions', async () => {
      const result = await service.processImage(await solidJpeg(800, 600));
      expect(result.master.mimeType).toBe('image/webp');
      expect(result.master.quality).toBe(MASTER_QUALITY);
      expect(result.master.width).toBe(800);
      expect(result.master.height).toBe(600);
      const masterMeta = await sharp(result.master.buffer).metadata();
      expect(masterMeta.format).toBe('webp');
      expect(result.master.sizeBytes).toBe(result.master.buffer.length);
    });

    it('never returns the raw upload as the master', async () => {
      const raw = await solidJpeg(300, 200);
      const result = await service.processImage(raw);
      expect(result.master.buffer.equals(raw)).toBe(false);
      const masterMeta = await sharp(result.master.buffer).metadata();
      expect(masterMeta.format).toBe('webp'); // not the input JPEG
    });
  });

  describe('renditions (doc 20 §4, D20-6)', () => {
    it('generates every width ≤ master width × WebP + AVIF', async () => {
      const result = await service.processImage(await solidPng(2000, 1000));
      const widths = [...new Set(result.variants.map((v) => v.width))].sort(
        (a, b) => a - b,
      );
      expect(widths).toEqual([...RENDITION_WIDTHS]); // 640, 1280, 1920
      for (const width of RENDITION_WIDTHS) {
        const formats = result.variants
          .filter((v) => v.width === width)
          .map((v) => v.format)
          .sort();
        expect(formats).toEqual(['avif', 'webp']);
      }
    }, 30000);

    it('never upscales beyond the master width', async () => {
      // 1000 px master → only the 640 tier qualifies (1280/1920 exceed it).
      const result = await service.processImage(await solidPng(1000, 700));
      expect(result.variants.every((v) => v.width <= 1000)).toBe(true);
      expect([...new Set(result.variants.map((v) => v.width))]).toEqual([640]);
    });

    it('yields exactly one own-width rendition per format for a sub-640 source', async () => {
      const result = await service.processImage(await solidPng(400, 300));
      expect(result.variants.map((v) => v.width)).toEqual([400, 400]);
      expect(result.variants.map((v) => v.format).sort()).toEqual([
        'avif',
        'webp',
      ]);
      // Height preserved by aspect ratio (400×300 → 400×300).
      expect(result.variants.every((v) => v.height === 300)).toBe(true);
    });

    it('carries the correct per-format mime type on each variant', async () => {
      const result = await service.processImage(await solidPng(700, 500));
      for (const variant of result.variants) {
        expect(variant.mimeType).toBe(
          variant.format === 'webp' ? 'image/webp' : 'image/avif',
        );
        expect(variant.sizeBytes).toBe(variant.buffer.length);
      }
    });

    it('keeps an easily-compressible rendition in budget at the start quality', async () => {
      const result = await service.processImage(await solidPng(2000, 1000));
      for (const variant of result.variants) {
        expect(variant.overBudget).toBe(false);
        expect(variant.quality).toBe(QUALITY_LADDER[variant.format].start);
      }
    }, 30000);

    it('keeps an over-budget rendition at the quality floor and flags it (never fails)', async () => {
      // High-entropy noise that, even at the WebP floor (q55), overruns the 640 budget (90 KB) —
      // the master is WebP-q90, so renditions of a smooth photo would compress far under budget;
      // only genuinely incompressible content exercises the overBudget path (D20-6).
      const result = await service.processImage(await noisePng(640, 640, 7));
      const webp640 = result.variants.find(
        (v) => v.width === 640 && v.format === 'webp',
      );
      expect(webp640).toBeDefined();
      expect(webp640?.overBudget).toBe(true);
      expect(webp640?.quality).toBe(QUALITY_LADDER.webp.floor); // 55, not a failed upload
      expect(webp640?.buffer.length).toBeGreaterThan(0); // kept, not dropped
    }, 30000);
  });

  describe('blurhash (doc 09, doc 20 §4)', () => {
    it('produces a non-empty blurhash sampled from the master, deterministically', async () => {
      const raw = await solidJpeg(500, 400);
      const first = await service.processImage(raw);
      const second = await service.processImage(raw);
      expect(typeof first.blurhash).toBe('string');
      expect(first.blurhash.length).toBeGreaterThan(6);
      expect(first.blurhash).toBe(second.blurhash);
    });
  });

  describe('PDF validation (doc 19 §5, D19-9 — resume only)', () => {
    it('accepts a valid PDF and returns it untouched (no Sharp, no variants)', async () => {
      const result = await service.processPdf(VALID_PDF, 'My Résumé.pdf');
      expect(result.kind).toBe('PDF');
      expect(result.mimeType).toBe('application/pdf');
      expect(result.buffer.equals(VALID_PDF)).toBe(true);
      expect(result.sizeBytes).toBe(VALID_PDF.length);
      expect(result.originalFilename).toBe('My_Resume.pdf');
      // No image surface exists on the PDF result shape.
      expect('variants' in result).toBe(false);
      expect('blurhash' in result).toBe(false);
    });

    it('rejects a non-.pdf extension (mismatched/renamed)', async () => {
      await expect(
        service.processPdf(VALID_PDF, 'resume.txt'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('rejects a JPEG renamed to .pdf (magic bytes win)', async () => {
      const jpeg = await solidJpeg(50, 50);
      await expect(
        service.processPdf(jpeg, 'resume.pdf'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('rejects a truncated PDF (no %%EOF)', async () => {
      const truncated = VALID_PDF.subarray(0, VALID_PDF.length - 8);
      await expect(
        service.processPdf(truncated, 'resume.pdf'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('rejects a PDF above the 10 MiB upload cap', async () => {
      // A %PDF- header + %%EOF trailer around >10 MiB of filler.
      const filler = Buffer.alloc(10 * 1024 * 1024 + 1, 0x20);
      const big = Buffer.concat([
        Buffer.from('%PDF-1.4\n', 'latin1'),
        filler,
        Buffer.from('\n%%EOF\n', 'latin1'),
      ]);
      await expect(
        service.processPdf(big, 'resume.pdf'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });
});
