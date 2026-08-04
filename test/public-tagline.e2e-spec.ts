import { createHash } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { loadApiSpec } from './utils/contract';
import { createE2eApp, envelopeData, httpServer } from './utils/e2e-app';

// Approved public tagline — seed adoption guard.
//
// The expected side is a LITERAL recorded independently of `prisma/content/public-tagline.ts`,
// from the governing document (eslammuatamed-docs @ 393c3897d02d65c18c1066288e53911aa71ec5f8,
// content/positioning-strategy.md §2/§3, Approved v2.0.0). Importing the seed's own module would
// prove self-consistency and nothing about the approved wording — the same reason the About guard
// records its digests separately. Values are read back from a seeded database, so this covers the
// seed end to end.
//
// The approved title is TWO LINES and is kept in English in both locales (§2/§3), so the newline
// is part of the guarded bytes and `en` and `ar` hold the same string by decision. Per-locale
// resolution is proven below on a field that genuinely differs.
//
// A failure means the seeded bytes and the approved title have diverged: fix the transcription,
// never these constants, unless the owner has approved new wording — which is a Docs change first.

interface TaglineExpectation {
  readonly locale: 'en' | 'ar';
  readonly text: string;
  readonly sha256: string;
  readonly chars: number;
}

const EXPECTED: readonly TaglineExpectation[] = [
  {
    locale: 'en',
    text: 'Full-Stack JavaScript\nProduct Engineer',
    sha256: 'a52665a69e97c6f2bc409ce35b6a1b5e10e6aa30decc50a1ac5c4f00b677665c',
    chars: 38,
  },
  {
    locale: 'ar',
    text: 'Full-Stack JavaScript\nProduct Engineer',
    sha256: 'a52665a69e97c6f2bc409ce35b6a1b5e10e6aa30decc50a1ac5c4f00b677665c',
    chars: 38,
  },
];

/** The superseded values. Present anywhere is a regression, not merely stale data. */
const SUPERSEDED = [
  'Frontend Engineer — Vue.js & Nuxt.js',
  'مهندس واجهات أمامية — Vue.js و Nuxt.js',
  'JavaScript Product Engineer — Frontend Engineer specializing in Vue.js & Nuxt.js',
  'مهندس برمجيات للمنتجات — متخصص في هندسة الواجهات الأمامية باستخدام Vue.js وNuxt.js',
];

const sha256 = (value: string): string =>
  createHash('sha256').update(value, 'utf8').digest('hex');

interface PublicSettings {
  tagline: string | null;
  siteName: string | null;
  availabilityStatus: string | null;
}

describe('Public tagline seed adoption (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let prisma: PrismaService;

  beforeAll(async () => {
    loadApiSpec();
    app = await createE2eApp();
    server = httpServer(app);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(EXPECTED)(
    'stores the approved $locale tagline byte for byte',
    async ({ locale, text, sha256: expectedHash, chars }) => {
      const settings = await prisma.siteSettings.findFirst({
        select: { id: true },
      });
      expect(settings).not.toBeNull();

      const translation = await prisma.siteSettingsTranslation.findFirst({
        where: { siteSettingsId: settings!.id, locale },
        select: { tagline: true },
      });

      expect(translation?.tagline).toBe(text);
      expect(sha256(translation!.tagline!)).toBe(expectedHash);
      expect([...translation!.tagline!].length).toBe(chars);
    },
  );

  it.each(EXPECTED)(
    'serves the approved $locale tagline on the public settings endpoint',
    async ({ locale, text }) => {
      const res = await request(server)
        .get(`/api/v1/settings/site?locale=${locale}`)
        .expect(200);
      expect(res).toSatisfyApiSpec();

      expect(envelopeData<PublicSettings>(res).tagline).toBe(text);
    },
  );

  it('no longer carries either superseded title in any locale', async () => {
    const translations = await prisma.siteSettingsTranslation.findMany({
      select: { locale: true, tagline: true },
    });

    expect(translations.length).toBeGreaterThan(0);
    for (const { tagline } of translations) {
      for (const stale of SUPERSEDED) {
        expect(tagline).not.toBe(stale);
      }
    }
  });

  it('keeps the professional title in English in both locales, without collapsing locale resolution', async () => {
    const [en, ar] = await Promise.all(
      (['en', 'ar'] as const).map(async (locale) =>
        envelopeData<PublicSettings>(
          await request(server)
            .get(`/api/v1/settings/site?locale=${locale}`)
            .expect(200),
        ),
      ),
    );

    // Identical BY DECISION (§2/§3): the professional title stays in English on the Arabic site.
    expect(en!.tagline).toBe(ar!.tagline);

    // ...which is why the no-cross-locale-fallback proof moves to a field that really is
    // per-locale. If resolution were falling back, this would collapse too (D10-12).
    expect(en!.availabilityStatus).toBeTruthy();
    expect(ar!.availabilityStatus).toBeTruthy();
    expect(en!.availabilityStatus).not.toBe(ar!.availabilityStatus);
  });

  it('stores the two-line title as one governed value carrying its approved break', async () => {
    const settings = await prisma.siteSettings.findFirst({
      select: { id: true },
    });
    const translation = await prisma.siteSettingsTranslation.findFirst({
      where: { siteSettingsId: settings!.id, locale: 'en' },
      select: { tagline: true },
    });

    // The line break is approved copy, not formatting the hero invents for itself (§8).
    expect(translation!.tagline!.split('\n')).toEqual([
      'Full-Stack JavaScript',
      'Product Engineer',
    ]);
  });
});
