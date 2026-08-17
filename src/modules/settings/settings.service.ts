import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MediaKind, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalesService } from '../locales/locales.service';
import { MediaDescriptorResolver } from '../media/media-descriptor.resolver';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import {
  AdminSiteSettingsEntity,
  CustomMetaEntity,
  ProfileLinkEntity,
  PublicSiteSettingsEntity,
  SiteSettingsTranslationEntity,
} from './entities/site-settings.entities';

// The resume asset loads with the singleton so the public PDF descriptor resolves in the same
// query (no N+1). It is a PDF, so no variants/alts are needed.
// The resume and portrait assets load with the singleton so both public descriptors resolve in
// the same query (no N+1, doc 10 §6). The portrait needs variants + alts; the PDF needs neither.
const SETTINGS_INCLUDE = {
  translations: true,
  resumeAsset: true,
  portraitAsset: { include: { variants: true, alts: true } },
} as const;

type SettingsWithTranslations = Prisma.SiteSettingsGetPayload<{
  include: typeof SETTINGS_INCLUDE;
}>;

// Admin reads have no request locale; alts resolve against the default locale purely so the
// media picker can show a label. Public reads always use the caller's ?locale=.
const DEFAULT_ADMIN_ALT_LOCALE = 'en';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locales: LocalesService,
    private readonly mediaDescriptors: MediaDescriptorResolver,
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
      availabilityStatus: translation?.availabilityStatus ?? null,
      careerStartYear: settings.careerStartYear,
      careerStartMonth: settings.careerStartMonth,
      googleSiteVerification: settings.googleSiteVerification,
      bingSiteVerification: settings.bingSiteVerification,
      // A disabled container is never advertised to the client (FR-DSH-052, D20-5, D02-14). The
      // stored id stays readable on the admin surface; withholding it here is what makes "off"
      // observable as an absence rather than as a flag the client has to be trusted to honour.
      gtmContainerId: settings.analyticsEnabled
        ? settings.gtmContainerId
        : null,
      customMetas: toCustomMetas(settings.customMetas),
      // Public résumé descriptor (FR-PUB-023): the download URL/filename/size only — never the bare
      // asset id. The FK is PDF-guarded on write (T6); the kind check here is defence in depth.
      resumeAsset:
        settings.resumeAsset && settings.resumeAsset.kind === MediaKind.PDF
          ? this.mediaDescriptors.resolvePdf(settings.resumeAsset)
          : null,
      // Portrait (FR-PUB-020): the bare id stays available alongside the resolved descriptor
      // (additive, D10-10). The kind check mirrors the resume slot's defence in depth.
      portraitAssetId: settings.portraitAssetId,
      // The alt published here is the PER-USAGE value from this locale's translation row (D09-22),
      // never the asset-level `MediaAssetAlt` default: the About portrait's accessibility text is
      // owned by the About usage, and a library default must not be published for a context the
      // owner has not reviewed. `?? null` is what makes an absent alt explicit rather than a
      // fall-through, which keeps `/about` in its governed `portrait-alt-missing` state (D18-7).
      portrait:
        settings.portraitAsset &&
        settings.portraitAsset.kind === MediaKind.IMAGE
          ? this.mediaDescriptors.resolveImage(
              settings.portraitAsset,
              locale,
              translation?.portraitAlt ?? null,
            )
          : null,
      professionalEmail: settings.professionalEmail,
      contactEmail: settings.contactEmail,
      contactPhone: settings.contactPhone,
      whatsappPhone: settings.whatsappPhone,
      // About content resolved to the requested locale — no cross-locale fallback (D10-6).
      aboutBio: translation?.aboutBio ?? null,
      engineeringPhilosophy: translation?.engineeringPhilosophy ?? null,
      currentFocus: translation?.currentFocus ?? null,
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

    // The portrait slot may only reference an IMAGE asset (D09-18). null clears it; the prior
    // asset is retained. A non-existent or non-IMAGE asset is a 422, mirroring the resume rule.
    if (dto.portraitAssetId !== undefined && dto.portraitAssetId !== null) {
      const asset = await this.prisma.mediaAsset.findUnique({
        where: { id: dto.portraitAssetId },
        select: { kind: true },
      });
      if (!asset) {
        throw new UnprocessableEntityException(
          'portraitAssetId does not reference an existing media asset.',
        );
      }
      if (asset.kind !== MediaKind.IMAGE) {
        throw new UnprocessableEntityException(
          'portraitAssetId must reference an IMAGE asset.',
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

    // Tracking coherence (D02-14). Resolved against the MERGED state, not the request, because a
    // PATCH may supply either half: enabling on its own is valid when a container is already stored,
    // and clearing the container on its own must not leave the switch on. Rejecting the incoherent
    // pair here is what lets the public contract collapse "disabled" and "unconfigured" into one
    // `null` — the state that would distinguish them cannot be stored in the first place.
    const analyticsEnabled =
      dto.analyticsEnabled !== undefined
        ? dto.analyticsEnabled
        : settings.analyticsEnabled;
    const gtmContainerId =
      dto.gtmContainerId !== undefined
        ? dto.gtmContainerId
        : settings.gtmContainerId;
    if (analyticsEnabled && !gtmContainerId) {
      throw new UnprocessableEntityException(
        'analyticsEnabled requires a gtmContainerId; set the container id or disable tracking.',
      );
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
            availabilityStatus: translation.availabilityStatus,
            defaultMetaTitle: translation.defaultMetaTitle,
            defaultMetaDescription: translation.defaultMetaDescription,
            aboutBio: translation.aboutBio,
            engineeringPhilosophy: translation.engineeringPhilosophy,
            currentFocus: translation.currentFocus,
            portraitAlt: translation.portraitAlt,
          },
          // Undefined fields are left untouched by Prisma — a partial translation edit.
          update: {
            siteName: translation.siteName,
            tagline: translation.tagline,
            availabilityStatus: translation.availabilityStatus,
            defaultMetaTitle: translation.defaultMetaTitle,
            defaultMetaDescription: translation.defaultMetaDescription,
            aboutBio: translation.aboutBio,
            engineeringPhilosophy: translation.engineeringPhilosophy,
            currentFocus: translation.currentFocus,
            portraitAlt: translation.portraitAlt,
          },
        }),
      );
    }

    await this.prisma.$transaction(operations);
    return this.getAdminSettings();
  }

  private async loadSingletonOrThrow(): Promise<SettingsWithTranslations> {
    const settings = await this.prisma.siteSettings.findFirst({
      include: SETTINGS_INCLUDE,
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
        availabilityStatus: translation.availabilityStatus,
        defaultMetaTitle: translation.defaultMetaTitle,
        defaultMetaDescription: translation.defaultMetaDescription,
        aboutBio: translation.aboutBio,
        engineeringPhilosophy: translation.engineeringPhilosophy,
        currentFocus: translation.currentFocus,
        portraitAlt: translation.portraitAlt,
      };
    }
    return {
      id: settings.id,
      profileLinks: toProfileLinks(settings.profileLinks),
      resumeAssetId: settings.resumeAssetId,
      portraitAssetId: settings.portraitAssetId,
      // Read-only descriptor for the media picker; the writable field stays portraitAssetId.
      // Admin has no single locale, so alts resolve against the default locale.
      portrait:
        settings.portraitAsset &&
        settings.portraitAsset.kind === MediaKind.IMAGE
          ? this.mediaDescriptors.resolveImage(
              settings.portraitAsset,
              DEFAULT_ADMIN_ALT_LOCALE,
            )
          : null,
      professionalEmail: settings.professionalEmail,
      contactEmail: settings.contactEmail,
      contactPhone: settings.contactPhone,
      whatsappPhone: settings.whatsappPhone,
      careerStartYear: settings.careerStartYear,
      careerStartMonth: settings.careerStartMonth,
      googleSiteVerification: settings.googleSiteVerification,
      bingSiteVerification: settings.bingSiteVerification,
      analyticsEnabled: settings.analyticsEnabled,
      gtmContainerId: settings.gtmContainerId,
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
    careerStartYear: dto.careerStartYear,
    careerStartMonth: dto.careerStartMonth,
    googleSiteVerification: dto.googleSiteVerification,
    bingSiteVerification: dto.bingSiteVerification,
    analyticsEnabled: dto.analyticsEnabled,
    gtmContainerId: dto.gtmContainerId,
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
  if (dto.professionalEmail !== undefined) {
    data.professionalEmail = dto.professionalEmail;
  }
  if (dto.contactEmail !== undefined) {
    data.contactEmail = dto.contactEmail;
  }
  if (dto.contactPhone !== undefined) {
    data.contactPhone = dto.contactPhone;
  }
  if (dto.whatsappPhone !== undefined) {
    data.whatsappPhone = dto.whatsappPhone;
  }
  // Repoint (connect) or clear (disconnect) the portrait FK; the asset itself is never deleted.
  if (dto.portraitAssetId !== undefined) {
    data.portraitAsset =
      dto.portraitAssetId === null
        ? { disconnect: true }
        : { connect: { id: dto.portraitAssetId } };
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
