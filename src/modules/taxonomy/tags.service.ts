import { Injectable, NotFoundException } from '@nestjs/common';
import { Tag, TagTranslation } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalesService } from '../locales/locales.service';
import { CreateTagDto, UpdateTagDto } from './dto/tag.dto';
import {
  AdminTagEntity,
  PublicTagEntity,
  TagTranslationEntity,
} from './entities/tag.entities';

type TagWithTranslations = Tag & { translations: TagTranslation[] };

@Injectable()
export class TagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locales: LocalesService,
  ) {}

  async listPublic(locale: string): Promise<PublicTagEntity[]> {
    await this.locales.assertEnabled(locale);
    const tags = await this.prisma.tag.findMany({
      include: { translations: true },
      orderBy: { createdAt: 'asc' },
    });
    return tags
      .map((tag) => this.resolvePublic(tag, locale))
      .filter((tag): tag is PublicTagEntity => tag !== null);
  }

  async listAdmin(): Promise<AdminTagEntity[]> {
    const tags = await this.prisma.tag.findMany({
      include: { translations: true },
      orderBy: { createdAt: 'asc' },
    });
    return tags.map((tag) => toAdminEntity(tag));
  }

  async create(dto: CreateTagDto): Promise<AdminTagEntity> {
    for (const translation of dto.translations) {
      await this.locales.assertEnabled(translation.locale);
    }
    const tag = await this.prisma.tag.create({
      data: {
        translations: {
          create: dto.translations.map((translation) => ({
            locale: translation.locale,
            name: translation.name,
            slug: translation.slug,
          })),
        },
      },
      include: { translations: true },
    });
    return toAdminEntity(tag);
  }

  async update(id: string, dto: UpdateTagDto): Promise<AdminTagEntity> {
    await this.getOrThrow(id);
    for (const translation of dto.translations ?? []) {
      await this.locales.assertEnabled(translation.locale);
    }

    const operations = (dto.translations ?? []).map((translation) =>
      this.prisma.tagTranslation.upsert({
        where: { tagId_locale: { tagId: id, locale: translation.locale } },
        create: {
          tagId: id,
          locale: translation.locale,
          name: translation.name,
          slug: translation.slug,
        },
        update: { name: translation.name, slug: translation.slug },
      }),
    );
    if (operations.length > 0) {
      await this.prisma.$transaction(operations);
    }

    const tag = await this.getOrThrow(id);
    return toAdminEntity(tag);
  }

  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    await this.prisma.tag.delete({ where: { id } });
  }

  private async getOrThrow(id: string): Promise<TagWithTranslations> {
    const tag = await this.prisma.tag.findUnique({
      where: { id },
      include: { translations: true },
    });
    if (!tag) {
      throw new NotFoundException('Tag not found.');
    }
    return tag;
  }

  private resolvePublic(
    tag: TagWithTranslations,
    locale: string,
  ): PublicTagEntity | null {
    const translation = tag.translations.find((t) => t.locale === locale);
    if (!translation) {
      return null;
    }
    return {
      id: tag.id,
      name: translation.name,
      slug: translation.slug,
      availableLocales: tag.translations.map((t) => t.locale).sort(),
    };
  }
}

function toAdminEntity(tag: TagWithTranslations): AdminTagEntity {
  const translations: Record<string, TagTranslationEntity> = {};
  for (const translation of tag.translations) {
    translations[translation.locale] = {
      name: translation.name,
      slug: translation.slug,
    };
  }
  return { id: tag.id, translations };
}
