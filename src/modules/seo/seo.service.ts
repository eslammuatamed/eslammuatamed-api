import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MediaKind } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalesService } from '../locales/locales.service';
import { MediaDescriptorResolver } from '../media/media-descriptor.resolver';
import { UpdatePageSeoDto } from './dto/page-seo.dto';
import {
  AdminPageSeoEntity,
  PageSeoTranslationEntity,
  PublicPageSeoEntity,
} from './entities/page-seo.entities';
import { isPageSeoKey, PAGE_SEO_KEYS } from './page-keys';

// The OG image loads with the row so its descriptor resolves in the same query — no N+1
// (doc 20 §7, doc 10 §6). Mirrors the articles/projects media include exactly.
const MEDIA_INCLUDE = { include: { variants: true, alts: true } } as const;

/** The all-null translation entry an unauthored locale resolves to. */
const EMPTY_TRANSLATION: PageSeoTranslationEntity = {
  metaTitle: null,
  metaDescription: null,
  ogImageId: null,
  canonicalUrl: null,
};

@Injectable()
export class SeoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locales: LocalesService,
    private readonly mediaDescriptors: MediaDescriptorResolver,
  ) {}

  /**
   * Public resolved read (D10-24). A valid key with no stored row for the requested locale returns
   * every field null — "no override, fall through to the site defaults" — which is the answer the
   * Web needs to honour doc 22 §3's chain. 404 is reserved for a key outside the closed set, so the
   * two conditions stay distinguishable. No cross-locale fallback (D10-6).
   */
  async getPublic(
    pageKey: string,
    locale: string,
  ): Promise<PublicPageSeoEntity> {
    this.assertKnownKey(pageKey);
    await this.locales.assertEnabled(locale);

    const row = await this.prisma.pageSeo.findUnique({
      where: { pageKey_locale: { pageKey, locale } },
      include: { ogImage: MEDIA_INCLUDE },
    });

    return {
      pageKey,
      locale,
      metaTitle: row?.metaTitle ?? null,
      metaDescription: row?.metaDescription ?? null,
      ogImageId: row?.ogImageId ?? null,
      // Kind check mirrors the settings resume/portrait slots: the FK is IMAGE-guarded on write, so
      // this is defence in depth against a row predating that guard rather than expected behaviour.
      ogImage:
        row?.ogImage && row.ogImage.kind === MediaKind.IMAGE
          ? this.mediaDescriptors.resolveImage(row.ogImage, locale)
          : null,
      canonicalUrl: row?.canonicalUrl ?? null,
    };
  }

  /** Admin list: one entry per known page key, each with its full translation map (F-D4). */
  async listAdmin(): Promise<AdminPageSeoEntity[]> {
    const localeCodes = await this.enabledLocaleCodes();
    const rows = await this.prisma.pageSeo.findMany();
    return PAGE_SEO_KEYS.map((pageKey) =>
      buildAdminEntity(
        pageKey,
        rows.filter((row) => row.pageKey === pageKey),
        localeCodes,
      ),
    );
  }

  /** Admin read of one page key, all locales. */
  async getAdmin(pageKey: string): Promise<AdminPageSeoEntity> {
    this.assertKnownKey(pageKey);
    const [localeCodes, rows] = await Promise.all([
      this.enabledLocaleCodes(),
      this.prisma.pageSeo.findMany({ where: { pageKey } }),
    ]);
    return buildAdminEntity(pageKey, rows, localeCodes);
  }

  /**
   * Per-locale upsert for one page key (D10-24). Every locale in the body is upserted inside ONE
   * transaction, so a body that names two locales and fails validation on the second leaves neither
   * written — a half-applied SEO edit would publish metadata the owner never approved as a pair.
   */
  async update(
    pageKey: string,
    dto: UpdatePageSeoDto,
  ): Promise<AdminPageSeoEntity> {
    this.assertKnownKey(pageKey);

    for (const translation of dto.translations) {
      await this.locales.assertEnabled(translation.locale);
      await this.assertOgImageIsImage(translation.ogImageId);
    }

    const operations = dto.translations.map((translation) =>
      this.prisma.pageSeo.upsert({
        where: { pageKey_locale: { pageKey, locale: translation.locale } },
        create: {
          pageKey,
          locale: translation.locale,
          ...writeFields(translation),
        },
        // Undefined fields are left untouched by Prisma; an explicit null clears (D10-23).
        update: writeFields(translation),
      }),
    );

    await this.prisma.$transaction(operations);
    return this.getAdmin(pageKey);
  }

  private assertKnownKey(pageKey: string): void {
    if (!isPageSeoKey(pageKey)) {
      // 404 rather than 422 on the public route: an unknown key is an unknown resource, and the
      // admin routes reject it at the pipe (PageSeoKeyParamDto) before reaching here.
      throw new NotFoundException(`Unknown static page key: ${pageKey}.`);
    }
  }

  /**
   * The OG slot may only reference an IMAGE asset — same rule and same 422 as the settings portrait
   * slot (D09-18). `null` clears and needs no lookup; the referenced asset is never deleted here,
   * and while referenced the schema's `onDelete: Restrict` blocks its deletion (409 via media).
   */
  private async assertOgImageIsImage(
    ogImageId: string | null | undefined,
  ): Promise<void> {
    if (ogImageId === undefined || ogImageId === null) return;

    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: ogImageId },
      select: { kind: true },
    });
    if (!asset) {
      throw new UnprocessableEntityException(
        'ogImageId does not reference an existing media asset.',
      );
    }
    if (asset.kind !== MediaKind.IMAGE) {
      throw new UnprocessableEntityException(
        'ogImageId must reference an IMAGE asset.',
      );
    }
  }

  private async enabledLocaleCodes(): Promise<string[]> {
    const locales = await this.prisma.locale.findMany({
      where: { isEnabled: true },
      select: { code: true },
      orderBy: { code: 'asc' },
    });
    return locales.map((locale) => locale.code);
  }
}

/**
 * Builds the admin map for one key, seeding EVERY enabled locale so an unauthored locale is
 * explicitly all-null rather than absent. The editor renders one tab per entry, and "not authored"
 * is the state the panel exists to let the owner resolve.
 */
function buildAdminEntity(
  pageKey: string,
  rows: readonly PageSeoRow[],
  localeCodes: string[],
): AdminPageSeoEntity {
  const translations: Record<string, PageSeoTranslationEntity> = {};
  for (const code of localeCodes) {
    translations[code] = { ...EMPTY_TRANSLATION };
  }
  for (const row of rows) {
    // A row for a locale that has since been disabled is deliberately still surfaced: it is stored
    // data, and hiding it would make the owner unable to see or clear what is in the database.
    translations[row.locale] = {
      metaTitle: row.metaTitle,
      metaDescription: row.metaDescription,
      ogImageId: row.ogImageId,
      canonicalUrl: row.canonicalUrl,
    };
  }
  return { pageKey, translations };
}

interface PageSeoRow {
  readonly locale: string;
  readonly metaTitle: string | null;
  readonly metaDescription: string | null;
  readonly ogImageId: string | null;
  readonly canonicalUrl: string | null;
}

/**
 * The writable columns. `string | null | undefined` throughout, and the distinction is the whole
 * mechanism (D10-23): Prisma reads `undefined` as "leave this column alone" and `null` as "write
 * NULL", so omitting a key preserves a value while sending null clears it.
 */
function writeFields(translation: {
  metaTitle?: string | null;
  metaDescription?: string | null;
  ogImageId?: string | null;
  canonicalUrl?: string | null;
}): {
  metaTitle: string | null | undefined;
  metaDescription: string | null | undefined;
  ogImageId: string | null | undefined;
  canonicalUrl: string | null | undefined;
} {
  return {
    metaTitle: translation.metaTitle,
    metaDescription: translation.metaDescription,
    ogImageId: translation.ogImageId,
    canonicalUrl: translation.canonicalUrl,
  };
}
