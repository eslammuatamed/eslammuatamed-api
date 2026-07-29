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
// from the governing document (eslammuatamed-docs @ 64a0f07510171083d2c7c3b533a8d9bd3d78e198,
// content/positioning-strategy.md §2/§3, Approved v1.1.0). Importing the seed's own module would
// prove self-consistency and nothing about the approved wording — the same reason the About guard
// records its digests separately. Values are read back from a seeded database, so this covers the
// seed end to end.
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
    text: 'JavaScript Product Engineer — Frontend Engineer specializing in Vue.js & Nuxt.js',
    sha256: 'c5591132681f71a1e5fe1f156c599934da6b76616cac3b168ed52ea2d998471d',
    chars: 80,
  },
  {
    locale: 'ar',
    text: 'مهندس برمجيات للمنتجات — متخصص في هندسة الواجهات الأمامية باستخدام Vue.js وNuxt.js',
    sha256: 'ef6bf3a332d9721eb36ded90379c6b53b8ef74777cbf0e06467bf295ad4c1e87',
    chars: 82,
  },
];

/** The superseded values. Present anywhere is a regression, not merely stale data. */
const SUPERSEDED = [
  'Frontend Engineer — Vue.js & Nuxt.js',
  'مهندس واجهات أمامية — Vue.js و Nuxt.js',
];

const sha256 = (value: string): string =>
  createHash('sha256').update(value, 'utf8').digest('hex');

interface PublicSettings {
  tagline: string | null;
  siteName: string | null;
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

  it('resolves the tagline per locale with no cross-locale fallback', async () => {
    const [en, ar] = await Promise.all(
      (['en', 'ar'] as const).map(async (locale) =>
        envelopeData<PublicSettings>(
          await request(server)
            .get(`/api/v1/settings/site?locale=${locale}`)
            .expect(200),
        ),
      ),
    );

    expect(en!.tagline).not.toBe(ar!.tagline);
  });
});
