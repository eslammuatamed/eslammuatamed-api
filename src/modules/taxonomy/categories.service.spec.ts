import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Category, CategoryTranslation } from '../../generated/prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalesService } from '../locales/locales.service';
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

function categoryRow(translations: CategoryTranslation[]): CategoryRow {
  return {
    id: 'c1',
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
});
