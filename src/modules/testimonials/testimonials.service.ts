import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Testimonial, TestimonialTranslation } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalesService } from '../locales/locales.service';
import { MediaDescriptorResolver } from '../media/media-descriptor.resolver';
import {
  CreateTestimonialDto,
  UpdateTestimonialDto,
} from './dto/testimonial.dto';
import {
  AdminTestimonialEntity,
  PublicTestimonialEntity,
} from './entities/testimonial.entities';

type TestimonialWithTranslations = Testimonial & {
  translations: TestimonialTranslation[];
};

// Public rows additionally load the avatar with its variants + alts so the descriptor resolves in
// the same query (no N+1, doc 20 §7).
type PublicTestimonialRow = Prisma.TestimonialGetPayload<{
  include: {
    translations: true;
    avatar: { include: { variants: true; alts: true } };
  };
}>;

@Injectable()
export class TestimonialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locales: LocalesService,
    private readonly mediaDescriptors: MediaDescriptorResolver,
  ) {}
  async listPublic(locale: string): Promise<PublicTestimonialEntity[]> {
    await this.locales.assertEnabled(locale);
    const rows = await this.prisma.testimonial.findMany({
      where: { isVisible: true },
      include: {
        translations: true,
        avatar: { include: { variants: true, alts: true } },
      },
      orderBy: { order: 'asc' },
    });
    return [...rows]
      .sort((a, b) => a.order - b.order)
      .filter((row) => row.isVisible)
      .map((row) => this.resolvePublic(row, locale))
      .filter((row): row is PublicTestimonialEntity => row !== null);
  }
  async listAdmin(): Promise<AdminTestimonialEntity[]> {
    const rows = await this.prisma.testimonial.findMany({
      include: { translations: true },
      orderBy: { order: 'asc' },
    });
    return rows.sort((a, b) => a.order - b.order).map(toAdminEntity);
  }
  async getAdmin(id: string): Promise<AdminTestimonialEntity> {
    return toAdminEntity(await this.getOrThrow(id));
  }
  async create(dto: CreateTestimonialDto): Promise<AdminTestimonialEntity> {
    await this.assertTranslations(dto.translations);
    const row = await this.prisma.testimonial.create({
      data: {
        avatarId: dto.avatarId,
        order: dto.order,
        isVisible: dto.isVisible,
        translations: { create: dto.translations },
      },
      include: { translations: true },
    });
    return toAdminEntity(row);
  }
  async update(
    id: string,
    dto: UpdateTestimonialDto,
  ): Promise<AdminTestimonialEntity> {
    await this.getOrThrow(id);
    if (dto.translations) await this.assertTranslations(dto.translations);
    const data: Prisma.TestimonialUncheckedUpdateInput = {
      avatarId: dto.avatarId,
      order: dto.order,
      isVisible: dto.isVisible,
    };
    const ops: Prisma.PrismaPromise<unknown>[] = [];
    if (Object.values(data).some((value) => value !== undefined))
      ops.push(this.prisma.testimonial.update({ where: { id }, data }));
    for (const translation of dto.translations ?? [])
      ops.push(
        this.prisma.testimonialTranslation.upsert({
          where: {
            testimonialId_locale: {
              testimonialId: id,
              locale: translation.locale,
            },
          },
          create: { testimonialId: id, ...translation },
          update: {
            quote: translation.quote,
            authorName: translation.authorName,
            authorRole: translation.authorRole,
          },
        }),
      );
    if (ops.length) await this.prisma.$transaction(ops);
    return this.getAdmin(id);
  }
  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    await this.prisma.testimonial.delete({ where: { id } });
  }
  private async assertTranslations(
    translations: readonly { locale: string }[],
  ): Promise<void> {
    for (const translation of translations)
      await this.locales.assertEnabled(translation.locale);
  }
  private async getOrThrow(id: string): Promise<TestimonialWithTranslations> {
    const row = await this.prisma.testimonial.findUnique({
      where: { id },
      include: { translations: true },
    });
    if (!row) throw new NotFoundException('Testimonial not found.');
    return row;
  }
  private resolvePublic(
    row: PublicTestimonialRow,
    locale: string,
  ): PublicTestimonialEntity | null {
    const translation = row.translations.find((item) => item.locale === locale);
    if (!translation) return null;
    return {
      id: row.id,
      avatarId: row.avatarId,
      avatar: row.avatar
        ? this.mediaDescriptors.resolveImage(row.avatar, locale)
        : null,
      order: row.order,
      quote: translation.quote,
      authorName: translation.authorName,
      authorRole: translation.authorRole,
      availableLocales: row.translations.map((item) => item.locale).sort(),
    };
  }
}

function toAdminEntity(
  row: TestimonialWithTranslations,
): AdminTestimonialEntity {
  const translations: Record<
    string,
    { quote: string; authorName: string; authorRole: string }
  > = {};
  for (const translation of row.translations)
    translations[translation.locale] = {
      quote: translation.quote,
      authorName: translation.authorName,
      authorRole: translation.authorRole,
    };
  return {
    id: row.id,
    avatarId: row.avatarId,
    order: row.order,
    isVisible: row.isVisible,
    translations,
  };
}
