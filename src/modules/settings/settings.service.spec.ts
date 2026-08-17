import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  MediaAsset,
  MediaKind,
  MediaVariantFormat,
  SiteSettings,
  SiteSettingsTranslation,
} from '../../generated/prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalesService } from '../locales/locales.service';
import { MediaDescriptorResolver } from '../media/media-descriptor.resolver';
import { StorageAdapter } from '../media/storage/storage-adapter.interface';
import { SettingsService } from './settings.service';

const storage = {
  put: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
  publicUrl: (key: string) => `https://media.test/${key}`,
} as unknown as StorageAdapter;

const pdfAsset = (): MediaAsset => ({
  id: 'resume-1',
  kind: MediaKind.PDF,
  storageKey: 'media/resume-1/document.pdf',
  originalFilename: 'eslam-muatamed-resume.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 90_000,
  contentHash: 'h',
  width: null,
  height: null,
  blurhash: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

type PortraitRow = MediaAsset & {
  variants: {
    format: MediaVariantFormat;
    width: number;
    height: number;
    storageKey: string;
  }[];
  alts: { locale: string; alt: string }[];
};

type SettingsRow = SiteSettings & {
  translations: SiteSettingsTranslation[];
  resumeAsset: MediaAsset | null;
  portraitAsset: PortraitRow | null;
};

// IMAGE asset shaped as the settings include loads it — variants + per-locale alts, so the
// descriptor resolves in the same query (no N+1, doc 10 §6).
const portraitAsset = (
  alts: { locale: string; alt: string }[] = [
    { locale: 'en', alt: 'Portrait of Eslam' },
    { locale: 'ar', alt: 'صورة إسلام' },
  ],
): PortraitRow => ({
  id: 'portrait-1',
  kind: MediaKind.IMAGE,
  storageKey: 'media/portrait-1/master.png',
  originalFilename: 'portrait.png',
  mimeType: 'image/png',
  sizeBytes: 120_000,
  contentHash: 'ph',
  width: 1200,
  height: 1500,
  blurhash: 'LEHV6n',
  createdAt: new Date(),
  updatedAt: new Date(),
  variants: [
    {
      format: MediaVariantFormat.WEBP,
      width: 640,
      height: 800,
      storageKey: 'media/portrait-1/640.webp',
    },
    {
      format: MediaVariantFormat.WEBP,
      width: 1200,
      height: 1500,
      storageKey: 'media/portrait-1/1200.webp',
    },
  ],
  alts,
});

function translation(
  locale: string,
  overrides: Partial<SiteSettingsTranslation> = {},
): SiteSettingsTranslation {
  return {
    id: `t-${locale}`,
    siteSettingsId: 's1',
    locale,
    siteName: `Site ${locale}`,
    tagline: `Tagline ${locale}`,
    availabilityStatus: `Avail ${locale}`,
    defaultMetaTitle: `Title ${locale}`,
    defaultMetaDescription: `Desc ${locale}`,
    aboutBio: `Bio ${locale}`,
    engineeringPhilosophy: `Philosophy ${locale}`,
    currentFocus: `Focus ${locale}`,
    portraitAlt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function settingsRow(overrides: Partial<SettingsRow> = {}): SettingsRow {
  return {
    id: 's1',
    profileLinks: [
      { label: 'GitHub', url: 'https://github.com/x', icon: 'gh' },
    ],
    resumeAssetId: null,
    portraitAssetId: null,
    professionalEmail: 'hello@eslammuatamed.com',
    contactEmail: 'contact@eslammuatamed.com',
    contactPhone: '+201002785408',
    whatsappPhone: '+201002785408',
    careerStartYear: null,
    careerStartMonth: null,
    googleSiteVerification: 'google-token',
    bingSiteVerification: null,
    analyticsEnabled: false,
    gtmContainerId: 'GTM-ABCD123',
    customMetas: [{ name: 'theme-color', content: '#000' }],
    createdAt: new Date(),
    updatedAt: new Date(),
    translations: [translation('en'), translation('ar')],
    resumeAsset: null,
    portraitAsset: null,
    ...overrides,
  };
}

describe('SettingsService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let locales: DeepMockProxy<LocalesService>;
  let service: SettingsService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    locales = mockDeep<LocalesService>();
    service = new SettingsService(
      prisma,
      locales,
      new MediaDescriptorResolver(storage),
    );
  });

  describe('getPublicSettings', () => {
    it('resolves the requested locale and withholds the container when disabled', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(settingsRow());

      const result = await service.getPublicSettings('ar');

      expect(locales.assertEnabled).toHaveBeenCalledWith('ar');
      expect(result.siteName).toBe('Site ar');
      expect(result.tagline).toBe('Tagline ar');
      expect(result.availabilityStatus).toBe('Avail ar');
      // D20-5/D02-14: the row HOLDS a container id; "disabled" is observable as its absence from
      // the public read, not as a flag the client is trusted to honour.
      expect(result.gtmContainerId).toBeNull();
      expect(result.profileLinks).toEqual([
        { label: 'GitHub', url: 'https://github.com/x', icon: 'gh' },
      ]);
      expect(result.availableLocales).toEqual(['ar', 'en']);
      expect(result.careerStartYear).toBeNull();
      expect(result.careerStartMonth).toBeNull();
    });

    it('publishes the GTM container only when tracking is enabled', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(
        settingsRow({ analyticsEnabled: true }),
      );

      const result = await service.getPublicSettings('en');

      expect(result.gtmContainerId).toBe('GTM-ABCD123');
    });

    it('withholds the container when enabled but unconfigured', async () => {
      // Defence in depth against a row that predates the D02-14 migration's invariant repair: the
      // public read must never publish a null container as though it were a real one.
      prisma.siteSettings.findFirst.mockResolvedValue(
        settingsRow({ analyticsEnabled: true, gtmContainerId: null }),
      );

      expect((await service.getPublicSettings('en')).gtmContainerId).toBeNull();
    });

    it('returns nulls for a missing translation without cross-locale fallback', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(
        settingsRow({ translations: [translation('en')] }),
      );

      const result = await service.getPublicSettings('ar');

      expect(result.siteName).toBeNull();
      expect(result.availabilityStatus).toBeNull();
      expect(result.availableLocales).toEqual(['en']);
    });

    it('rejects an unknown locale before resolving', async () => {
      locales.assertEnabled.mockRejectedValue(new BadRequestException());
      await expect(service.getPublicSettings('zz')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('getPublicSettings — résumé descriptor (T7, FR-PUB-023)', () => {
    it('returns resumeAsset: null when no résumé is configured', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(settingsRow());
      const result = await service.getPublicSettings('en');
      expect(result.resumeAsset).toBeNull();
    });

    it('resolves the résumé PDF descriptor (public URL + sanitized filename + size only)', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(
        settingsRow({ resumeAssetId: 'resume-1', resumeAsset: pdfAsset() }),
      );

      const result = await service.getPublicSettings('en');

      expect(result.resumeAsset).toEqual({
        id: 'resume-1',
        kind: MediaKind.PDF,
        url: 'https://media.test/media/resume-1/document.pdf',
        filename: 'eslam-muatamed-resume.pdf',
        sizeBytes: 90_000,
      });
    });

    it('never exposes the bare resumeAssetId or any image/internal metadata', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(
        settingsRow({ resumeAssetId: 'resume-1', resumeAsset: pdfAsset() }),
      );

      const result = await service.getPublicSettings('en');

      // The bare id stays admin-only — not on the public response.
      expect('resumeAssetId' in result).toBe(false);
      // The descriptor exposes only the approved fields.
      expect(Object.keys(result.resumeAsset ?? {}).sort()).toEqual([
        'filename',
        'id',
        'kind',
        'sizeBytes',
        'url',
      ]);
      const serialized = JSON.stringify(result.resumeAsset);
      for (const forbidden of [
        'variants',
        'width',
        'height',
        'blurhash',
        'storageKey',
        'contentHash',
      ]) {
        expect(serialized).not.toContain(forbidden);
      }
    });

    it('leaves the existing public settings fields unchanged', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(
        settingsRow({
          careerStartYear: 2023,
          careerStartMonth: 5,
          resumeAssetId: 'resume-1',
          resumeAsset: pdfAsset(),
        }),
      );

      const result = await service.getPublicSettings('en');

      expect(result.availabilityStatus).toBe('Avail en');
      expect(result.careerStartYear).toBe(2023);
      expect(result.careerStartMonth).toBe(5);
      expect(result.availableLocales).toEqual(['ar', 'en']);
    });
  });

  describe('getAdminSettings', () => {
    it('returns the full per-locale translation map', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(settingsRow());

      const result = await service.getAdminSettings();

      expect(Object.keys(result.translations).sort()).toEqual(['ar', 'en']);
      expect(result.translations.en?.siteName).toBe('Site en');
      // availabilityStatus is per-locale (007): it lives in the translation map, not at the top level.
      expect(result.translations.en?.availabilityStatus).toBe('Avail en');
      expect(result.translations.ar?.availabilityStatus).toBe('Avail ar');
      expect('availabilityStatus' in result).toBe(false);
      expect(result.analyticsEnabled).toBe(false);
      expect(result.careerStartYear).toBeNull();
      expect(result.careerStartMonth).toBeNull();
    });
  });

  describe('updateSettings', () => {
    it('validates every translation locale before writing', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(settingsRow());
      locales.assertEnabled.mockRejectedValueOnce(new BadRequestException());

      await expect(
        service.updateSettings({
          translations: [{ locale: 'zz', siteName: 'x' }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('applies the row update and translation upserts in one transaction', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(settingsRow());
      prisma.$transaction.mockResolvedValue([]);

      await service.updateSettings({
        analyticsEnabled: true,
        translations: [{ locale: 'en', siteName: 'New Name' }],
      });

      expect(locales.assertEnabled).toHaveBeenCalledWith('en');
      expect(prisma.siteSettings.update).toHaveBeenCalled();
      expect(prisma.siteSettingsTranslation.upsert).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('rejects a resumeAssetId that references a non-PDF asset with 422', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(settingsRow());
      prisma.mediaAsset.findUnique.mockResolvedValue({
        kind: MediaKind.IMAGE,
      } as never);

      await expect(
        service.updateSettings({ resumeAssetId: 'image-asset-id' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a resumeAssetId that does not exist with 422', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(settingsRow());
      prisma.mediaAsset.findUnique.mockResolvedValue(null);

      await expect(
        service.updateSettings({ resumeAssetId: 'missing-asset-id' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('connects the resume FK when the asset is a PDF', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(settingsRow());
      prisma.mediaAsset.findUnique.mockResolvedValue({
        kind: MediaKind.PDF,
      } as never);
      prisma.$transaction.mockResolvedValue([]);

      await service.updateSettings({ resumeAssetId: 'pdf-asset-id' });

      expect(prisma.siteSettings.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resumeAsset: { connect: { id: 'pdf-asset-id' } },
          }),
        }),
      );
    });

    it('disconnects the resume FK for null without a PDF lookup (asset retained)', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(settingsRow());
      prisma.$transaction.mockResolvedValue([]);

      await service.updateSettings({ resumeAssetId: null });

      expect(prisma.mediaAsset.findUnique).not.toHaveBeenCalled();
      expect(prisma.siteSettings.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resumeAsset: { disconnect: true },
          }),
        }),
      );
    });

    it('sets both career start fields', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(settingsRow());
      prisma.$transaction.mockResolvedValue([]);

      await service.updateSettings({
        careerStartYear: 2023,
        careerStartMonth: 11,
      });

      expect(prisma.siteSettings.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            careerStartYear: 2023,
            careerStartMonth: 11,
          }),
        }),
      );
    });

    it('rejects a career start month outside 1..12 with 422', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(settingsRow());

      await expect(
        service.updateSettings({ careerStartYear: 2023, careerStartMonth: 13 }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects setting only one career start field with 422', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(settingsRow());

      await expect(
        service.updateSettings({ careerStartYear: 2023 }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('clears both career start fields', async () => {
      prisma.siteSettings.findFirst
        .mockResolvedValueOnce(
          settingsRow({ careerStartYear: 2023, careerStartMonth: 11 }),
        )
        .mockResolvedValueOnce(settingsRow());
      prisma.$transaction.mockResolvedValue([]);

      const result = await service.updateSettings({
        careerStartYear: null,
        careerStartMonth: null,
      });

      expect(prisma.siteSettings.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            careerStartYear: null,
            careerStartMonth: null,
          }),
        }),
      );
      expect(result.careerStartYear).toBeNull();
      expect(result.careerStartMonth).toBeNull();
    });
  });

  // ── Profile contract (D09-18, D10-13) ──────────────────────────────────────────────────────
  describe('profile fields', () => {
    it('exposes both the portrait id and the resolved descriptor, with the PER-USAGE alt', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(
        settingsRow({
          portraitAssetId: 'portrait-1',
          portraitAsset: portraitAsset(),
          translations: [
            translation('en', { portraitAlt: 'Eslam at his desk' }),
            translation('ar', { portraitAlt: 'صورة إسلام' }),
          ],
        }),
      );

      const result = await service.getPublicSettings('ar');

      // The raw id stays available alongside the additive descriptor (D10-10 pattern).
      expect(result.portraitAssetId).toBe('portrait-1');
      expect(result.portrait).toEqual({
        id: 'portrait-1',
        kind: MediaKind.IMAGE,
        url: 'https://media.test/media/portrait-1/1200.webp',
        width: 1200,
        height: 1500,
        blurhash: 'LEHV6n',
        alt: 'صورة إسلام',
        variants: [
          {
            format: MediaVariantFormat.WEBP,
            width: 640,
            height: 800,
            url: 'https://media.test/media/portrait-1/640.webp',
          },
          {
            format: MediaVariantFormat.WEBP,
            width: 1200,
            height: 1500,
            url: 'https://media.test/media/portrait-1/1200.webp',
          },
        ],
      });
    });

    it('returns a null alt for a locale with no alt row rather than falling back', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(
        settingsRow({
          portraitAssetId: 'portrait-1',
          portraitAsset: portraitAsset([
            { locale: 'en', alt: 'Portrait of Eslam' },
          ]),
        }),
      );

      const result = await service.getPublicSettings('ar');

      expect(result.portrait?.alt).toBeNull();
    });

    // The decorative-vs-missing distinction survives the move to per-usage alt (D09-22) — it just
    // belongs to the USAGE now. `''` means "deliberately decorative"; null means "not described
    // yet" and holds `/about` in its readiness state. Collapsing the two would let an undescribed
    // portrait publish as decorative, which is an accessibility regression, not a tidy-up.
    it('keeps an intentionally decorative empty alt distinct from a missing one', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(
        settingsRow({
          portraitAssetId: 'portrait-1',
          portraitAsset: portraitAsset(),
          translations: [translation('ar', { portraitAlt: '' })],
        }),
      );

      const result = await service.getPublicSettings('ar');

      expect(result.portrait?.alt).toBe('');
    });

    // D09-22 — PER-USAGE alt WINS, and an absent one does NOT fall back to the asset default.
    // The asset carries alts for both locales here; publishing them would mean shipping a library
    // default the owner never reviewed for the About context, so the descriptor must say null and
    // let `/about` stay in its governed `portrait-alt-missing` readiness state (D18-7).
    it('does NOT publish the asset-level MediaAssetAlt default when the usage defines no alt', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(
        settingsRow({
          portraitAssetId: 'portrait-1',
          portraitAsset: portraitAsset(),
          translations: [translation('ar', { portraitAlt: null })],
        }),
      );

      const result = await service.getPublicSettings('ar');

      expect(result.portrait?.alt).toBeNull();
    });

    it('publishes the per-usage alt even when the asset default differs', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(
        settingsRow({
          portraitAssetId: 'portrait-1',
          portraitAsset: portraitAsset(),
          translations: [
            translation('ar', { portraitAlt: 'نص بديل خاص بصفحة نبذة' }),
          ],
        }),
      );

      const result = await service.getPublicSettings('ar');

      // The asset default for 'ar' is 'صورة إسلام'; the usage value must win.
      expect(result.portrait?.alt).toBe('نص بديل خاص بصفحة نبذة');
    });

    // No cross-locale fallback (D10-6) applies to the per-usage alt too.
    it("does not borrow the other locale's per-usage alt", async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(
        settingsRow({
          portraitAssetId: 'portrait-1',
          portraitAsset: portraitAsset(),
          translations: [translation('en', { portraitAlt: 'English only' })],
        }),
      );

      const result = await service.getPublicSettings('ar');

      expect(result.portrait?.alt).toBeNull();
    });

    it('returns a null portrait when none is configured', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(settingsRow());

      const result = await service.getPublicSettings('en');

      expect(result.portraitAssetId).toBeNull();
      expect(result.portrait).toBeNull();
    });

    it('exposes the public email addresses', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(settingsRow());

      const result = await service.getPublicSettings('en');

      expect(result.professionalEmail).toBe('hello@eslammuatamed.com');
      expect(result.contactEmail).toBe('contact@eslammuatamed.com');
    });

    it('resolves About content for the requested locale', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(settingsRow());

      const result = await service.getPublicSettings('ar');

      expect(result.aboutBio).toBe('Bio ar');
      expect(result.engineeringPhilosophy).toBe('Philosophy ar');
      expect(result.currentFocus).toBe('Focus ar');
    });

    it('returns null About fields for a missing translation without cross-locale fallback', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(
        settingsRow({ translations: [translation('en')] }),
      );

      const result = await service.getPublicSettings('ar');

      expect(result.aboutBio).toBeNull();
      expect(result.engineeringPhilosophy).toBeNull();
      expect(result.currentFocus).toBeNull();
    });

    it('returns the full per-locale About map to admin', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(settingsRow());

      const result = await service.getAdminSettings();

      expect(result.portraitAssetId).toBeNull();
      expect(result.professionalEmail).toBe('hello@eslammuatamed.com');
      expect(result.contactEmail).toBe('contact@eslammuatamed.com');
      expect(result.translations.en?.aboutBio).toBe('Bio en');
      expect(result.translations.ar?.currentFocus).toBe('Focus ar');
    });

    it('resolves the portrait inside the settings query — no N+1', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(
        settingsRow({
          portraitAssetId: 'portrait-1',
          portraitAsset: portraitAsset(),
        }),
      );

      await service.getPublicSettings('en');

      // One singleton read, and no per-asset lookup: variants and alts arrive via the include,
      // so adding the portrait cannot degrade into a second round trip (doc 10 §6, D10-10).
      expect(prisma.siteSettings.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.mediaAsset.findUnique).not.toHaveBeenCalled();
      expect(prisma.mediaAsset.findMany).not.toHaveBeenCalled();
      const include = prisma.siteSettings.findFirst.mock.calls[0]?.[0]?.include;
      expect(include).toMatchObject({
        translations: true,
        resumeAsset: true,
        portraitAsset: { include: { variants: true, alts: true } },
      });
    });

    it('rejects a portrait that is not an IMAGE asset', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(settingsRow());
      prisma.mediaAsset.findUnique.mockResolvedValue({
        kind: MediaKind.PDF,
      } as MediaAsset);

      await expect(
        service.updateSettings({ portraitAssetId: 'resume-1' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('rejects a portrait asset that does not exist', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(settingsRow());
      prisma.mediaAsset.findUnique.mockResolvedValue(null);

      await expect(
        service.updateSettings({ portraitAssetId: 'missing' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('clears the portrait by disconnecting without deleting the asset', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(
        settingsRow({
          portraitAssetId: 'portrait-1',
          portraitAsset: portraitAsset(),
        }),
      );

      await service.updateSettings({ portraitAssetId: null });

      const update = prisma.siteSettings.update.mock.calls[0]?.[0];
      expect(update?.data.portraitAsset).toEqual({ disconnect: true });
      expect(prisma.mediaAsset.delete).not.toHaveBeenCalled();
    });
  });
});
