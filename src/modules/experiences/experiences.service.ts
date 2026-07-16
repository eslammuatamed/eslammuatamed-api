import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  EmploymentType,
  Experience,
  ExperienceTranslation,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalesService } from '../locales/locales.service';
import { CreateExperienceDto, UpdateExperienceDto } from './dto/experience.dto';
import {
  AdminExperienceEntity,
  PublicExperienceEntity,
} from './entities/experience.entities';

type ExperienceWithTranslations = Experience & {
  translations: ExperienceTranslation[];
};

@Injectable()
export class ExperiencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locales: LocalesService,
  ) {}

  async listPublic(locale: string): Promise<PublicExperienceEntity[]> {
    await this.locales.assertEnabled(locale);
    const rows = await this.prisma.experience.findMany({
      include: { translations: true },
      orderBy: [{ startDate: 'desc' }, { order: 'asc' }],
    });
    return [...rows]
      .sort(compareExperiences)
      .map((row) => this.resolvePublic(row, locale))
      .filter((row): row is PublicExperienceEntity => row !== null);
  }
  async listAdmin(): Promise<AdminExperienceEntity[]> {
    const rows = await this.prisma.experience.findMany({
      include: { translations: true },
      orderBy: [{ startDate: 'desc' }, { order: 'asc' }],
    });
    return rows.sort(compareExperiences).map(toAdminEntity);
  }
  async getAdmin(id: string): Promise<AdminExperienceEntity> {
    return toAdminEntity(await this.getOrThrow(id));
  }
  async create(dto: CreateExperienceDto): Promise<AdminExperienceEntity> {
    assertEmploymentType(dto.employmentType);
    await this.assertTranslations(dto.translations);
    const row = await this.prisma.experience.create({
      data: {
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        isCurrent: dto.isCurrent,
        employmentType: dto.employmentType,
        order: dto.order,
        translations: { create: dto.translations },
      },
      include: { translations: true },
    });
    return toAdminEntity(row);
  }
  async update(
    id: string,
    dto: UpdateExperienceDto,
  ): Promise<AdminExperienceEntity> {
    await this.getOrThrow(id);
    if (dto.employmentType !== undefined)
      assertEmploymentType(dto.employmentType);
    if (dto.translations) await this.assertTranslations(dto.translations);
    const data: Prisma.ExperienceUpdateInput = {
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate:
        dto.endDate === undefined
          ? undefined
          : dto.endDate
            ? new Date(dto.endDate)
            : null,
      isCurrent: dto.isCurrent,
      employmentType: dto.employmentType,
      order: dto.order,
    };
    const ops: Prisma.PrismaPromise<unknown>[] = [];
    if (Object.values(data).some((value) => value !== undefined))
      ops.push(this.prisma.experience.update({ where: { id }, data }));
    for (const translation of dto.translations ?? [])
      ops.push(
        this.prisma.experienceTranslation.upsert({
          where: {
            experienceId_locale: {
              experienceId: id,
              locale: translation.locale,
            },
          },
          create: { experienceId: id, ...translation },
          update: {
            role: translation.role,
            company: translation.company,
            location: translation.location,
            impact: translation.impact,
          },
        }),
      );
    if (ops.length) await this.prisma.$transaction(ops);
    return this.getAdmin(id);
  }
  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    await this.prisma.experience.delete({ where: { id } });
  }
  private async assertTranslations(
    translations: readonly { locale: string }[],
  ): Promise<void> {
    for (const translation of translations)
      await this.locales.assertEnabled(translation.locale);
  }
  private async getOrThrow(id: string): Promise<ExperienceWithTranslations> {
    const row = await this.prisma.experience.findUnique({
      where: { id },
      include: { translations: true },
    });
    if (!row) throw new NotFoundException('Experience not found.');
    return row;
  }
  private resolvePublic(
    row: ExperienceWithTranslations,
    locale: string,
  ): PublicExperienceEntity | null {
    const translation = row.translations.find((item) => item.locale === locale);
    if (!translation) return null;
    return {
      id: row.id,
      role: translation.role,
      company: translation.company,
      location: translation.location,
      impact: translation.impact,
      employmentType: row.employmentType,
      isCurrent: row.isCurrent,
      startDate: row.startDate,
      endDate: row.endDate,
      order: row.order,
      availableLocales: row.translations.map((item) => item.locale).sort(),
    };
  }
}

function assertEmploymentType(value: EmploymentType): void {
  if (!Object.values(EmploymentType).includes(value))
    throw new UnprocessableEntityException('Invalid employment type.');
}
function toAdminEntity(row: ExperienceWithTranslations): AdminExperienceEntity {
  const translations: Record<
    string,
    { role: string; company: string; location: string; impact: string }
  > = {};
  for (const translation of row.translations)
    translations[translation.locale] = {
      role: translation.role,
      company: translation.company,
      location: translation.location,
      impact: translation.impact,
    };
  return {
    id: row.id,
    startDate: row.startDate,
    endDate: row.endDate,
    isCurrent: row.isCurrent,
    employmentType: row.employmentType,
    order: row.order,
    translations,
  };
}

function compareExperiences(a: Experience, b: Experience): number {
  return b.startDate.getTime() - a.startDate.getTime() || a.order - b.order;
}
