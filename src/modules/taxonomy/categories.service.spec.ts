import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Category, CategoryTranslation } from '../../generated/prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalesService } from '../locales/locales.service';
import { AdminCategoryListQueryDto } from './dto/category.dto';
import { CategoriesService } from './categories.service';

type CategoryRow = Category & { translations: CategoryTranslation[] };

function translation(locale: string, slug: string): CategoryTranslation {
  return {
    id: `ct-${locale}`,
    categoryId: 'c1',
    locale,
    name: `Name ${locale}`,
    slug,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function categoryRow(
  translations: CategoryTranslation[],
  id = 'c1',
): CategoryRow {
  return {
    id,
    createdAt: new Date(),
    updatedAt: new Date(),
    translations,
  };
}

describe('CategoriesService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let locales: DeepMockProxy<LocalesService>;
  let service: CategoriesService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    locales = mockDeep<LocalesService>();
    service = new CategoriesService(prisma, locales);
  });

  it('resolves the public list to the requested locale and omits untranslated categories', async () => {
    prisma.category.findMany.mockResolvedValue([
      categoryRow([
        translation('en', 'engineering'),
        translation('ar', 'handasa'),
      ]),
      categoryRow([translation('en', 'career')]), // no 'ar' → excluded for ar
    ]);

    const result = await service.listPublic('ar');

    expect(locales.assertEnabled).toHaveBeenCalledWith('ar');
    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe('handasa');
    expect(result[0]?.availableLocales).toEqual(['ar', 'en']);
  });

  it('validates every translation locale before creating', async () => {
    locales.assertEnabled.mockRejectedValueOnce(new BadRequestException());

    await expect(
      service.create({
        translations: [{ locale: 'zz', name: 'X', slug: 'x' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.category.create).not.toHaveBeenCalled();
  });

  it('throws NotFound when updating a missing category', async () => {
    prisma.category.findUnique.mockResolvedValue(null);

    await expect(
      service.update('missing', { translations: [] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('listAdmin pagination', () => {
    const query = (
      overrides: Partial<AdminCategoryListQueryDto> = {},
    ): AdminCategoryListQueryDto =>
      Object.assign(new AdminCategoryListQueryDto(), overrides);

    it('orders before pagination with an id tie-breaker and shares one predicate with total', async () => {
      const first = categoryRow([translation('en', 'first')], 'aaa');
      const second = categoryRow([translation('en', 'second')], 'bbb');
      prisma.$transaction.mockResolvedValue([[first, second], 4] as never);

      const result = await service.listAdmin(query({ page: 2, perPage: 2 }));

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: {},
        include: { translations: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: 2,
        take: 2,
      });
      expect(prisma.category.count).toHaveBeenCalledWith({ where: {} });
      expect(result.data.map((item) => item.id)).toEqual(['aaa', 'bbb']);
      expect(result.meta).toEqual({
        page: 2,
        perPage: 2,
        total: 4,
        totalPages: 2,
      });
    });

    it('uses PaginationQueryDto defaults for the first admin page', async () => {
      prisma.$transaction.mockResolvedValue([[], 0] as never);

      const result = await service.listAdmin(query());

      expect(prisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 12 }),
      );
      expect(result.meta).toEqual({
        page: 1,
        perPage: 12,
        total: 0,
        totalPages: 0,
      });
    });

    it('keeps the public locale-resolved unpaginated query path unchanged', async () => {
      prisma.category.findMany.mockResolvedValue([
        categoryRow([translation('en', 'engineering')]),
      ]);

      await service.listPublic('en');

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        include: { translations: true },
        orderBy: { createdAt: 'asc' },
      });
      expect(prisma.category.count).not.toHaveBeenCalled();
    });
  });
});
