import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  MediaAsset,
  MediaKind,
  SiteSettings,
  SiteSettingsTranslation,
} from '@prisma/client';
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

type SettingsRow = SiteSettings & {
  translations: SiteSettingsTranslation[];
  resumeAsset: MediaAsset | null;
};

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
    careerStartYear: null,
    careerStartMonth: null,
    googleSiteVerification: 'google-token',
    bingSiteVerification: null,
    analyticsProvider: 'ga4',
    analyticsMeasurementId: 'G-XXX',
    analyticsEnabled: false,
    customMetas: [{ name: 'theme-color', content: '#000' }],
    createdAt: new Date(),
    updatedAt: new Date(),
    translations: [translation('en'), translation('ar')],
    resumeAsset: null,
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
    it('resolves the requested locale and omits analytics when disabled', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(settingsRow());

      const result = await service.getPublicSettings('ar');

      expect(locales.assertEnabled).toHaveBeenCalledWith('ar');
      expect(result.siteName).toBe('Site ar');
      expect(result.tagline).toBe('Tagline ar');
      expect(result.availabilityStatus).toBe('Avail ar');
      expect(result.analytics).toBeNull();
      expect(result.profileLinks).toEqual([
        { label: 'GitHub', url: 'https://github.com/x', icon: 'gh' },
      ]);
      expect(result.availableLocales).toEqual(['ar', 'en']);
      expect(result.careerStartYear).toBeNull();
      expect(result.careerStartMonth).toBeNull();
    });

    it('advertises analytics only when enabled with an id', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(
        settingsRow({ analyticsEnabled: true }),
      );

      const result = await service.getPublicSettings('en');

      expect(result.analytics).toEqual({
        provider: 'ga4',
        measurementId: 'G-XXX',
      });
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
});
