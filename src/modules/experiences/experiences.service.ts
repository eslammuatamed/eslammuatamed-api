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

// Technologies load with the experience, each carrying its skill and the locale-filtered
// translation, so labels resolve in the same query (no N+1) — mirrors PUBLIC_INCLUDE in projects.
const PUBLIC_INCLUDE = (locale: string) => ({
  translations: true,
  technologies: {
    include: { skill: { include: { translations: { where: { locale } } } } },
  },
});

const ADMIN_INCLUDE = { translations: true, technologies: true } as const;

type TechnologyLink = {
  skillId: string;
  skill?: {
    id: string;
    order: number;
    translations: { locale: string; label: string }[];
  };
};

type ExperienceWithTranslations = Experience & {
  translations: ExperienceTranslation[];
  technologies: TechnologyLink[];
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
      include: PUBLIC_INCLUDE(locale),
      orderBy: [{ startDate: 'desc' }, { order: 'asc' }],
    });
    return [...rows]
      .sort(compareExperiences)
      .map((row) => this.resolvePublic(row, locale))
      .filter((row): row is PublicExperienceEntity => row !== null);
  }
  async listAdmin(): Promise<AdminExperienceEntity[]> {
    const rows = await this.prisma.experience.findMany({
      include: ADMIN_INCLUDE,
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
    await this.assertSkillIds(dto.technologyIds);
    const row = await this.prisma.experience.create({
      data: {
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        isCurrent: dto.isCurrent,
        employmentType: dto.employmentType,
        order: dto.order,
        translations: { create: dto.translations },
        technologies: dto.technologyIds?.length
          ? { create: dto.technologyIds.map((skillId) => ({ skillId })) }
          : undefined,
      },
      include: ADMIN_INCLUDE,
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
    await this.assertSkillIds(dto.technologyIds);
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
    // Replace membership wholesale (D09-17): delete-then-create inside the SAME transaction, so a
    // failure can never leave an entry with its prior links dropped and no replacements written.
    if (dto.technologyIds !== undefined) {
      ops.push(
        this.prisma.experienceTechnology.deleteMany({
          where: { experienceId: id },
        }),
      );
      if (dto.technologyIds.length > 0) {
        ops.push(
          this.prisma.experienceTechnology.createMany({
            data: dto.technologyIds.map((skillId) => ({
              experienceId: id,
              skillId,
            })),
          }),
        );
      }
    }
    if (ops.length) await this.prisma.$transaction(ops);
    return this.getAdmin(id);
  }
  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    await this.prisma.experience.delete({ where: { id } });
  }
  // Duplicates are rejected rather than de-duplicated: the composite PK would reject them at the
  // database anyway, and a 422 naming the problem beats an opaque constraint error. Unknown ids
  // are rejected up front so the caller gets a validation failure, not an FK violation.
  private async assertSkillIds(ids?: string[]): Promise<void> {
    if (ids === undefined || ids.length === 0) return;
    const unique = new Set(ids);
    if (unique.size !== ids.length) {
      throw new UnprocessableEntityException(
        'technologyIds must not contain duplicate skill ids.',
      );
    }
    const found = await this.prisma.skill.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (found.length !== unique.size) {
      const known = new Set(found.map((skill) => skill.id));
      const missing = ids.filter((id) => !known.has(id));
      throw new UnprocessableEntityException(
        `technologyIds reference unknown skills: ${missing.join(', ')}.`,
      );
    }
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
      include: ADMIN_INCLUDE,
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
      // Ordered by Skill.order; a skill without a translation in this locale is dropped rather
      // than falling back to another locale (D10-6).
      technologies: [...row.technologies]
        .sort((a, b) => (a.skill?.order ?? 0) - (b.skill?.order ?? 0))
        .map((link) => {
          const label = link.skill?.translations.find(
            (item) => item.locale === locale,
          )?.label;
          return label === undefined
            ? null
            : { id: link.skill?.id ?? link.skillId, label };
        })
        .filter((item): item is { id: string; label: string } => item !== null),
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
    technologyIds: row.technologies.map((link) => link.skillId),
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
