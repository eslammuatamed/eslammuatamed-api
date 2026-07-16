import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Skill, SkillGroup, SkillTranslation } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalesService } from '../locales/locales.service';
import { CreateSkillDto, UpdateSkillDto } from './dto/skill.dto';
import { AdminSkillEntity, PublicSkillEntity } from './entities/skill.entities';

type SkillWithTranslations = Skill & { translations: SkillTranslation[] };

@Injectable()
export class SkillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locales: LocalesService,
  ) {}

  async listPublic(locale: string): Promise<PublicSkillEntity[]> {
    await this.locales.assertEnabled(locale);
    const rows = await this.prisma.skill.findMany({
      include: { translations: true },
      orderBy: [{ group: 'asc' }, { order: 'asc' }],
    });
    return [...rows]
      .sort(compareSkills)
      .map((row) => this.resolvePublic(row, locale))
      .filter((row): row is PublicSkillEntity => row !== null);
  }

  async listAdmin(): Promise<AdminSkillEntity[]> {
    const rows = await this.prisma.skill.findMany({
      include: { translations: true },
      orderBy: [{ group: 'asc' }, { order: 'asc' }],
    });
    return rows.sort(compareSkills).map(toAdminEntity);
  }

  async getAdmin(id: string): Promise<AdminSkillEntity> {
    return toAdminEntity(await this.getOrThrow(id));
  }

  async create(dto: CreateSkillDto): Promise<AdminSkillEntity> {
    await this.assertTranslations(dto.translations);
    const row = await this.prisma.skill.create({
      data: {
        group: dto.group,
        order: dto.order,
        brandColor: dto.brandColor,
        translations: { create: dto.translations },
      },
      include: { translations: true },
    });
    return toAdminEntity(row);
  }

  async update(id: string, dto: UpdateSkillDto): Promise<AdminSkillEntity> {
    await this.getOrThrow(id);
    if (dto.translations) await this.assertTranslations(dto.translations);
    const ops: Prisma.PrismaPromise<unknown>[] = [];
    const base: Prisma.SkillUpdateInput = {
      group: dto.group,
      order: dto.order,
      brandColor: dto.brandColor,
    };
    if (Object.values(base).some((value) => value !== undefined))
      ops.push(this.prisma.skill.update({ where: { id }, data: base }));
    for (const translation of dto.translations ?? []) {
      ops.push(
        this.prisma.skillTranslation.upsert({
          where: {
            skillId_locale: { skillId: id, locale: translation.locale },
          },
          create: { skillId: id, ...translation },
          update: { label: translation.label },
        }),
      );
    }
    if (ops.length) await this.prisma.$transaction(ops);
    return this.getAdmin(id);
  }

  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    try {
      await this.prisma.skill.delete({ where: { id } });
    } catch (error) {
      if (isPrismaCode(error, 'P2003') || isPrismaCode(error, 'P2014'))
        throw new ConflictException('Skill is still linked to a project.');
      throw error;
    }
  }

  private async assertTranslations(
    translations: readonly { locale: string }[],
  ): Promise<void> {
    for (const translation of translations)
      await this.locales.assertEnabled(translation.locale);
  }
  private async getOrThrow(id: string): Promise<SkillWithTranslations> {
    const row = await this.prisma.skill.findUnique({
      where: { id },
      include: { translations: true },
    });
    if (!row) throw new NotFoundException('Skill not found.');
    return row;
  }
  private resolvePublic(
    row: SkillWithTranslations,
    locale: string,
  ): PublicSkillEntity | null {
    const translation = row.translations.find((item) => item.locale === locale);
    if (!translation) return null;
    return {
      id: row.id,
      label: translation.label,
      group: row.group,
      order: row.order,
      brandColor: row.brandColor,
      availableLocales: row.translations.map((item) => item.locale).sort(),
    };
  }
}

function toAdminEntity(row: SkillWithTranslations): AdminSkillEntity {
  const translations: Record<string, { label: string }> = {};
  for (const translation of row.translations)
    translations[translation.locale] = { label: translation.label };
  return {
    id: row.id,
    group: row.group,
    order: row.order,
    brandColor: row.brandColor,
    translations,
  };
}
function isPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}

function compareSkills(a: Skill, b: Skill): number {
  const groups = Object.values(SkillGroup);
  return groups.indexOf(a.group) - groups.indexOf(b.group) || a.order - b.order;
}
