import { createHash } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { loadApiSpec } from './utils/contract';
import { createE2eApp, envelopeData, httpServer } from './utils/e2e-app';

// Governed About copy — seed adoption guard.
//
// The expected side of every assertion below is a LITERAL recorded independently of
// `prisma/content/about-copy.ts`. The digests were taken from the governing document
// (eslammuatamed-docs @ 78bc945d32c8ab37a9a8ebfc3ac957489bd441df,
// content/profile/about-copy.md §5, Approved v1.0.0) and are reproduced here as constants.
// Importing the seed's own module instead would make this suite prove self-consistency and
// nothing about the approved wording — a typo introduced during transcription would pass. The
// values under test are read back from a seeded database, so this covers the seed end to end.
//
// A failure here means the seeded bytes and the governed copy have diverged. about-copy.md §4
// makes the document correct in that case: fix the transcription, never these hashes — unless
// the owner has approved new wording, which is a Docs change first.

interface AboutExpectation {
  readonly locale: 'en' | 'ar';
  readonly field: 'aboutBio' | 'engineeringPhilosophy' | 'currentFocus';
  readonly sha256: string;
  readonly chars: number;
  readonly paragraphs: number;
}

const EXPECTED: readonly AboutExpectation[] = [
  {
    locale: 'en',
    field: 'aboutBio',
    sha256: '83017e59e6a04772cee698b720632ca88be5301375b504d4e3806116c47ccbbc',
    chars: 973,
    paragraphs: 3,
  },
  {
    locale: 'ar',
    field: 'aboutBio',
    sha256: '0f8e23b5d4c11417a5f701386f03d595c111c8ba136a7009e12887b5e02063d5',
    chars: 975,
    paragraphs: 3,
  },
  {
    locale: 'en',
    field: 'engineeringPhilosophy',
    sha256: 'ffbd71d8a487f4b9131521c524957ce388a99455c5204ef3a6eb5ca2898ce397',
    chars: 630,
    paragraphs: 3,
  },
  {
    locale: 'ar',
    field: 'engineeringPhilosophy',
    sha256: '9620ee6c844620da6df04eded917844e4e1b5edf3cd5f4aa29c9aee1de6d0424',
    chars: 523,
    paragraphs: 3,
  },
  {
    locale: 'en',
    field: 'currentFocus',
    sha256: '55253149a54be189923f1ee3bcd3cc4f178872f7be6f284205765e4a5fbcaead',
    chars: 170,
    paragraphs: 1,
  },
  {
    locale: 'ar',
    field: 'currentFocus',
    sha256: '586a6b0434cb52eb18fe7fd9f7d04bf1af33f08389595609ec517dbedcf36d7e',
    chars: 196,
    paragraphs: 1,
  },
];

// Characters that survive a copy-paste unnoticed and would silently alter the approved bytes.
// Bidi controls are the live risk here: the Arabic blocks read identically with or without a
// stray RLM, but the digest changes. The governed copy contains none of these.
const INVISIBLE_CODEPOINTS: ReadonlySet<number> = new Set([
  0x00a0, // NO-BREAK SPACE
  0x00ad, // SOFT HYPHEN
  0x061c, // ARABIC LETTER MARK
  0x180e, // MONGOLIAN VOWEL SEPARATOR
  0x200b, // ZERO WIDTH SPACE
  0x200c, // ZERO WIDTH NON-JOINER
  0x200d, // ZERO WIDTH JOINER
  0x200e, // LEFT-TO-RIGHT MARK
  0x200f, // RIGHT-TO-LEFT MARK
  0x2028, // LINE SEPARATOR
  0x2029, // PARAGRAPH SEPARATOR
  0x202a, // LEFT-TO-RIGHT EMBEDDING
  0x202b, // RIGHT-TO-LEFT EMBEDDING
  0x202c, // POP DIRECTIONAL FORMATTING
  0x202d, // LEFT-TO-RIGHT OVERRIDE
  0x202e, // RIGHT-TO-LEFT OVERRIDE
  0x2060, // WORD JOINER
  0x2066, // LEFT-TO-RIGHT ISOLATE
  0x2067, // RIGHT-TO-LEFT ISOLATE
  0x2068, // FIRST STRONG ISOLATE
  0x2069, // POP DIRECTIONAL ISOLATE
  0xfeff, // ZERO WIDTH NO-BREAK SPACE (BOM)
]);

// Names the invisible characters present in a value, so a failure reports which one crept in
// rather than only that two long strings differ. Matched by codepoint rather than by a regex
// literal: the guard's own source stays pure ASCII and cannot be corrupted by the very class of
// character it exists to catch.
const invisibleIn = (value: string): string[] => [
  ...new Set(
    [...value]
      .map((ch) => ch.codePointAt(0)!)
      .filter((cp) => INVISIBLE_CODEPOINTS.has(cp))
      .map((cp) => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`),
  ),
];

const sha256 = (value: string): string =>
  createHash('sha256').update(value, 'utf8').digest('hex');

interface PublicSettings {
  aboutBio: string | null;
  engineeringPhilosophy: string | null;
  currentFocus: string | null;
  portrait: unknown;
  professionalEmail: string | null;
  contactEmail: string | null;
}

describe('About content seed adoption (e2e)', () => {
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

  describe('stored values match the governed copy byte for byte', () => {
    it.each(EXPECTED)(
      '$field.$locale',
      async ({ locale, field, sha256: expectedHash, chars, paragraphs }) => {
        const settings = await prisma.siteSettings.findFirst({
          select: { id: true },
        });
        expect(settings).not.toBeNull();

        const translation = await prisma.siteSettingsTranslation.findFirst({
          where: { siteSettingsId: settings!.id, locale },
          select: {
            aboutBio: true,
            engineeringPhilosophy: true,
            currentFocus: true,
          },
        });
        expect(translation).not.toBeNull();

        const value = translation![field];
        expect(typeof value).toBe('string');
        expect(sha256(value!)).toBe(expectedHash);
        expect([...value!].length).toBe(chars);
        expect(value!.split('\n\n')).toHaveLength(paragraphs);
        // No rewrapping: paragraphs are single lines separated by one blank line.
        expect(value).not.toMatch(/\n{3,}/);
        expect(value).toBe(value!.trim());
        expect(invisibleIn(value!)).toEqual([]);
      },
    );
  });

  describe('public settings expose the copy without inventing a portrait', () => {
    it.each(['en', 'ar'] as const)(
      'serves locale-complete About content for %s with portrait null',
      async (locale) => {
        const res = await request(server)
          .get(`/api/v1/settings/site?locale=${locale}`)
          .expect(200);
        expect(res).toSatisfyApiSpec();

        const data = envelopeData<PublicSettings>(res);
        const expectedFor = (field: AboutExpectation['field']): string =>
          EXPECTED.find((e) => e.locale === locale && e.field === field)!
            .sha256;

        expect(sha256(data.aboutBio!)).toBe(expectedFor('aboutBio'));
        expect(sha256(data.engineeringPhilosophy!)).toBe(
          expectedFor('engineeringPhilosophy'),
        );
        expect(sha256(data.currentFocus!)).toBe(expectedFor('currentFocus'));

        // The seed never invents a MediaAsset for the portrait (D18-7); publication readiness
        // stays blocked on a real upload rather than on a placeholder.
        expect(data.portrait).toBeNull();
      },
    );

    it('resolves each locale independently, with no cross-locale fallback', async () => {
      const [en, ar] = await Promise.all(
        (['en', 'ar'] as const).map(async (locale) =>
          envelopeData<PublicSettings>(
            await request(server)
              .get(`/api/v1/settings/site?locale=${locale}`)
              .expect(200),
          ),
        ),
      );

      expect(en!.aboutBio).not.toBe(ar!.aboutBio);
      expect(en!.engineeringPhilosophy).not.toBe(ar!.engineeringPhilosophy);
      expect(en!.currentFocus).not.toBe(ar!.currentFocus);
    });

    it('never exposes the dashboard authentication address', async () => {
      const res = await request(server)
        .get('/api/v1/settings/site?locale=en')
        .expect(200);

      const body = JSON.stringify(res.body);

      // The seeded OWNER login must never appear in a public response (D18-7).
      expect(body).not.toContain(
        process.env.SEED_OWNER_EMAIL ?? 'owner@example.com',
      );

      // The never-public addresses are banned outright now, which this comment previously said was
      // impossible. It cited R5 and claimed `seed.dev.ts` published an approved personal address
      // through `profileLinks`, so a domain ban "would fail on a dev-seeded database". Both halves
      // have since stopped being true: `e51c79e` removed `profileLinks` from `seed.dev.ts` when it
      // moved to the canonical dataset — neither seed writes a `profileLinks` or any Gmail now —
      // and R10 superseded R5's reading on 2026-07-29, with R15 (2026-08-05) naming this exact
      // field. The obstacle was real when written and is gone; keeping the weaker assertion would
      // have declined a stronger check on obsolete grounds.
      expect(body).not.toContain('eslammuatemed@gmail.com');
      expect(body).not.toContain('admin@eslammuatamed.com');

      const data = envelopeData<PublicSettings>(res);
      expect(data.professionalEmail).toBe('hello@eslammuatamed.com');
      expect(data.contactEmail).toBe('contact@eslammuatamed.com');
    });
  });

  describe('portrait slot', () => {
    it('leaves portraitAssetId null and creates no media asset for it', async () => {
      const settings = await prisma.siteSettings.findFirst({
        select: { portraitAssetId: true },
      });
      expect(settings?.portraitAssetId).toBeNull();
    });
  });
});
