import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  MediaKind,
  Prisma,
  SiteSettings,
  SiteSettingsTranslation,
} from '@prisma/client';
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
      careerStartYear: settings.careerStartYear,
      careerStartMonth: settings.careerStartMonth,
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

    // The resume slot may only reference a PDF asset (service invariant, feature 003 T6). null
    // clears it (the prior asset is retained). Setting a non-existent or non-PDF asset is a 422.
    if (dto.resumeAssetId !== undefined && dto.resumeAssetId !== null) {
      const asset = await this.prisma.mediaAsset.findUnique({
        where: { id: dto.resumeAssetId },
        select: { kind: true },
      });
      if (!asset) {
        throw new UnprocessableEntityException(
          'resumeAssetId does not reference an existing media asset.',
        );
      }
      if (asset.kind !== MediaKind.PDF) {
        throw new UnprocessableEntityException(
          'resumeAssetId must reference a PDF asset.',
        );
      }
    }

    const careerStartYear =
      dto.careerStartYear !== undefined
        ? dto.careerStartYear
        : settings.careerStartYear;
    const careerStartMonth =
      dto.careerStartMonth !== undefined
        ? dto.careerStartMonth
        : settings.careerStartMonth;
    validateCareerStart(careerStartYear, careerStartMonth);

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
      careerStartYear: settings.careerStartYear,
      careerStartMonth: settings.careerStartMonth,
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
    careerStartYear: dto.careerStartYear,
    careerStartMonth: dto.careerStartMonth,
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
  // Repoint (connect) or clear (disconnect) the resume FK; the prior asset is never deleted here.
  if (dto.resumeAssetId !== undefined) {
    data.resumeAsset =
      dto.resumeAssetId === null
        ? { disconnect: true }
        : { connect: { id: dto.resumeAssetId } };
  }
  return data;
}

function validateCareerStart(year: number | null, month: number | null): void {
  if ((year === null) !== (month === null)) {
    throw new UnprocessableEntityException(
      'careerStartYear and careerStartMonth must both be present or both be absent.',
    );
  }
  if (
    year !== null &&
    (!Number.isInteger(year) || year < 1970 || year > 2100)
  ) {
    throw new UnprocessableEntityException(
      'careerStartYear must be an integer between 1970 and 2100.',
    );
  }
  if (month !== null && (!Number.isInteger(month) || month < 1 || month > 12)) {
    throw new UnprocessableEntityException(
      'careerStartMonth must be an integer between 1 and 12.',
    );
  }
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
