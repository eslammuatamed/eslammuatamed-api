import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  ContentStatus,
  MediaKind,
  MediaVariantFormat,
  Prisma,
} from '../../generated/prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalesService } from '../locales/locales.service';
import { MediaDescriptorResolver } from '../media/media-descriptor.resolver';
import { StorageAdapter } from '../media/storage/storage-adapter.interface';
import { RedirectService } from '../redirects/redirect.service';
import { ArticlesService } from './articles.service';

const storage = {
  put: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
  publicUrl: (key: string) => `https://media.test/${key}`,
} as unknown as StorageAdapter;

// A loaded image MediaAsset (variants + alts) for cover / OG descriptor tests.
const imageAsset = (
  id: string,
  alts: { locale: string; alt: string }[],
): Record<string, unknown> => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id,
    kind: MediaKind.IMAGE,
    storageKey: `media/${id}/master.webp`,
    originalFilename: 'x.jpg',
    mimeType: 'image/webp',
    sizeBytes: 1000,
    contentHash: id,
    width: 1920,
    height: 1080,
    blurhash: 'BH',
    createdAt: now,
    updatedAt: now,
    variants: [
      {
        id: `${id}-w`,
        mediaAssetId: id,
        format: MediaVariantFormat.WEBP,
        width: 1920,
        height: 1080,
        storageKey: `media/${id}/1920-webp.webp`,
        sizeBytes: 900,
        overBudget: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `${id}-a`,
        mediaAssetId: id,
        format: MediaVariantFormat.AVIF,
        width: 1920,
        height: 1080,
        storageKey: `media/${id}/1920-avif.avif`,
        sizeBytes: 800,
        overBudget: false,
        createdAt: now,
        updatedAt: now,
      },
    ],
    alts: alts.map((entry, index) => ({
      id: `${id}-alt${index}`,
      mediaAssetId: id,
      locale: entry.locale,
      alt: entry.alt,
      createdAt: now,
      updatedAt: now,
    })),
  };
};

function articlePayload(status: ContentStatus, locale = 'en') {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'a1',
    status,
    publishAt: now,
    categoryId: 'c1',
    coverImageId: null,
    createdAt: now,
    updatedAt: now,
    translations: [
      {
        id: 't-en',
        articleId: 'a1',
        locale,
        title: `Title ${locale}`,
        slug: `slug-${locale}`,
        excerpt: `Excerpt ${locale}`,
        body: 'word '.repeat(400),
        readingTimeMin: 2,
        metaTitle: null,
        metaDescription: null,
        ogImageId: null,
        canonicalUrl: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 't-alt',
        articleId: 'a1',
        locale: locale === 'en' ? 'ar' : 'en',
        title: 'Alt title',
        slug: `slug-${locale === 'en' ? 'ar' : 'en'}`,
        excerpt: 'Alt excerpt',
        body: 'alt body',
        readingTimeMin: 1,
        metaTitle: null,
        metaDescription: null,
        ogImageId: null,
        canonicalUrl: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    category: {
      id: 'c1',
      createdAt: now,
      updatedAt: now,
      translations: [
        {
          id: 'ct-en',
          categoryId: 'c1',
          locale,
          name: 'Engineering',
          slug: 'engineering',
          description: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
    tags: [],
  };
}

function relatedArticlePayload(options: {
  id: string;
  status: ContentStatus;
  categoryId: string;
  tagIds: string[];
  publishAt: string;
  slug: string;
}) {
  const article = articlePayload(options.status);
  return {
    ...article,
    id: options.id,
    categoryId: options.categoryId,
    publishAt: new Date(options.publishAt),
    translations: article.translations.map((translation, index) => ({
      ...translation,
      articleId: options.id,
      locale: index === 0 ? 'en' : 'ar',
      slug: index === 0 ? options.slug : `${options.slug}-ar`,
    })),
    category: {
      ...article.category,
      id: options.categoryId,
      translations: article.category.translations,
    },
    tags: options.tagIds.map((tagId) => ({
      articleId: options.id,
      tagId,
      tag: {
        id: tagId,
        translations: [{ name: tagId, slug: tagId }],
      },
    })),
  };
}

describe('ArticlesService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let locales: DeepMockProxy<LocalesService>;
  let redirects: DeepMockProxy<RedirectService>;
  let service: ArticlesService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    locales = mockDeep<LocalesService>();
    redirects = mockDeep<RedirectService>();
    // Default to an empty op-set so a spread never crashes; the "called" tests override this with a
    // sentinel array and assert those ops land in the $transaction.
    redirects.buildRedirectOps.mockReturnValue([]);
    service = new ArticlesService(
      prisma,
      locales,
      new MediaDescriptorResolver(storage),
      redirects,
    );
  });

  describe('getPublicBySlug (FR-PUB-046 visibility)', () => {
    it('404s a draft slug exactly like an unknown one', async () => {
      prisma.articleTranslation.findUnique.mockResolvedValue({
        // The join payload; only article.status matters for the visibility gate.
        article: articlePayload(ContentStatus.DRAFT),
      } as never);

      await expect(
        service.getPublicBySlug('slug-en', 'en'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404s an unknown slug', async () => {
      prisma.articleTranslation.findUnique.mockResolvedValue(null);
      await expect(
        service.getPublicBySlug('missing', 'en'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('resolves a published article to the requested locale', async () => {
      prisma.articleTranslation.findUnique.mockResolvedValue({
        article: articlePayload(ContentStatus.PUBLISHED),
      } as never);

      const result = await service.getPublicBySlug('slug-en', 'en');

      expect(locales.assertEnabled).toHaveBeenCalledWith('en');
      expect(result.title).toBe('Title en');
      expect(result.category).toEqual({
        id: 'c1',
        name: 'Engineering',
        slug: 'engineering',
      });
      expect(result.readingTimeMin).toBe(2);
      expect(result.body).toContain('word');
      // Slug map covers every translation for locale switching (doc 10 §6).
      expect(result.slugs).toEqual({ en: 'slug-en', ar: 'slug-ar' });
    });
  });

  // D10-20: the article's own translation governs its visibility, so an article whose category
  // (or tag) has no translation in the requested locale stays readable. The include already
  // scopes taxonomy translations to that locale, so "absent here" means "absent in this locale".
  describe('taxonomy resolution (D10-20)', () => {
    // The payload the include produces when the category row exists but its translation for the
    // requested locale does not: the relation is loaded, its filtered translations array is empty.
    function untranslatedCategoryPayload() {
      const article = articlePayload(ContentStatus.PUBLISHED);
      return {
        ...article,
        category: { ...article.category, translations: [] },
      };
    }

    it('keeps the article visible and nulls the category when its translation is missing', async () => {
      prisma.articleTranslation.findUnique.mockResolvedValue({
        article: untranslatedCategoryPayload(),
      } as never);

      const result = await service.getPublicBySlug('slug-en', 'en');

      // The article itself is unaffected — this is an absent label, not an absent article.
      expect(result.title).toBe('Title en');
      expect(result.body).toContain('word');
      // Explicit null, not an omitted key and not `{ name: '', slug: '' }`.
      expect(result).toHaveProperty('category', null);
      expect(Object.keys(result)).toContain('category');
    });

    it('nulls the category rather than borrowing another locale’s label', async () => {
      // The AR read: the include filtered on 'ar', so the EN category translation the row also
      // owns is simply not in the payload. Nothing may reconstruct it.
      const article = articlePayload(ContentStatus.PUBLISHED, 'ar');
      prisma.articleTranslation.findUnique.mockResolvedValue({
        article: {
          ...article,
          category: { ...article.category, translations: [] },
        },
      } as never);

      const result = await service.getPublicBySlug('slug-ar', 'ar');

      expect(result.category).toBeNull();
      expect(JSON.stringify(result)).not.toContain('engineering');
      expect(JSON.stringify(result)).not.toContain('Engineering');
    });

    it('omits an untranslated tag instead of listing it blank', async () => {
      const article = articlePayload(ContentStatus.PUBLISHED);
      prisma.articleTranslation.findUnique.mockResolvedValue({
        article: {
          ...article,
          tags: [
            {
              articleId: 'a1',
              tagId: 'tag-translated',
              tag: {
                id: 'tag-translated',
                translations: [{ name: 'NestJS', slug: 'nestjs' }],
              },
            },
            {
              articleId: 'a1',
              tagId: 'tag-untranslated',
              tag: { id: 'tag-untranslated', translations: [] },
            },
          ],
        },
      } as never);

      const result = await service.getPublicBySlug('slug-en', 'en');

      // Omission, not a null entry and not a blank label (D10-20 §6).
      expect(result.tags).toEqual([
        { id: 'tag-translated', name: 'NestJS', slug: 'nestjs' },
      ]);
    });
  });

  describe('getPreviewById (D10-8 draft preview, status-agnostic)', () => {
    it('returns an unpublished (DRAFT) article by id, bypassing the PUBLISHED filter', async () => {
      prisma.article.findUnique.mockResolvedValue(
        articlePayload(ContentStatus.DRAFT),
      );

      const result = await service.getPreviewById('a1', 'en');

      expect(locales.assertEnabled).toHaveBeenCalledWith('en');
      expect(prisma.article.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'a1' } }),
      );
      // The draft resolves in the same shape a public read would produce.
      expect(result.title).toBe('Title en');
      expect(result.body).toContain('word');
      expect(result.slugs).toEqual({ en: 'slug-en', ar: 'slug-ar' });
    });

    it('404s when the article id does not exist', async () => {
      prisma.article.findUnique.mockResolvedValue(null);

      await expect(
        service.getPreviewById('missing', 'en'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('media descriptors (T7)', () => {
    const withMedia = (
      coverAlts: { locale: string; alt: string }[],
      ogAlts: { locale: string; alt: string }[],
    ): never => {
      const base = articlePayload(ContentStatus.PUBLISHED);
      return {
        ...base,
        coverImageId: 'cover-1',
        coverImage: imageAsset('cover-1', coverAlts),
        translations: base.translations.map((translation) => ({
          ...translation,
          ogImageId: translation.locale === 'en' ? 'og-1' : null,
          ogImage:
            translation.locale === 'en' ? imageAsset('og-1', ogAlts) : null,
        })),
      } as never;
    };

    it('resolves the cover descriptor on the list, retains coverImageId, and issues no per-item media query', async () => {
      prisma.$transaction.mockResolvedValue([
        [withMedia([{ locale: 'en', alt: 'Cover alt' }], [])],
        1,
      ] as never);

      const result = await service.listPublic({
        page: 1,
        perPage: 12,
        skip: 0,
        take: 12,
        locale: 'en',
      });
      const item = result.data[0]!;

      expect(item.coverImageId).toBe('cover-1');
      expect(item.coverImage).toEqual({
        id: 'cover-1',
        kind: MediaKind.IMAGE,
        url: 'https://media.test/media/cover-1/1920-webp.webp', // widest WebP
        width: 1920,
        height: 1080,
        blurhash: 'BH',
        alt: 'Cover alt',
        variants: [
          {
            format: MediaVariantFormat.AVIF,
            width: 1920,
            height: 1080,
            url: 'https://media.test/media/cover-1/1920-avif.avif',
          },
          {
            format: MediaVariantFormat.WEBP,
            width: 1920,
            height: 1080,
            url: 'https://media.test/media/cover-1/1920-webp.webp',
          },
        ],
      });
      // No N+1 — cover came from the parent article query.
      expect(prisma.mediaAsset.findUnique).not.toHaveBeenCalled();
      expect(prisma.mediaAsset.findMany).not.toHaveBeenCalled();
    });

    it('resolves the OG descriptor on detail and retains ogImageId', async () => {
      prisma.articleTranslation.findUnique.mockResolvedValue({
        article: withMedia(
          [{ locale: 'en', alt: 'Cover alt' }],
          [{ locale: 'en', alt: 'OG alt' }],
        ),
      } as never);

      const result = await service.getPublicBySlug('slug-en', 'en');

      expect(result.ogImageId).toBe('og-1');
      expect(result.ogImage?.id).toBe('og-1');
      expect(result.ogImage?.url).toBe(
        'https://media.test/media/og-1/1920-webp.webp',
      );
      expect(result.ogImage?.alt).toBe('OG alt');
      expect(result.coverImage?.id).toBe('cover-1');
    });

    it('returns coverImage/ogImage null when there is no media', async () => {
      prisma.articleTranslation.findUnique.mockResolvedValue({
        article: articlePayload(ContentStatus.PUBLISHED),
      } as never);

      const result = await service.getPublicBySlug('slug-en', 'en');

      expect(result.coverImageId).toBeNull();
      expect(result.coverImage).toBeNull();
      expect(result.ogImage).toBeNull();
    });

    it('returns alt: null for a missing-locale cover alt (no cross-locale fallback)', async () => {
      prisma.articleTranslation.findUnique.mockResolvedValue({
        article: withMedia([{ locale: 'en', alt: 'Cover alt' }], []),
      } as never);

      // Detail resolved to 'ar'; the cover has only an 'en' alt row.
      const result = await service.getPublicBySlug('slug-ar', 'ar');
      expect(result.coverImage?.alt).toBeNull();
    });

    it('preserves an empty-string cover alt (decorative)', async () => {
      prisma.articleTranslation.findUnique.mockResolvedValue({
        article: withMedia([{ locale: 'en', alt: '' }], []),
      } as never);

      const result = await service.getPublicBySlug('slug-en', 'en');
      expect(result.coverImage?.alt).toBe('');
    });
  });

  describe('listPublic', () => {
    it('returns a paginated resolved list with correct meta', async () => {
      prisma.$transaction.mockResolvedValue([
        [articlePayload(ContentStatus.PUBLISHED)],
        1,
      ]);

      const result = await service.listPublic({
        page: 1,
        perPage: 12,
        skip: 0,
        take: 12,
        locale: 'en',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.slug).toBe('slug-en');
      expect(result.meta).toEqual({
        page: 1,
        perPage: 12,
        total: 1,
        totalPages: 1,
      });
    });
  });

  describe('getPublicRelated', () => {
    it('ranks same category first, then shared tags, then publish date (doc 04 §5)', async () => {
      const source = relatedArticlePayload({
        id: 'source',
        status: ContentStatus.PUBLISHED,
        categoryId: 'category-source',
        tagIds: ['tag-a', 'tag-b'],
        publishAt: '2026-01-01T00:00:00.000Z',
        slug: 'source',
      });
      const sharedTwoTags = relatedArticlePayload({
        id: 'shared-two',
        status: ContentStatus.PUBLISHED,
        categoryId: 'category-other',
        tagIds: ['tag-a', 'tag-b'],
        publishAt: '2026-01-02T00:00:00.000Z',
        slug: 'shared-two',
      });
      const sameCategory = relatedArticlePayload({
        id: 'same-category',
        status: ContentStatus.PUBLISHED,
        categoryId: 'category-source',
        tagIds: [],
        publishAt: '2026-01-03T00:00:00.000Z',
        slug: 'same-category',
      });
      const sameCategorySharedTag = relatedArticlePayload({
        id: 'same-category-shared',
        status: ContentStatus.PUBLISHED,
        categoryId: 'category-source',
        tagIds: ['tag-a'],
        publishAt: '2026-01-01T00:00:00.000Z',
        slug: 'same-category-shared',
      });
      const sharedOneTag = relatedArticlePayload({
        id: 'shared-one',
        status: ContentStatus.PUBLISHED,
        categoryId: 'category-other',
        tagIds: ['tag-a'],
        publishAt: '2026-01-04T00:00:00.000Z',
        slug: 'shared-one',
      });
      const sharedOneTagOlder = relatedArticlePayload({
        id: 'shared-one-older',
        status: ContentStatus.PUBLISHED,
        categoryId: 'category-other',
        tagIds: ['tag-a'],
        publishAt: '2026-01-02T00:00:00.000Z',
        slug: 'shared-one-older',
      });
      prisma.articleTranslation.findUnique.mockResolvedValue({
        article: source,
      } as never);
      prisma.article.findMany.mockResolvedValue([
        sameCategory,
        sameCategorySharedTag,
        sharedOneTag,
        sharedOneTagOlder,
        sharedTwoTags,
      ] as never);

      const result = await service.getPublicRelated('source', 'en');

      expect(result.data.map((article) => article.id)).toEqual([
        'same-category-shared',
        'same-category',
        'shared-two',
      ]);
      expect(result.meta).toEqual({
        page: 1,
        perPage: 3,
        total: 3,
        totalPages: 1,
      });
    });

    it('excludes the source and unpublished candidates', async () => {
      const source = relatedArticlePayload({
        id: 'source',
        status: ContentStatus.PUBLISHED,
        categoryId: 'category-source',
        tagIds: ['tag-a'],
        publishAt: '2026-01-01T00:00:00.000Z',
        slug: 'source',
      });
      const published = relatedArticlePayload({
        id: 'published',
        status: ContentStatus.PUBLISHED,
        categoryId: 'category-source',
        tagIds: [],
        publishAt: '2026-01-02T00:00:00.000Z',
        slug: 'published',
      });
      const unpublished = relatedArticlePayload({
        id: 'unpublished',
        status: ContentStatus.DRAFT,
        categoryId: 'category-source',
        tagIds: [],
        publishAt: '2026-01-03T00:00:00.000Z',
        slug: 'unpublished',
      });
      prisma.articleTranslation.findUnique.mockResolvedValue({
        article: source,
      } as never);
      prisma.article.findMany.mockResolvedValue([
        source,
        unpublished,
        published,
      ] as never);

      const result = await service.getPublicRelated('source', 'en');

      expect(result.data.map((article) => article.id)).toEqual(['published']);
      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: ContentStatus.PUBLISHED,
            id: { not: 'source' },
          }),
        }),
      );
    });

    it('404s an unknown or unpublished source slug', async () => {
      prisma.articleTranslation.findUnique.mockResolvedValue(null);
      await expect(
        service.getPublicRelated('missing', 'en'),
      ).rejects.toBeInstanceOf(NotFoundException);

      prisma.articleTranslation.findUnique.mockResolvedValue({
        article: relatedArticlePayload({
          id: 'draft',
          status: ContentStatus.DRAFT,
          categoryId: 'category-source',
          tagIds: [],
          publishAt: '2026-01-01T00:00:00.000Z',
          slug: 'draft',
        }),
      } as never);
      await expect(
        service.getPublicRelated('draft', 'en'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create scheduling (doc 10 §6)', () => {
    it('rejects a SCHEDULED article without a future publishAt (422)', async () => {
      await expect(
        service.create({
          categoryId: 'c1',
          status: ContentStatus.SCHEDULED,
          publishAt: '2000-01-01T00:00:00.000Z',
          translations: [
            { locale: 'en', title: 'T', slug: 's', excerpt: 'e', body: 'b' },
          ],
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(prisma.article.create).not.toHaveBeenCalled();
    });
  });

  describe('promoteScheduled (D07-3, idempotent)', () => {
    it('flips due SCHEDULED articles in a single updateMany and returns the count', async () => {
      const now = new Date('2026-07-13T12:00:00.000Z');
      prisma.article.updateMany.mockResolvedValue({ count: 3 });

      const promoted = await service.promoteScheduled(now);

      expect(promoted).toBe(3);
      expect(prisma.article.updateMany).toHaveBeenCalledWith({
        where: { status: ContentStatus.SCHEDULED, publishAt: { lte: now } },
        data: { status: ContentStatus.PUBLISHED },
      });
    });

    it('is a no-op when nothing is due', async () => {
      prisma.article.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.promoteScheduled()).resolves.toBe(0);
    });
  });

  // D04-6 gating only. The 3-op DB behavior (chain-collapse, rename-back, atomicity across rows) is
  // covered by the buildRedirectOps unit test (T4) and the e2e suite (T9); here we assert solely the
  // publish-time predicate and that the returned ops land in the same $transaction as the rename.
  /**
   * `publishAt` write semantics on PATCH (D10-23).
   *
   * The update path read its candidate as `dto.publishAt !== undefined ? new Date(dto.publishAt) : …`.
   * `null !== undefined` is TRUE, so an explicit `null` took the conversion branch and
   * `new Date(null)` is the Unix EPOCH — not a cleared column. A published article silently
   * acquired a 1970 publish instant and sorted last forever under `orderBy: publishAt desc`.
   *
   * The create path never had the defect: it tests `dto.publishAt ? … : null` (truthy), so `null`
   * already meant "unscheduled". The two paths disagreed inside one file.
   *
   * The epoch guard at the end is what stops this suite passing vacuously: every assertion here
   * would still hold if `publishAt` were silently stamped 1970 in some OTHER branch, so the value is
   * asserted to be anything-but-epoch across the whole matrix rather than only where it is expected.
   */
  describe('update publishAt semantics (D10-23)', () => {
    const enTx = {
      locale: 'en',
      title: 'T',
      slug: 'slug-en',
      excerpt: 'e',
      body: 'b',
    };
    const EPOCH = 0;

    /** The `data` object handed to `prisma.article.update` inside the transaction op-set. */
    const writtenData = (): { publishAt?: Date | null } =>
      (
        prisma.article.update.mock.calls[0]![0] as unknown as {
          data: { publishAt?: Date | null };
        }
      ).data;

    it('CONTROL: an omitted publishAt preserves the stored instant', async () => {
      prisma.article.findUnique.mockResolvedValue(
        articlePayload(ContentStatus.DRAFT),
      );

      await service.update('a1', { translations: [enTx] });

      // Proves the harness reads the right field and that the fixture's instant is observable —
      // without this, "not the epoch" below could pass because nothing was written at all.
      expect(writtenData().publishAt).toEqual(
        new Date('2026-01-01T00:00:00.000Z'),
      );
    });

    it('clears publishAt when an explicit null is sent (DRAFT)', async () => {
      prisma.article.findUnique.mockResolvedValue(
        articlePayload(ContentStatus.DRAFT),
      );

      await service.update('a1', { publishAt: null, translations: [enTx] });

      expect(writtenData().publishAt).toBeNull();
    });

    it('CONTROL: a supplied date is stored as exactly that date', async () => {
      prisma.article.findUnique.mockResolvedValue(
        articlePayload(ContentStatus.DRAFT),
      );

      await service.update('a1', {
        publishAt: '2030-06-01T12:00:00.000Z',
        translations: [enTx],
      });

      expect(writtenData().publishAt).toEqual(
        new Date('2030-06-01T12:00:00.000Z'),
      );
    });

    it('stamps PUBLISHED + null with now, never the epoch (invariant preserved)', async () => {
      prisma.article.findUnique.mockResolvedValue(
        articlePayload(ContentStatus.PUBLISHED),
      );
      const before = Date.now();

      await service.update('a1', {
        status: ContentStatus.PUBLISHED,
        publishAt: null,
        translations: [enTx],
      });

      // resolvePublishAt's `candidate ?? new Date()` keeps list ordering stable (doc 10 §6). Under
      // the defect `candidate` was the epoch — truthy — so `??` never fired and 1970 was stored.
      const written = writtenData().publishAt;
      expect(written).toBeInstanceOf(Date);
      expect(written!.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('still rejects SCHEDULED + null with a 422 (scheduling invariant intact)', async () => {
      prisma.article.findUnique.mockResolvedValue(
        articlePayload(ContentStatus.DRAFT),
      );

      await expect(
        service.update('a1', {
          status: ContentStatus.SCHEDULED,
          publishAt: null,
          translations: [enTx],
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('still rejects SCHEDULED with a PAST publishAt (422)', async () => {
      prisma.article.findUnique.mockResolvedValue(
        articlePayload(ContentStatus.DRAFT),
      );

      await expect(
        service.update('a1', {
          status: ContentStatus.SCHEDULED,
          publishAt: '2020-01-01T00:00:00.000Z',
          translations: [enTx],
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('GUARD: never writes the Unix epoch, for any status/publishAt combination', async () => {
      const cases: {
        status: ContentStatus;
        publishAt: string | null | undefined;
      }[] = [
        { status: ContentStatus.DRAFT, publishAt: null },
        { status: ContentStatus.DRAFT, publishAt: undefined },
        { status: ContentStatus.PUBLISHED, publishAt: null },
        { status: ContentStatus.ARCHIVED, publishAt: null },
        { status: ContentStatus.ARCHIVED, publishAt: undefined },
      ];

      for (const { status, publishAt } of cases) {
        jest.clearAllMocks();
        redirects.buildRedirectOps.mockReturnValue([]);
        prisma.article.findUnique.mockResolvedValue(articlePayload(status));

        await service.update('a1', {
          status,
          ...(publishAt === undefined ? {} : { publishAt }),
          translations: [enTx],
        });

        const written = writtenData().publishAt;
        if (written !== null && written !== undefined) {
          expect(
            `${status}/${String(publishAt)}: ${written.getTime()}`,
          ).not.toBe(`${status}/${String(publishAt)}: ${EPOCH}`);
        }
      }
    });
  });

  describe('update (D04-6 auto-redirect on published slug rename)', () => {
    // Sentinel op-set standing in for buildRedirectOps' 3 real ops; identity is asserted in the tx.
    const redirectOps = [
      { __redirectOp: 'updateMany' },
      { __redirectOp: 'deleteMany' },
      { __redirectOp: 'create' },
    ] as unknown as Prisma.PrismaPromise<unknown>[];

    const renameEn = {
      locale: 'en',
      title: 'T',
      slug: 'slug-en-v2',
      excerpt: 'e',
      body: 'b',
    };

    it('creates one redirect op-set when a published article locale slug changes (a→b)', async () => {
      prisma.article.findUnique.mockResolvedValue(
        articlePayload(ContentStatus.PUBLISHED),
      );
      redirects.buildRedirectOps.mockReturnValue(redirectOps);

      await service.update('a1', { translations: [renameEn] });

      expect(redirects.buildRedirectOps).toHaveBeenCalledTimes(1);
      expect(redirects.buildRedirectOps).toHaveBeenCalledWith({
        locale: 'en',
        entityType: 'article',
        oldSlug: 'slug-en',
        newSlug: 'slug-en-v2',
      });
      const txOps = prisma.$transaction.mock
        .calls[0]![0] as unknown as unknown[];
      expect(txOps).toEqual(expect.arrayContaining(redirectOps));
    });

    it('does not create a redirect when the article is not published (draft)', async () => {
      prisma.article.findUnique.mockResolvedValue(
        articlePayload(ContentStatus.DRAFT),
      );

      await service.update('a1', { translations: [renameEn] });

      expect(redirects.buildRedirectOps).not.toHaveBeenCalled();
    });

    it('does not create a redirect when the slug is unchanged', async () => {
      prisma.article.findUnique.mockResolvedValue(
        articlePayload(ContentStatus.PUBLISHED),
      );

      await service.update('a1', {
        translations: [{ ...renameEn, slug: 'slug-en' }],
      });

      expect(redirects.buildRedirectOps).not.toHaveBeenCalled();
    });

    it('does not create a redirect on a draft→published rename (old slug was never public)', async () => {
      prisma.article.findUnique.mockResolvedValue(
        articlePayload(ContentStatus.DRAFT),
      );

      await service.update('a1', {
        status: ContentStatus.PUBLISHED,
        translations: [renameEn],
      });

      expect(redirects.buildRedirectOps).not.toHaveBeenCalled();
    });

    it('does not create a redirect on a published→unpublished rename (new slug not live)', async () => {
      prisma.article.findUnique.mockResolvedValue(
        articlePayload(ContentStatus.PUBLISHED),
      );

      await service.update('a1', {
        status: ContentStatus.ARCHIVED,
        translations: [renameEn],
      });

      expect(redirects.buildRedirectOps).not.toHaveBeenCalled();
    });

    it('creates a redirect only for the changed locale (en changed, ar unchanged)', async () => {
      prisma.article.findUnique.mockResolvedValue(
        articlePayload(ContentStatus.PUBLISHED),
      );
      redirects.buildRedirectOps.mockReturnValue(redirectOps);

      await service.update('a1', {
        translations: [
          renameEn,
          {
            locale: 'ar',
            title: 'T',
            slug: 'slug-ar',
            excerpt: 'e',
            body: 'b',
          },
        ],
      });

      expect(redirects.buildRedirectOps).toHaveBeenCalledTimes(1);
      expect(redirects.buildRedirectOps).toHaveBeenCalledWith({
        locale: 'en',
        entityType: 'article',
        oldSlug: 'slug-en',
        newSlug: 'slug-en-v2',
      });
    });
  });
});
