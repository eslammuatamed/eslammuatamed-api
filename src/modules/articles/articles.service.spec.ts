import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalesService } from '../locales/locales.service';
import { ArticlesService } from './articles.service';

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

describe('ArticlesService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let locales: DeepMockProxy<LocalesService>;
  let service: ArticlesService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    locales = mockDeep<LocalesService>();
    service = new ArticlesService(prisma, locales);
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
      expect(result.category.slug).toBe('engineering');
      expect(result.readingTimeMin).toBe(2);
      expect(result.body).toContain('word');
      // Slug map covers every translation for locale switching (doc 10 §6).
      expect(result.slugs).toEqual({ en: 'slug-en', ar: 'slug-ar' });
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
});
