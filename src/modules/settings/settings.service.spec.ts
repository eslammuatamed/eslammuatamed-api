import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  MediaKind,
  SiteSettings,
  SiteSettingsTranslation,
} from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalesService } from '../locales/locales.service';
import { SettingsService } from './settings.service';

type SettingsRow = SiteSettings & { translations: SiteSettingsTranslation[] };

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
    availabilityStatus: 'Open',
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
    service = new SettingsService(prisma, locales);
  });

  describe('getPublicSettings', () => {
    it('resolves the requested locale and omits analytics when disabled', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(settingsRow());

      const result = await service.getPublicSettings('ar');

      expect(locales.assertEnabled).toHaveBeenCalledWith('ar');
      expect(result.siteName).toBe('Site ar');
      expect(result.tagline).toBe('Tagline ar');
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
      expect(result.availableLocales).toEqual(['en']);
    });

    it('rejects an unknown locale before resolving', async () => {
      locales.assertEnabled.mockRejectedValue(new BadRequestException());
      await expect(service.getPublicSettings('zz')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('getAdminSettings', () => {
    it('returns the full per-locale translation map', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(settingsRow());

      const result = await service.getAdminSettings();

      expect(Object.keys(result.translations).sort()).toEqual(['ar', 'en']);
      expect(result.translations.en?.siteName).toBe('Site en');
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
