import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Category,
  CategoryTranslation,
  Prisma,
} from '../../generated/prisma/client';
import {
  buildPageMeta,
  PaginatedResult,
} from '../../common/pagination/page-meta';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalesService } from '../locales/locales.service';
import {
  AdminCategoryListQueryDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/category.dto';
import {
  AdminCategoryEntity,
  CategoryTranslationEntity,
  PublicCategoryEntity,
} from './entities/category.entities';

type CategoryWithTranslations = Category & {
  translations: CategoryTranslation[];
};

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locales: LocalesService,
  ) {}

  // Public list resolved to one locale (D10-6): a category with no translation in the
  // requested locale is omitted, never resolved from another locale.
  async listPublic(locale: string): Promise<PublicCategoryEntity[]> {
    await this.locales.assertEnabled(locale);
    const categories = await this.prisma.category.findMany({
      include: { translations: true },
      orderBy: { createdAt: 'asc' },
    });
    return categories
      .map((category) => this.resolvePublic(category, locale))
      .filter(
        (category): category is PublicCategoryEntity => category !== null,
      );
  }

  async listAdmin(
    query: AdminCategoryListQueryDto,
  ): Promise<PaginatedResult<AdminCategoryEntity>> {
    const where: Prisma.CategoryWhereInput = {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where,
        include: { translations: true },
        // Apply the full collection order before pagination. UUIDs make equal timestamps stable.
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.category.count({ where }),
    ]);
    return new PaginatedResult(
      rows.map((category) => toAdminEntity(category)),
      buildPageMeta(query.page, query.perPage, total),
    );
  }

  async create(dto: CreateCategoryDto): Promise<AdminCategoryEntity> {
    for (const translation of dto.translations) {
      await this.locales.assertEnabled(translation.locale);
    }
    const category = await this.prisma.category.create({
      data: {
        translations: {
          create: dto.translations.map((translation) => ({
            locale: translation.locale,
            name: translation.name,
            slug: translation.slug,
            description: translation.description,
          })),
        },
      },
      include: { translations: true },
    });
    return toAdminEntity(category);
  }

  async update(
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<AdminCategoryEntity> {
    await this.getOrThrow(id);
    for (const translation of dto.translations ?? []) {
      await this.locales.assertEnabled(translation.locale);
    }

    const operations = (dto.translations ?? []).map((translation) =>
      this.prisma.categoryTranslation.upsert({
        where: {
          categoryId_locale: { categoryId: id, locale: translation.locale },
        },
        create: {
          categoryId: id,
          locale: translation.locale,
          name: translation.name,
          slug: translation.slug,
          description: translation.description,
        },
        update: {
          name: translation.name,
          slug: translation.slug,
          description: translation.description,
        },
      }),
    );
    if (operations.length > 0) {
      await this.prisma.$transaction(operations);
    }

    const category = await this.getOrThrow(id);
    return toAdminEntity(category);
  }

  // Hard delete (D09-3): a category still referenced by articles is RESTRICT-guarded at the DB
  // and surfaces as a 409 (Prisma P2003 mapping). Re-categorize first.
  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    await this.prisma.category.delete({ where: { id } });
  }

  private async getOrThrow(id: string): Promise<CategoryWithTranslations> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { translations: true },
    });
    if (!category) {
      throw new NotFoundException('Category not found.');
    }
    return category;
  }

  private resolvePublic(
    category: CategoryWithTranslations,
    locale: string,
  ): PublicCategoryEntity | null {
    const translation = category.translations.find((t) => t.locale === locale);
    if (!translation) {
      return null;
    }
    return {
      id: category.id,
      name: translation.name,
      slug: translation.slug,
      description: translation.description,
      availableLocales: category.translations.map((t) => t.locale).sort(),
    };
  }
}

function toAdminEntity(
  category: CategoryWithTranslations,
): AdminCategoryEntity {
  const translations: Record<string, CategoryTranslationEntity> = {};
  for (const translation of category.translations) {
    translations[translation.locale] = {
      name: translation.name,
      slug: translation.slug,
      description: translation.description,
    };
  }
  return { id: category.id, translations };
}
