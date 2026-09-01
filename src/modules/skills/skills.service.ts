import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  Prisma,
  Skill,
  SkillGroup,
  SkillTranslation,
} from '../../generated/prisma/client';
import {
  buildPageMeta,
  PaginatedResult,
} from '../../common/pagination/page-meta';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalesService } from '../locales/locales.service';
import {
  AdminSkillListQueryDto,
  CreateSkillDto,
  UpdateSkillDto,
} from './dto/skill.dto';
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
    // Hidden skills stay in the registry for project/experience relations but never reach a
    // public surface (homepage capabilities, résumé). Admin listings are unfiltered.
    const rows = await this.prisma.skill.findMany({
      where: { isPublic: true },
      include: { translations: true },
      orderBy: [{ group: 'asc' }, { order: 'asc' }],
    });
    return [...rows]
      .sort(compareSkills)
      .map((row) => this.resolvePublic(row, locale))
      .filter((row): row is PublicSkillEntity => row !== null);
  }

  async listAdmin(
    query: AdminSkillListQueryDto,
  ): Promise<PaginatedResult<AdminSkillEntity>> {
    const where: Prisma.SkillWhereInput = query.group
      ? { group: query.group }
      : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.skill.findMany({
        where,
        include: { translations: true },
        // PostgreSQL orders native enum values by declaration order; `id` stabilizes equal groups
        // and dashboard order values before the requested page is taken.
        orderBy: [{ group: 'asc' }, { order: 'asc' }, { id: 'asc' }],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.skill.count({ where }),
    ]);
    return new PaginatedResult(
      rows.map(toAdminEntity),
      buildPageMeta(query.page, query.perPage, total),
    );
  }

  async getAdmin(id: string): Promise<AdminSkillEntity> {
    return toAdminEntity(await this.getOrThrow(id));
  }

  async create(dto: CreateSkillDto): Promise<AdminSkillEntity> {
    await this.assertTranslations(dto.translations);
    try {
      const row = await this.prisma.skill.create({
        data: {
          slug: dto.slug,
          group: dto.group,
          order: dto.order,
          brandColor: dto.brandColor,
          isPublic: dto.isPublic ?? true,
          translations: { create: dto.translations },
        },
        include: { translations: true },
      });
      return toAdminEntity(row);
    } catch (error) {
      // No P2002 arm. A duplicate slug is left to
      // `AllExceptionsFilter`, which owns unique violations for every module and answers 422
      // "Validation failed" with `errors[]`. The arm removed here answered 409 with a
      // skills-only message — a status this operation does not declare in the OpenAPI contract
      // (`201/401/403/422/429`) and that no peer create route returns. Its stated justification
      // ("otherwise a 500") was also false: the global filter has mapped P2002 since before this
      // code was written. `prisma-error-mapping.e2e-spec.ts` §B3 pins the resulting parity.
      //
      // A CHECK-constraint violation is `P2004`, and it is a bad REQUEST, not a server fault.
      // `CreateSkillDto` rejects the same inputs first, so this is unreachable today — it is here
      // so that the day the constraint and the DTO drift apart (a new rule added to one and not the
      // other), the caller gets a 422 naming the field instead of an opaque 500.
      if (isPrismaCode(error, 'P2004'))
        throw new UnprocessableEntityException(
          `Skill slug "${dto.slug}" violates the stored slug format constraint.`,
        );
      throw error;
    }
  }

  async update(id: string, dto: UpdateSkillDto): Promise<AdminSkillEntity> {
    await this.getOrThrow(id);
    if (dto.translations) await this.assertTranslations(dto.translations);
    const ops: Prisma.PrismaPromise<unknown>[] = [];
    const base: Prisma.SkillUpdateInput = {
      group: dto.group,
      order: dto.order,
      brandColor: dto.brandColor,
      isPublic: dto.isPublic,
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
      // KEPT — DOMAIN-SPECIFIC, and deliberately not removed alongside the P2002 arm above.
      // `P2014` (a required-relation violation) is a code `AllExceptionsFilter` does NOT own: it
      // falls to the filter's `default` arm and would answer 400 "The request could not be
      // processed." for what is a referential conflict. `DELETE /admin/skills/{id}` declares
      // **409**, so the local mapping is what makes the runtime match the published contract —
      // the exact opposite of the P2002 case, where the local mapping is what BROKE it. The
      // P2003 half is caught in the same predicate so both codes answer with one domain sentence
      // ("still linked to a project") instead of the filter's generic wording; the status is
      // identical either way, so that half is message quality only.
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
      slug: row.slug,
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
    slug: row.slug,
    group: row.group,
    order: row.order,
    brandColor: row.brandColor,
    isPublic: row.isPublic,
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
