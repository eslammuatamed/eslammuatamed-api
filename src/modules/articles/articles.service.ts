import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ContentStatus, Prisma } from '@prisma/client';
import {
  buildPageMeta,
  PaginatedResult,
} from '../../common/pagination/page-meta';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalesService } from '../locales/locales.service';
import { MediaDescriptorResolver } from '../media/media-descriptor.resolver';
import { RedirectService } from '../redirects/redirect.service';
import {
  AdminArticleListQueryDto,
  ArticleListQueryDto,
} from './dto/article-query.dto';
import {
  ArticleTranslationDto,
  CreateArticleDto,
  UpdateArticleDto,
} from './dto/article.dto';
import {
  AdminArticleEntity,
  AdminArticleTranslationEntity,
  ArticleTaxonomyRefEntity,
  PublicArticleDetailEntity,
  PublicArticleListItemEntity,
} from './entities/article.entities';

// Media relations (cover + per-translation OG) load with variants + alts so descriptors resolve in
// the parent query — no N+1 (doc 20 §7, doc 10 §6).
const MEDIA_INCLUDE = { include: { variants: true, alts: true } } as const;

type ArticlePublicPayload = Prisma.ArticleGetPayload<{
  include: {
    translations: { include: { ogImage: typeof MEDIA_INCLUDE } };
    coverImage: typeof MEDIA_INCLUDE;
    category: { include: { translations: true } };
    tags: { include: { tag: { include: { translations: true } } } };
  };
}>;

type ArticleAdminPayload = Prisma.ArticleGetPayload<{
  include: { translations: true; tags: true };
}>;

const PUBLIC_INCLUDE = (locale: string) => ({
  translations: { include: { ogImage: MEDIA_INCLUDE } },
  coverImage: MEDIA_INCLUDE,
  category: { include: { translations: { where: { locale } } } },
  tags: {
    include: { tag: { include: { translations: { where: { locale } } } } },
  },
});

const ADMIN_INCLUDE = { translations: true, tags: true } as const;

@Injectable()
export class ArticlesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locales: LocalesService,
    private readonly mediaDescriptors: MediaDescriptorResolver,
    private readonly redirects: RedirectService,
  ) {}

  // Public list (D10-6): PUBLISHED only, resolved to ?locale=, with category/tag/q filters
  // matched in that locale. Drafts/scheduled/archived never appear (FR-PUB-046). A non-empty
  // `q` routes through Postgres full-text search (D09-6); otherwise a plain indexed list.
  async listPublic(
    query: ArticleListQueryDto,
  ): Promise<PaginatedResult<PublicArticleListItemEntity>> {
    await this.locales.assertEnabled(query.locale);

    const q = query.q?.trim();
    if (q) {
      return this.searchPublic(query, q);
    }

    const where = buildPublicWhere(query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.article.findMany({
        where,
        include: PUBLIC_INCLUDE(query.locale),
        orderBy: [
          { publishAt: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' },
        ],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.article.count({ where }),
    ]);

    const data = rows.map((row) => this.resolveListItem(row, query.locale));
    return new PaginatedResult(
      data,
      buildPageMeta(query.page, query.perPage, total),
    );
  }

  // Full-text search over the generated `search_vector` (title + excerpt) with its GIN index
  // (D09-6). The tsquery uses the same per-locale regconfig the stored column was built with
  // ('simple' for ar, 'english' for en), so query and document configs match. Results are
  // ranked by ts_rank (exact/denser matches first); the raw SQL is localized here and returns
  // only ids, which are then hydrated through the normal Prisma include so resolution stays in
  // one place. An empty/whitespace `q` never reaches this path (handled in listPublic).
  private async searchPublic(
    query: ArticleListQueryDto,
    q: string,
  ): Promise<PaginatedResult<PublicArticleListItemEntity>> {
    const locale = query.locale;
    const regconfig = locale === 'ar' ? 'simple' : 'english';
    const tsquery = Prisma.sql`websearch_to_tsquery(${regconfig}::regconfig, ${q})`;
    const categoryFilter = query.category
      ? Prisma.sql`AND EXISTS (SELECT 1 FROM category_translations ct WHERE ct.category_id = a.category_id AND ct.locale = ${locale} AND ct.slug = ${query.category})`
      : Prisma.empty;
    const tagFilter = query.tag
      ? Prisma.sql`AND EXISTS (SELECT 1 FROM article_tags atg JOIN tag_translations tt ON tt.tag_id = atg.tag_id WHERE atg.article_id = a.id AND tt.locale = ${locale} AND tt.slug = ${query.tag})`
      : Prisma.empty;
    const source = Prisma.sql`
      FROM articles a
      JOIN article_translations t ON t.article_id = a.id AND t.locale = ${locale}
      WHERE a.status = 'PUBLISHED'::"ContentStatus"
        AND t.search_vector @@ ${tsquery}
        ${categoryFilter}
        ${tagFilter}`;

    const idRows = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT a.id ${source}
      ORDER BY ts_rank(t.search_vector, ${tsquery}) DESC,
               a.publish_at DESC NULLS LAST,
               a.created_at DESC
      LIMIT ${query.take} OFFSET ${query.skip}`);
    const countRows = await this.prisma.$queryRaw<{ count: number }[]>(
      Prisma.sql`SELECT COUNT(*)::int AS count ${source}`,
    );
    const total = countRows[0]?.count ?? 0;

    const ids = idRows.map((row) => row.id);
    const data = await this.hydrateInOrder(ids, locale);
    return new PaginatedResult(
      data,
      buildPageMeta(query.page, query.perPage, total),
    );
  }

  // Loads the ranked ids through the normal Prisma include and re-orders them to match the rank
  // (a `WHERE id IN (...)` does not preserve order).
  private async hydrateInOrder(
    ids: string[],
    locale: string,
  ): Promise<PublicArticleListItemEntity[]> {
    if (ids.length === 0) {
      return [];
    }
    const articles = await this.prisma.article.findMany({
      where: { id: { in: ids } },
      include: PUBLIC_INCLUDE(locale),
    });
    const byId = new Map(articles.map((article) => [article.id, article]));
    const ordered: PublicArticleListItemEntity[] = [];
    for (const id of ids) {
      const article = byId.get(id);
      if (article) {
        ordered.push(this.resolveListItem(article, locale));
      }
    }
    return ordered;
  }

  // Public detail by per-locale slug (D10-6). A draft/scheduled/archived slug 404s exactly as
  // an unknown one does — invisibility is indistinguishable from absence (FR-PUB-046, doc 19 A01).
  async getPublicBySlug(
    slug: string,
    locale: string,
  ): Promise<PublicArticleDetailEntity> {
    await this.locales.assertEnabled(locale);
    const translation = await this.prisma.articleTranslation.findUnique({
      where: { locale_slug: { locale, slug } },
      include: { article: { include: PUBLIC_INCLUDE(locale) } },
    });

    if (
      !translation ||
      translation.article.status !== ContentStatus.PUBLISHED
    ) {
      throw new NotFoundException('Article not found.');
    }
    return this.resolveDetail(translation.article, locale);
  }

  // Draft preview by id (D10-8): status-agnostic fetch keyed by id, BYPASSING the PUBLISHED filter
  // that getPublicBySlug enforces — so a DRAFT/scheduled/archived article resolves here. This is only
  // reachable behind a verified preview token (PreviewTokenService); the token, not this method, is
  // the visibility gate (FR-PUB-046). Reuses the same resolveDetail() as public reads, so the draft
  // renders in the identical single-locale shape. A genuinely absent id still 404s.
  async getPreviewById(
    id: string,
    locale: string,
  ): Promise<PublicArticleDetailEntity> {
    await this.locales.assertEnabled(locale);
    const article = await this.prisma.article.findUnique({
      where: { id },
      include: PUBLIC_INCLUDE(locale),
    });
    if (!article) {
      throw new NotFoundException('Article not found.');
    }
    return this.resolveDetail(article, locale);
  }

  // Public related articles (D04-5/D10-6): published articles sharing the source category
  // and/or tags, ranked same-category FIRST, then shared-tag count, then publish recency
  // (doc 04 §5: "same category first, shared tags second, recency as tiebreaker").
  async getPublicRelated(
    slug: string,
    locale: string,
  ): Promise<PaginatedResult<PublicArticleListItemEntity>> {
    await this.locales.assertEnabled(locale);
    const translation = await this.prisma.articleTranslation.findUnique({
      where: { locale_slug: { locale, slug } },
      include: { article: { include: PUBLIC_INCLUDE(locale) } },
    });

    if (
      !translation ||
      translation.article.status !== ContentStatus.PUBLISHED
    ) {
      throw new NotFoundException('Article not found.');
    }

    const source = translation.article;
    const sourceTagIds = source.tags.map((link) => link.tagId);
    const candidates = await this.prisma.article.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        id: { not: source.id },
        translations: { some: { locale } },
        OR: [
          { categoryId: source.categoryId },
          ...(sourceTagIds.length > 0
            ? [{ tags: { some: { tagId: { in: sourceTagIds } } } }]
            : []),
        ],
      },
      include: PUBLIC_INCLUDE(locale),
      orderBy: { publishAt: { sort: 'desc', nulls: 'last' } },
    });

    const sourceTagSet = new Set(sourceTagIds);
    const ranked = candidates
      .filter(
        (article) =>
          article.id !== source.id &&
          article.status === ContentStatus.PUBLISHED,
      )
      .map((article) => ({
        article,
        sharedTagCount: article.tags.filter((link) =>
          sourceTagSet.has(link.tagId),
        ).length,
        sameCategory: article.categoryId === source.categoryId ? 1 : 0,
      }))
      .sort((left, right) => {
        if (right.sameCategory !== left.sameCategory) {
          return right.sameCategory - left.sameCategory;
        }
        if (right.sharedTagCount !== left.sharedTagCount) {
          return right.sharedTagCount - left.sharedTagCount;
        }
        return (
          (right.article.publishAt?.getTime() ?? -Infinity) -
          (left.article.publishAt?.getTime() ?? -Infinity)
        );
      })
      .slice(0, 3);

    return new PaginatedResult(
      ranked.map(({ article }) => this.resolveListItem(article, locale)),
      buildPageMeta(1, 3, ranked.length),
    );
  }

  async listAdmin(
    query: AdminArticleListQueryDto,
  ): Promise<PaginatedResult<AdminArticleEntity>> {
    const where: Prisma.ArticleWhereInput = query.status
      ? { status: query.status }
      : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.article.findMany({
        where,
        include: ADMIN_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.article.count({ where }),
    ]);
    return new PaginatedResult(
      rows.map(toAdminEntity),
      buildPageMeta(query.page, query.perPage, total),
    );
  }

  async getAdmin(id: string): Promise<AdminArticleEntity> {
    return toAdminEntity(await this.getAdminOrThrow(id));
  }

  async create(dto: CreateArticleDto): Promise<AdminArticleEntity> {
    for (const translation of dto.translations) {
      await this.locales.assertEnabled(translation.locale);
    }
    const status = dto.status ?? ContentStatus.DRAFT;
    const publishAt = resolvePublishAt(
      status,
      dto.publishAt ? new Date(dto.publishAt) : null,
    );

    const article = await this.prisma.article.create({
      data: {
        status,
        publishAt,
        categoryId: dto.categoryId,
        coverImageId: dto.coverImageId,
        translations: {
          create: dto.translations.map((translation) => ({
            locale: translation.locale,
            ...translationWriteFields(translation),
          })),
        },
        tags:
          dto.tagIds && dto.tagIds.length > 0
            ? { create: dto.tagIds.map((tagId) => ({ tagId })) }
            : undefined,
      },
      include: ADMIN_INCLUDE,
    });
    return toAdminEntity(article);
  }

  async update(id: string, dto: UpdateArticleDto): Promise<AdminArticleEntity> {
    const existing = await this.getAdminOrThrow(id);
    for (const translation of dto.translations ?? []) {
      await this.locales.assertEnabled(translation.locale);
    }

    const nextStatus = dto.status ?? existing.status;
    const candidate =
      dto.publishAt !== undefined
        ? new Date(dto.publishAt)
        : existing.publishAt;
    const publishAt = resolvePublishAt(nextStatus, candidate);

    const operations: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.article.update({
        where: { id },
        data: {
          status: nextStatus,
          publishAt,
          categoryId: dto.categoryId,
          coverImageId: dto.coverImageId,
        },
      }),
    ];

    for (const translation of dto.translations ?? []) {
      operations.push(
        this.prisma.articleTranslation.upsert({
          where: {
            articleId_locale: { articleId: id, locale: translation.locale },
          },
          create: {
            articleId: id,
            locale: translation.locale,
            ...translationWriteFields(translation),
          },
          update: translationWriteFields(translation),
        }),
      );

      // D04-6: a locale-slug rename on a still-published article auto-creates its SlugRedirect in
      // the SAME $transaction as the rename, so the old public URL keeps resolving (one op-set per
      // changed locale). Gated on the old slug having been publicly live AND the new slug staying
      // live — draft/scheduled/archived, publish-state flips (draft→publish, publish→unpublish),
      // unchanged slugs, and new locales (no prior slug) are all skipped.
      const oldSlug = existing.translations.find(
        (t) => t.locale === translation.locale,
      )?.slug;
      if (
        oldSlug !== undefined &&
        oldSlug !== translation.slug &&
        existing.status === ContentStatus.PUBLISHED &&
        nextStatus === ContentStatus.PUBLISHED
      ) {
        operations.push(
          ...this.redirects.buildRedirectOps({
            locale: translation.locale,
            entityType: 'article',
            oldSlug,
            newSlug: translation.slug,
          }),
        );
      }
    }

    // A provided tagIds replaces the set wholesale (clear then re-link).
    if (dto.tagIds) {
      operations.push(
        this.prisma.articleTag.deleteMany({ where: { articleId: id } }),
      );
      if (dto.tagIds.length > 0) {
        operations.push(
          this.prisma.articleTag.createMany({
            data: dto.tagIds.map((tagId) => ({ articleId: id, tagId })),
          }),
        );
      }
    }

    await this.prisma.$transaction(operations);
    return this.getAdmin(id);
  }

  async remove(id: string): Promise<void> {
    await this.getAdminOrThrow(id);
    await this.prisma.article.delete({ where: { id } });
  }

  // Idempotent scheduled-publishing transition (D07-3, FR-PUB-045): one query flips every due
  // SCHEDULED article to PUBLISHED. Re-running promotes only those still SCHEDULED — already
  // promoted rows no longer match, so a double run is a no-op. Returns the count promoted.
  async promoteScheduled(now: Date = new Date()): Promise<number> {
    const result = await this.prisma.article.updateMany({
      where: { status: ContentStatus.SCHEDULED, publishAt: { lte: now } },
      data: { status: ContentStatus.PUBLISHED },
    });
    return result.count;
  }

  private async getAdminOrThrow(id: string): Promise<ArticleAdminPayload> {
    const article = await this.prisma.article.findUnique({
      where: { id },
      include: ADMIN_INCLUDE,
    });
    if (!article) {
      throw new NotFoundException('Article not found.');
    }
    return article;
  }

  // The requested-locale translation, or a 404. Guarded by the queries (list filters on the
  // locale; by-slug matched it), so this is defensive — and it keeps the resolve helpers free
  // of non-null assertions (doc 15 §1).
  private requireTranslation(
    article: ArticlePublicPayload,
    locale: string,
  ): ArticlePublicPayload['translations'][number] {
    const translation = article.translations.find((t) => t.locale === locale);
    if (!translation) {
      throw new NotFoundException('Article not found.');
    }
    return translation;
  }

  private resolveListItem(
    article: ArticlePublicPayload,
    locale: string,
  ): PublicArticleListItemEntity {
    const translation = this.requireTranslation(article, locale);
    return {
      id: article.id,
      title: translation.title,
      slug: translation.slug,
      excerpt: translation.excerpt,
      readingTimeMin: translation.readingTimeMin,
      publishAt: article.publishAt?.toISOString() ?? null,
      coverImageId: article.coverImageId,
      coverImage: article.coverImage
        ? this.mediaDescriptors.resolveImage(article.coverImage, locale)
        : null,
      category: taxonomyRef(article.category.id, article.category.translations),
      tags: article.tags.map((link) =>
        taxonomyRef(link.tag.id, link.tag.translations),
      ),
      availableLocales: article.translations.map((t) => t.locale).sort(),
    };
  }

  private resolveDetail(
    article: ArticlePublicPayload,
    locale: string,
  ): PublicArticleDetailEntity {
    const listItem = this.resolveListItem(article, locale);
    const translation = this.requireTranslation(article, locale);
    // Slug map over every translation — the same set as availableLocales — so the frontend can
    // switch locales without guessing the other locale's slug (doc 10 §6).
    const slugs: Record<string, string> = {};
    for (const t of article.translations) {
      slugs[t.locale] = t.slug;
    }
    return {
      ...listItem,
      slugs,
      body: translation.body,
      metaTitle: translation.metaTitle,
      metaDescription: translation.metaDescription,
      ogImageId: translation.ogImageId,
      ogImage: translation.ogImage
        ? this.mediaDescriptors.resolveImage(translation.ogImage, locale)
        : null,
      canonicalUrl: translation.canonicalUrl,
    };
  }
}

// Where-clause for the non-search list path. The `q` filter is handled separately by
// searchPublic (Postgres FTS, D09-6), so it is intentionally absent here.
function buildPublicWhere(
  query: ArticleListQueryDto,
): Prisma.ArticleWhereInput {
  return {
    status: ContentStatus.PUBLISHED,
    translations: {
      some: {
        locale: query.locale,
      },
    },
    ...(query.category
      ? {
          category: {
            translations: {
              some: { locale: query.locale, slug: query.category },
            },
          },
        }
      : {}),
    ...(query.tag
      ? {
          tags: {
            some: {
              tag: {
                translations: {
                  some: { locale: query.locale, slug: query.tag },
                },
              },
            },
          },
        }
      : {}),
  };
}

// Scheduling rules (doc 10 §6): a SCHEDULED article needs a future publishAt (past/missing is a
// 422); a direct PUBLISH stamps publishAt = now when absent so ordering stays stable.
function resolvePublishAt(
  status: ContentStatus,
  candidate: Date | null,
): Date | null {
  if (status === ContentStatus.SCHEDULED) {
    if (!candidate || candidate.getTime() <= Date.now()) {
      throw new UnprocessableEntityException(
        'A SCHEDULED article requires a future publishAt.',
      );
    }
    return candidate;
  }
  if (status === ContentStatus.PUBLISHED) {
    return candidate ?? new Date();
  }
  return candidate;
}

function translationWriteFields(translation: ArticleTranslationDto): {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  readingTimeMin: number;
  metaTitle: string | undefined;
  metaDescription: string | undefined;
  ogImageId: string | undefined;
  canonicalUrl: string | undefined;
} {
  return {
    title: translation.title,
    slug: translation.slug,
    excerpt: translation.excerpt,
    body: translation.body,
    readingTimeMin: computeReadingTime(translation.body),
    metaTitle: translation.metaTitle,
    metaDescription: translation.metaDescription,
    ogImageId: translation.ogImageId,
    canonicalUrl: translation.canonicalUrl,
  };
}

// Reading time computed on write (doc 09 §3): ~200 wpm, floored at one minute.
function computeReadingTime(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function taxonomyRef(
  id: string,
  localeTranslations: { name: string; slug: string }[],
): ArticleTaxonomyRefEntity {
  const translation = localeTranslations[0];
  return { id, name: translation?.name ?? '', slug: translation?.slug ?? '' };
}

function toAdminEntity(article: ArticleAdminPayload): AdminArticleEntity {
  const translations: Record<string, AdminArticleTranslationEntity> = {};
  for (const translation of article.translations) {
    translations[translation.locale] = {
      title: translation.title,
      slug: translation.slug,
      excerpt: translation.excerpt,
      body: translation.body,
      readingTimeMin: translation.readingTimeMin,
      metaTitle: translation.metaTitle,
      metaDescription: translation.metaDescription,
      ogImageId: translation.ogImageId,
      canonicalUrl: translation.canonicalUrl,
    };
  }
  return {
    id: article.id,
    status: article.status,
    publishAt: article.publishAt?.toISOString() ?? null,
    categoryId: article.categoryId,
    coverImageId: article.coverImageId,
    tagIds: article.tags.map((link) => link.tagId),
    translations,
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
  };
}
