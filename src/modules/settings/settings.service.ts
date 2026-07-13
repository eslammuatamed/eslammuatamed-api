import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SiteSettings, SiteSettingsTranslation } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalesService } from '../locales/locales.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import {
  AdminSiteSettingsEntity,
  CustomMetaEntity,
  ProfileLinkEntity,
  PublicSiteSettingsEntity,
  SiteSettingsTranslationEntity,
} from './entities/site-settings.entities';

type SettingsWithTranslations = SiteSettings & {
  translations: SiteSettingsTranslation[];
};

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locales: LocalesService,
  ) {}

  // Public resolved read (D10-6): translatable fields flattened to the requested locale, no
  // silent cross-locale fallback — an absent translation yields nulls, not another locale.
  async getPublicSettings(locale: string): Promise<PublicSiteSettingsEntity> {
    await this.locales.assertEnabled(locale);
    const settings = await this.loadSingletonOrThrow();
    const translation =
      settings.translations.find((t) => t.locale === locale) ?? null;

    return {
      siteName: translation?.siteName ?? null,
      tagline: translation?.tagline ?? null,
      defaultMetaTitle: translation?.defaultMetaTitle ?? null,
      defaultMetaDescription: translation?.defaultMetaDescription ?? null,
      profileLinks: toProfileLinks(settings.profileLinks),
      availabilityStatus: settings.availabilityStatus,
      googleSiteVerification: settings.googleSiteVerification,
      bingSiteVerification: settings.bingSiteVerification,
      // A disabled analytics tag is never advertised to the client (FR-DSH-052, D20-5).
      analytics:
        settings.analyticsEnabled &&
        settings.analyticsProvider &&
        settings.analyticsMeasurementId
          ? {
              provider: settings.analyticsProvider,
              measurementId: settings.analyticsMeasurementId,
            }
          : null,
      customMetas: toCustomMetas(settings.customMetas),
      availableLocales: settings.translations.map((t) => t.locale).sort(),
    };
  }

  // Admin full-map read (D10-6): every stored field plus the per-locale translation map.
  async getAdminSettings(): Promise<AdminSiteSettingsEntity> {
    const settings = await this.loadSingletonOrThrow();
    return this.toAdminEntity(settings);
  }

  // Partial update of the singleton (OWNER-only at the controller). Translation entries are
  // upserted per locale; the row update and the upserts run in one transaction so a failed
  // locale never leaves a half-applied edit.
  async updateSettings(
    dto: UpdateSettingsDto,
  ): Promise<AdminSiteSettingsEntity> {
    const settings = await this.loadSingletonOrThrow();

    for (const translation of dto.translations ?? []) {
      await this.locales.assertEnabled(translation.locale);
    }

    const operations: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.siteSettings.update({
        where: { id: settings.id },
        data: buildSettingsUpdate(dto),
      }),
    ];

    for (const translation of dto.translations ?? []) {
      operations.push(
        this.prisma.siteSettingsTranslation.upsert({
          where: {
            siteSettingsId_locale: {
              siteSettingsId: settings.id,
              locale: translation.locale,
            },
          },
          create: {
            siteSettingsId: settings.id,
            locale: translation.locale,
            siteName: translation.siteName,
            tagline: translation.tagline,
            defaultMetaTitle: translation.defaultMetaTitle,
            defaultMetaDescription: translation.defaultMetaDescription,
          },
          // Undefined fields are left untouched by Prisma — a partial translation edit.
          update: {
            siteName: translation.siteName,
            tagline: translation.tagline,
            defaultMetaTitle: translation.defaultMetaTitle,
            defaultMetaDescription: translation.defaultMetaDescription,
          },
        }),
      );
    }

    await this.prisma.$transaction(operations);
    return this.getAdminSettings();
  }

  private async loadSingletonOrThrow(): Promise<SettingsWithTranslations> {
    const settings = await this.prisma.siteSettings.findFirst({
      include: { translations: true },
    });
    if (!settings) {
      throw new NotFoundException('Site settings have not been initialized.');
    }
    return settings;
  }

  private toAdminEntity(
    settings: SettingsWithTranslations,
  ): AdminSiteSettingsEntity {
    const translations: Record<string, SiteSettingsTranslationEntity> = {};
    for (const translation of settings.translations) {
      translations[translation.locale] = {
        siteName: translation.siteName,
        tagline: translation.tagline,
        defaultMetaTitle: translation.defaultMetaTitle,
        defaultMetaDescription: translation.defaultMetaDescription,
      };
    }
    return {
      id: settings.id,
      profileLinks: toProfileLinks(settings.profileLinks),
      availabilityStatus: settings.availabilityStatus,
      resumeAssetId: settings.resumeAssetId,
      googleSiteVerification: settings.googleSiteVerification,
      bingSiteVerification: settings.bingSiteVerification,
      analyticsProvider: settings.analyticsProvider,
      analyticsMeasurementId: settings.analyticsMeasurementId,
      analyticsEnabled: settings.analyticsEnabled,
      customMetas: toCustomMetas(settings.customMetas),
      translations,
    };
  }
}

// Only the fields present in the DTO are written; JSON columns are rebuilt as plain values
// (JSON can't hold `undefined`, so the optional icon key is omitted when absent).
function buildSettingsUpdate(
  dto: UpdateSettingsDto,
): Prisma.SiteSettingsUpdateInput {
  const data: Prisma.SiteSettingsUpdateInput = {
    availabilityStatus: dto.availabilityStatus,
    googleSiteVerification: dto.googleSiteVerification,
    bingSiteVerification: dto.bingSiteVerification,
    analyticsProvider: dto.analyticsProvider,
    analyticsMeasurementId: dto.analyticsMeasurementId,
    analyticsEnabled: dto.analyticsEnabled,
  };
  if (dto.profileLinks) {
    data.profileLinks = dto.profileLinks.map((link) =>
      link.icon
        ? { label: link.label, url: link.url, icon: link.icon }
        : { label: link.label, url: link.url },
    );
  }
  if (dto.customMetas) {
    data.customMetas = dto.customMetas.map((meta) => ({
      name: meta.name,
      content: meta.content,
    }));
  }
  return data;
}

function isJsonObject(item: Prisma.JsonValue): item is Prisma.JsonObject {
  return typeof item === 'object' && item !== null && !Array.isArray(item);
}

function toProfileLinks(value: Prisma.JsonValue): ProfileLinkEntity[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isJsonObject).map((item) => ({
    label: typeof item.label === 'string' ? item.label : '',
    url: typeof item.url === 'string' ? item.url : '',
    icon: typeof item.icon === 'string' ? item.icon : undefined,
  }));
}

function toCustomMetas(value: Prisma.JsonValue): CustomMetaEntity[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isJsonObject).map((item) => ({
    name: typeof item.name === 'string' ? item.name : '',
    content: typeof item.content === 'string' ? item.content : '',
  }));
}
