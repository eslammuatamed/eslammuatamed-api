import { UnprocessableEntityException } from '@nestjs/common';
import sharp from 'sharp';
import {
  MASTER_QUALITY,
  QUALITY_LADDER,
  RENDITION_WIDTHS,
} from './media-processing.constants';
import { MediaProcessingService } from './media-processing.service';
import { ProcessImageInput, ProcessPdfInput } from './media-processing.types';

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

const image = (
  buffer: Buffer,
  originalFilename: string,
  declaredMimeType: string,
): ProcessImageInput => ({ buffer, originalFilename, declaredMimeType });

// Consistent (filename + declared MIME agree with the real bytes) inputs for the happy paths.
const jpegImage = async (w: number, h: number) =>
  image(await solidJpeg(w, h), 'photo.jpg', 'image/jpeg');
const pngImage = async (w: number, h: number) =>
  image(await solidPng(w, h), 'photo.png', 'image/png');
const webpImage = async (w: number, h: number) =>
  image(await solidWebp(w, h), 'photo.webp', 'image/webp');
const avifImage = async (w: number, h: number) =>
  image(await solidAvif(w, h), 'photo.avif', 'image/avif');

const pdf = (
  buffer: Buffer,
  originalFilename = 'resume.pdf',
  declaredMimeType = 'application/pdf',
): ProcessPdfInput => ({ buffer, originalFilename, declaredMimeType });

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

  describe('image type validation (magic bytes + extension + declared MIME — doc 19 §5)', () => {
    it.each(['jpeg', 'png', 'webp', 'avif'] as const)(
      'accepts a real %s image with a consistent extension and declared MIME',
      async (format) => {
        const inputs = {
          jpeg: () => jpegImage(120, 80),
          png: () => pngImage(120, 80),
          webp: () => webpImage(120, 80),
          avif: () => avifImage(120, 80),
        };
        const result = await service.processImage(await inputs[format]());
        expect(result.kind).toBe('IMAGE');
      },
    );

    it('accepts a JPEG named .jpg', async () => {
      const input = image(
        await solidJpeg(60, 60),
        'headshot.jpg',
        'image/jpeg',
      );
      await expect(service.processImage(input)).resolves.toMatchObject({
        kind: 'IMAGE',
      });
    });

    it('accepts a JPEG named .jpeg (deliberate alias)', async () => {
      const input = image(
        await solidJpeg(60, 60),
        'headshot.jpeg',
        'image/jpeg',
      );
      await expect(service.processImage(input)).resolves.toMatchObject({
        kind: 'IMAGE',
      });
    });

    it('matches the extension case-insensitively (uppercase .JPG)', async () => {
      const input = image(
        await solidJpeg(60, 60),
        'HEADSHOT.JPG',
        'image/jpeg',
      );
      await expect(service.processImage(input)).resolves.toMatchObject({
        kind: 'IMAGE',
      });
    });

    it('rejects a GIF (dropped — D19-9)', async () => {
      const gif = await solid(16, 16).gif().toBuffer();
      await expect(
        service.processImage(image(gif, 'anim.gif', 'image/gif')),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('rejects an SVG (forbidden — D19-6; no magic bytes)', async () => {
      const svg = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>',
      );
      await expect(
        service.processImage(image(svg, 'vector.svg', 'image/svg+xml')),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('rejects a spoofed non-image (arbitrary bytes)', async () => {
      const text = Buffer.from('this is definitely not an image file');
      await expect(
        service.processImage(image(text, 'photo.jpg', 'image/jpeg')),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('rejects JPEG bytes named .png (extension does not match magic bytes)', async () => {
      const jpeg = await solidJpeg(50, 50);
      await expect(
        service.processImage(image(jpeg, 'photo.png', 'image/jpeg')),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('rejects PNG bytes declared as image/jpeg (declared MIME does not match magic bytes)', async () => {
      const png = await solidPng(50, 50);
      await expect(
        service.processImage(image(png, 'image.png', 'image/jpeg')),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('rejects valid image bytes with an unsupported extension', async () => {
      const jpeg = await solidJpeg(50, 50);
      await expect(
        service.processImage(image(jpeg, 'photo.bmp', 'image/jpeg')),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('lets magic bytes win over a consistent-but-wrong extension AND declared MIME', async () => {
      // PNG bytes, but both hints claim JPEG — the sniff still rejects it.
      const png = await solidPng(50, 50);
      await expect(
        service.processImage(image(png, 'photo.jpg', 'image/jpeg')),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('rejects a PDF renamed and declared as an image (magic bytes authoritative)', async () => {
      await expect(
        service.processImage(image(VALID_PDF, 'photo.jpg', 'image/jpeg')),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  describe('40 MP decoded-pixel ceiling (D19-9, Q2)', () => {
    it('accepts an image at exactly 40,000,000 px', async () => {
      const at = image(await solidPng(8000, 5000), 'big.png', 'image/png');
      const result = await service.processImage(at);
      expect(result.master.width).toBe(8000);
      expect(result.master.height).toBe(5000);
    }, 60000);

    it('rejects an image above 40,000,000 px before processing', async () => {
      const over = image(await solidPng(8000, 5001), 'big.png', 'image/png');
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
      const result = await service.processImage(
        image(oriented, 'photo.jpg', 'image/jpeg'),
      );
      expect(result.master.width).toBe(60);
      expect(result.master.height).toBe(120);
    });

    it('strips all metadata / embedded payloads from the master', async () => {
      const withExif = await solid(64, 64)
        .withExif({ IFD0: { ImageDescription: 'do-not-leak' } })
        .jpeg()
        .toBuffer();
      const result = await service.processImage(
        image(withExif, 'photo.jpg', 'image/jpeg'),
      );
      const masterMeta = await sharp(result.master.buffer).metadata();
      expect(masterMeta.exif).toBeUndefined();
    });
  });

  describe('canonical master (doc 07 §6, doc 20 §4)', () => {
    it('produces a WebP-q90 master at the full source dimensions', async () => {
      const result = await service.processImage(await jpegImage(800, 600));
      expect(result.master.mimeType).toBe('image/webp');
      expect(result.master.quality).toBe(MASTER_QUALITY);
      expect(result.master.width).toBe(800);
      expect(result.master.height).toBe(600);
      const masterMeta = await sharp(result.master.buffer).metadata();
      expect(masterMeta.format).toBe('webp');
      expect(result.master.sizeBytes).toBe(result.master.buffer.length);
    });

    it('never returns the raw upload as the master', async () => {
      const input = await jpegImage(300, 200);
      const result = await service.processImage(input);
      expect(result.master.buffer.equals(input.buffer)).toBe(false);
      const masterMeta = await sharp(result.master.buffer).metadata();
      expect(masterMeta.format).toBe('webp'); // not the input JPEG
    });
  });

  describe('renditions (doc 20 §4, D20-6)', () => {
    it('generates every width ≤ master width × WebP + AVIF', async () => {
      const result = await service.processImage(await pngImage(2000, 1000));
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
      // 1000 px master → the 640 tier qualifies; 1280/1920 exceed it. Since 1000 falls strictly
      // between two configured tiers it also gets a D20-20 terminal rendition at its own width —
      // which is still, by construction, no upscale.
      const result = await service.processImage(await pngImage(1000, 700));
      expect(result.variants.every((v) => v.width <= 1000)).toBe(true);
      expect(
        [...new Set(result.variants.map((v) => v.width))].sort((a, b) => a - b),
      ).toEqual([640, 1000]);
    }, 30000);

    // ── D20-20: source-bound terminal renditions ────────────────────────────────────────────────
    // The whole rule as one table. Each case states the source width and the public widths it must
    // produce; the boundary cases (equal to a tier, above the ceiling) are what keep the rule from
    // over-firing. 3:2 aspect throughout so heights are unambiguous.
    describe('source-bound terminal renditions (D20-20)', () => {
      const cases: ReadonlyArray<{
        readonly source: number;
        readonly expected: readonly number[];
        readonly why: string;
      }> = [
        { source: 400, expected: [400], why: 'below the smallest tier' },
        { source: 640, expected: [640], why: 'exactly a tier — no duplicate' },
        { source: 1086, expected: [640, 1086], why: 'strictly between tiers' },
        {
          source: 1280,
          expected: [640, 1280],
          why: 'exactly a tier — no duplicate',
        },
        {
          source: 1700,
          expected: [640, 1280, 1700],
          why: 'strictly between tiers',
        },
        {
          source: 1920,
          expected: [640, 1280, 1920],
          why: 'exactly the largest tier — no duplicate',
        },
        {
          source: 2400,
          expected: [640, 1280, 1920],
          why: 'above the ceiling — no terminal rendition',
        },
      ];

      it.each(cases)(
        'a $source px source yields widths $expected ($why)',
        async ({ source, expected }) => {
          const height = Math.round((source * 2) / 3);
          const result = await service.processImage(
            await pngImage(source, height),
          );

          const widths = [...new Set(result.variants.map((v) => v.width))].sort(
            (a, b) => a - b,
          );
          expect(widths).toEqual([...expected]);

          // Deterministic ascending plan, no duplicate width, never enlarged.
          expect(widths).toEqual([...widths].sort((a, b) => a - b));
          expect(new Set(widths).size).toBe(widths.length);
          expect(widths.every((w) => w <= source)).toBe(true);

          // Every planned width exists in BOTH public formats — the terminal tier is not special.
          for (const width of expected) {
            const formats = result.variants
              .filter((v) => v.width === width)
              .map((v) => v.format)
              .sort();
            expect(formats).toEqual(['avif', 'webp']);
          }
        },
        60000,
      );

      // The defect this whole change exists to fix.
      it('gives the 1086 px portrait a real 1086 rendition rather than a 640 ceiling', async () => {
        const result = await service.processImage(await pngImage(1086, 1448));
        const widths = [...new Set(result.variants.map((v) => v.width))].sort(
          (a, b) => a - b,
        );
        expect(widths).toEqual([640, 1086]);
        expect(widths).not.toContain(1280); // never invented
      }, 30000);

      // Truthfulness is the point: a descriptor width that does not match its own bytes would
      // reintroduce the falsely-labelled source, just at a different width.
      it('reports widths read back from the encoded bytes, not the requested target', async () => {
        const result = await service.processImage(await pngImage(1086, 1448));
        for (const variant of result.variants) {
          const meta = await sharp(variant.buffer).metadata();
          expect(meta.width).toBe(variant.width);
          expect(meta.height).toBe(variant.height);
        }
      }, 30000);

      it('measures the terminal rendition against the next tier up, not the tier below', async () => {
        // 1086 sits between 640 (90 KB WebP) and 1280 (150 KB WebP). Against the 640 row a
        // legitimate 1086 rendition could be pushed down the quality ladder or flagged overBudget;
        // against 1280 it passes at start quality. A smooth solid image must not be over budget.
        const result = await service.processImage(await pngImage(1086, 1448));
        const terminal = result.variants.filter((v) => v.width === 1086);
        expect(terminal).toHaveLength(2);
        expect(terminal.every((v) => v.overBudget)).toBe(false);
        expect(terminal.find((v) => v.format === 'webp')?.quality).toBe(
          QUALITY_LADDER.webp.start,
        );
      }, 30000);
    });

    it('yields exactly one own-width rendition per format for a sub-640 source', async () => {
      const result = await service.processImage(await pngImage(400, 300));
      expect(result.variants.map((v) => v.width)).toEqual([400, 400]);
      expect(result.variants.map((v) => v.format).sort()).toEqual([
        'avif',
        'webp',
      ]);
      // Height preserved by aspect ratio (400×300 → 400×300).
      expect(result.variants.every((v) => v.height === 300)).toBe(true);
    });

    it('carries the correct per-format mime type on each variant', async () => {
      const result = await service.processImage(await pngImage(700, 500));
      for (const variant of result.variants) {
        expect(variant.mimeType).toBe(
          variant.format === 'webp' ? 'image/webp' : 'image/avif',
        );
        expect(variant.sizeBytes).toBe(variant.buffer.length);
      }
    });

    it('keeps an easily-compressible rendition in budget at the start quality', async () => {
      const result = await service.processImage(await pngImage(2000, 1000));
      for (const variant of result.variants) {
        expect(variant.overBudget).toBe(false);
        expect(variant.quality).toBe(QUALITY_LADDER[variant.format].start);
      }
    }, 30000);

    it('keeps an over-budget rendition at the quality floor and flags it (never fails)', async () => {
      // High-entropy noise that, even at the WebP floor (q55), overruns the 640 budget (90 KB) —
      // the master is WebP-q90, so renditions of a smooth photo would compress far under budget;
      // only genuinely incompressible content exercises the overBudget path (D20-6).
      const result = await service.processImage(
        image(await noisePng(640, 640, 7), 'noise.png', 'image/png'),
      );
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
      const input = await jpegImage(500, 400);
      const first = await service.processImage(input);
      const second = await service.processImage(input);
      expect(typeof first.blurhash).toBe('string');
      expect(first.blurhash.length).toBeGreaterThan(6);
      expect(first.blurhash).toBe(second.blurhash);
    });
  });

  describe('PDF validation (magic bytes + extension + declared MIME + integrity — doc 19 §5)', () => {
    it('accepts a valid PDF and returns it untouched (no Sharp, no variants)', async () => {
      const result = await service.processPdf(
        pdf(VALID_PDF, 'My Résumé.pdf', 'application/pdf'),
      );
      expect(result.kind).toBe('PDF');
      expect(result.mimeType).toBe('application/pdf');
      expect(result.buffer.equals(VALID_PDF)).toBe(true);
      expect(result.sizeBytes).toBe(VALID_PDF.length);
      expect(result.originalFilename).toBe('My_Resume.pdf');
      // No image surface exists on the PDF result shape.
      expect('variants' in result).toBe(false);
      expect('blurhash' in result).toBe(false);
    });

    it('accepts an uppercase .PDF extension', async () => {
      const result = await service.processPdf(
        pdf(VALID_PDF, 'Resume.PDF', 'application/pdf'),
      );
      expect(result.kind).toBe('PDF');
    });

    it('rejects a non-.pdf extension (mismatched/renamed)', async () => {
      await expect(
        service.processPdf(pdf(VALID_PDF, 'resume.txt', 'application/pdf')),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('rejects a valid PDF declared with a non-PDF MIME', async () => {
      await expect(
        service.processPdf(
          pdf(VALID_PDF, 'resume.pdf', 'application/octet-stream'),
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('rejects valid PDF bytes with a non-PDF extension', async () => {
      await expect(
        service.processPdf(pdf(VALID_PDF, 'resume.bin', 'application/pdf')),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('rejects a JPEG renamed and declared as .pdf (magic bytes win)', async () => {
      const jpeg = await solidJpeg(50, 50);
      await expect(
        service.processPdf(pdf(jpeg, 'resume.pdf', 'application/pdf')),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('rejects a truncated PDF (no %%EOF)', async () => {
      const truncated = VALID_PDF.subarray(0, VALID_PDF.length - 8);
      await expect(
        service.processPdf(pdf(truncated, 'resume.pdf', 'application/pdf')),
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
        service.processPdf(pdf(big, 'resume.pdf', 'application/pdf')),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });
});
