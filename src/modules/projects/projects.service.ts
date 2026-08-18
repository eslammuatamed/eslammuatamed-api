import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SkillGroup } from '../../generated/prisma/client';
import {
  buildPageMeta,
  PaginatedResult,
} from '../../common/pagination/page-meta';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalesService } from '../locales/locales.service';
import { MediaDescriptorResolver } from '../media/media-descriptor.resolver';
import { RedirectService } from '../redirects/redirect.service';
import {
  AdminProjectListQueryDto,
  AdminProjectSortBy,
  ProjectListQueryDto,
} from './dto/project-query.dto';
import {
  CreateProjectDto,
  ProjectGalleryItemDto,
  ProjectTranslationDto,
  UpdateProjectDto,
} from './dto/project.dto';
import {
  AdminProjectEntity,
  AdminProjectGalleryItemEntity,
  AdminProjectGalleryTranslationEntity,
  AdminProjectTranslationEntity,
  ProjectListMeta,
  ProjectTechnologyEntity,
  ProjectTechnologyFacetEntity,
  PublicProjectDetailEntity,
  PublicProjectListItemEntity,
} from './entities/project.entities';

// Media relations (per-translation OG + gallery item image) load with variants + alts so
// descriptors resolve in the parent query — no N+1 (doc 20 §7, doc 10 §6).
const MEDIA_INCLUDE = { include: { variants: true, alts: true } } as const;

type ProjectPublicPayload = Prisma.ProjectGetPayload<{
  include: {
    translations: { include: { ogImage: typeof MEDIA_INCLUDE } };
    technologies: {
      include: { skill: { include: { translations: true } } };
    };
    gallery: {
      include: { translations: true; mediaAsset: typeof MEDIA_INCLUDE };
    };
  };
}>;

type ProjectAdminPayload = Prisma.ProjectGetPayload<{
  include: {
    translations: true;
    technologies: true;
    gallery: { include: { translations: true } };
  };
}>;

const PUBLIC_INCLUDE = (locale: string) => ({
  translations: { include: { ogImage: MEDIA_INCLUDE } },
  technologies: {
    include: { skill: { include: { translations: { where: { locale } } } } },
  },
  gallery: {
    include: { translations: { where: { locale } }, mediaAsset: MEDIA_INCLUDE },
    orderBy: { order: 'asc' as const },
  },
});

const ADMIN_INCLUDE = {
  translations: true,
  technologies: true,
  gallery: {
    include: { translations: true },
    orderBy: { order: 'asc' as const },
  },
} as const;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locales: LocalesService,
    private readonly mediaDescriptors: MediaDescriptorResolver,
    private readonly redirects: RedirectService,
  ) {}

  async listPublic(
    query: ProjectListQueryDto,
  ): Promise<PaginatedResult<PublicProjectListItemEntity, ProjectListMeta>> {
    await this.locales.assertEnabled(query.locale);
    const where = buildPublicWhere(query);
    const [rows, total, facets] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        include: PUBLIC_INCLUDE(query.locale),
        orderBy: [{ featured: 'desc' }, { order: 'asc' }],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.project.count({ where }),
      // Facets join the SAME transaction as the page: read separately and a project published
      // between the two queries yields a chip whose count disagrees with the list it filters.
      facetQuery(this.prisma, query.locale),
    ]);

    return new PaginatedResult(
      rows.map((row) => this.resolveListItem(row, query.locale)),
      {
        ...buildPageMeta(query.page, query.perPage, total),
        facets: toFacets(facets),
      },
    );
  }

  async getPublicBySlug(
    slug: string,
    locale: string,
  ): Promise<PublicProjectDetailEntity> {
    await this.locales.assertEnabled(locale);
    const translation = await this.prisma.projectTranslation.findUnique({
      where: { locale_slug: { locale, slug } },
      include: { project: { include: PUBLIC_INCLUDE(locale) } },
    });

    if (
      !translation ||
      !translation.project ||
      !translation.project.isPublished
    ) {
      throw new NotFoundException('Project not found.');
    }
    return this.resolveDetail(translation.project, locale);
  }

  // Draft preview by id (D10-8): status-agnostic fetch keyed by id, BYPASSING the isPublished filter
  // that getPublicBySlug enforces — so an unpublished project resolves here. Only reachable behind a
  // verified preview token (PreviewTokenService); the token, not this method, is the visibility gate
  // (FR-PUB-046). Reuses the same resolveDetail() as public reads, so the draft renders in the
  // identical single-locale shape. A genuinely absent id still 404s.
  async getPreviewById(
    id: string,
    locale: string,
  ): Promise<PublicProjectDetailEntity> {
    await this.locales.assertEnabled(locale);
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: PUBLIC_INCLUDE(locale),
    });
    if (!project) {
      throw new NotFoundException('Project not found.');
    }
    return this.resolveDetail(project, locale);
  }

  async listAdmin(
    query: AdminProjectListQueryDto,
  ): Promise<PaginatedResult<AdminProjectEntity>> {
    const where = buildAdminWhere(query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        include: ADMIN_INCLUDE,
        orderBy: buildAdminOrderBy(query),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.project.count({ where }),
    ]);
    return new PaginatedResult(
      rows.map(toAdminEntity),
      buildPageMeta(query.page, query.perPage, total),
    );
  }

  async getAdmin(id: string): Promise<AdminProjectEntity> {
    return toAdminEntity(await this.getAdminOrThrow(id));
  }

  async create(dto: CreateProjectDto): Promise<AdminProjectEntity> {
    await this.assertLocales(dto.translations, dto.gallery);
    // A nested create is ALREADY atomic, so no `$transaction` wrapper — one operation in a
    // transaction implied a multi-write invariant that does not exist here, and `articles.service`
    // does the same create without one. Relation semantics are unchanged: `translations`,
    // `technologies` and `gallery` are still nested writes in this single statement.
    //
    // No try/catch either. A P2002 propagates to `AllExceptionsFilter`, the single translation
    // point (doc 15 §3), which answers it as a 422 problem+json WITH `errors[]` field paths. The
    // local translation this replaces emitted a bare 422 with no `errors[]`, so a project slug
    // collision and an article slug collision — the same failure — returned two different contracts.
    const project = await this.prisma.project.create({
      data: {
        featured: dto.featured,
        isPublished: dto.isPublished ?? false,
        order: dto.order,
        liveUrl: dto.liveUrl,
        repoUrl: dto.repoUrl,
        year: dto.year,
        translations: {
          create: dto.translations.map(translationWriteFields),
        },
        technologies:
          dto.technologyIds.length > 0
            ? {
                create: dto.technologyIds.map((skillId) => ({ skillId })),
              }
            : undefined,
        gallery:
          dto.gallery.length > 0
            ? {
                create: dto.gallery.map((gallery) =>
                  galleryNestedCreateFields(gallery),
                ),
              }
            : undefined,
      },
      include: ADMIN_INCLUDE,
    });
    return toAdminEntity(project);
  }

  async update(id: string, dto: UpdateProjectDto): Promise<AdminProjectEntity> {
    // Capture `existing` (previously discarded) to read the old per-locale slugs and the current
    // publish state — both needed for the D04-6 auto-redirect predicate below.
    const existing = await this.getAdminOrThrow(id);
    await this.assertLocales(dto.translations ?? [], dto.gallery ?? []);
    const nextIsPublished = dto.isPublished ?? existing.isPublished;
    const operations: Prisma.PrismaPromise<unknown>[] = [];
    const base: Prisma.ProjectUpdateInput = {
      featured: dto.featured,
      isPublished: dto.isPublished,
      order: dto.order,
      liveUrl: dto.liveUrl,
      repoUrl: dto.repoUrl,
      year: dto.year,
    };
    if (Object.values(base).some((value) => value !== undefined)) {
      operations.push(
        this.prisma.project.update({ where: { id }, data: base }),
      );
    }

    for (const translation of dto.translations ?? []) {
      operations.push(
        this.prisma.projectTranslation.upsert({
          where: {
            projectId_locale: { projectId: id, locale: translation.locale },
          },
          create: { projectId: id, ...translationWriteFields(translation) },
          update: translationWriteFields(translation),
        }),
      );

      // D04-6: a locale-slug rename on a still-published project auto-creates its SlugRedirect in
      // the SAME $transaction as the rename, so the old public URL keeps resolving (one op-set per
      // changed locale). Gated on the project having been published AND staying published
      // (nextIsPublished = dto.isPublished ?? existing.isPublished) — draft/unpublished entities,
      // publish-state flips, unchanged slugs, and new locales (no prior slug) are all skipped.
      const oldSlug = existing.translations.find(
        (t) => t.locale === translation.locale,
      )?.slug;
      if (
        oldSlug !== undefined &&
        oldSlug !== translation.slug &&
        existing.isPublished === true &&
        nextIsPublished === true
      ) {
        operations.push(
          ...this.redirects.buildRedirectOps({
            locale: translation.locale,
            entityType: 'project',
            oldSlug,
            newSlug: translation.slug,
          }),
        );
      }
    }

    if (dto.technologyIds !== undefined) {
      operations.push(
        this.prisma.projectTechnology.deleteMany({ where: { projectId: id } }),
      );
      if (dto.technologyIds.length > 0) {
        operations.push(
          this.prisma.projectTechnology.createMany({
            data: dto.technologyIds.map((skillId) => ({
              projectId: id,
              skillId,
            })),
          }),
        );
      }
    }

    if (dto.gallery !== undefined) {
      operations.push(
        this.prisma.projectGalleryItem.deleteMany({
          where: { projectId: id },
        }),
      );
      for (const galleryItem of dto.gallery) {
        operations.push(
          this.prisma.projectGalleryItem.create({
            data: galleryCreateFields(galleryItem, id),
          }),
        );
      }
    }

    // A genuine multi-write transaction (the rename + its D04-6 redirect ops must land together),
    // kept. No catch — a P2002 reaches `AllExceptionsFilter` like every other module's.
    if (operations.length > 0) await this.prisma.$transaction(operations);
    return this.getAdmin(id);
  }

  async remove(id: string): Promise<void> {
    await this.getAdminOrThrow(id);
    await this.prisma.project.delete({ where: { id } });
  }

  private async assertLocales(
    translations: readonly { locale: string }[],
    gallery: readonly ProjectGalleryItemDto[],
  ): Promise<void> {
    for (const translation of translations) {
      await this.locales.assertEnabled(translation.locale);
    }
    for (const galleryItem of gallery) {
      for (const locale of Object.keys(galleryItem.translations)) {
        await this.locales.assertEnabled(locale);
      }
    }
  }

  private async getAdminOrThrow(id: string): Promise<ProjectAdminPayload> {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: ADMIN_INCLUDE,
    });
    if (!project) throw new NotFoundException('Project not found.');
    return project;
  }

  private requireTranslation(
    project: ProjectPublicPayload,
    locale: string,
  ): ProjectPublicPayload['translations'][number] {
    const translation = project.translations.find(
      (item) => item.locale === locale,
    );
    if (!translation) throw new NotFoundException('Project not found.');
    return translation;
  }

  private resolveListItem(
    project: ProjectPublicPayload,
    locale: string,
  ): PublicProjectListItemEntity {
    const translation = this.requireTranslation(project, locale);
    return {
      id: project.id,
      slug: translation.slug,
      title: translation.title,
      summary: translation.summary,
      featured: project.featured,
      year: project.year,
      technologies: project.technologies
        .map((technology) => technologyRef(technology, locale))
        .filter(
          (technology): technology is ProjectTechnologyEntity =>
            technology !== null,
        ),
      availableLocales: project.translations.map((item) => item.locale).sort(),
    };
  }

  private resolveDetail(
    project: ProjectPublicPayload,
    locale: string,
  ): PublicProjectDetailEntity {
    const listItem = this.resolveListItem(project, locale);
    const translation = this.requireTranslation(project, locale);
    const slugs: Record<string, string> = {};
    for (const item of project.translations) slugs[item.locale] = item.slug;
    return {
      ...listItem,
      slugs,
      liveUrl: project.liveUrl,
      repoUrl: project.repoUrl,
      overview: translation.overview,
      businessProblem: translation.businessProblem,
      solution: translation.solution,
      role: translation.role,
      architecture: translation.architecture,
      challenges: translation.challenges,
      features: translation.features,
      lessonsLearned: translation.lessonsLearned,
      gallery: project.gallery.map((item) => ({
        mediaAssetId: item.mediaAssetId,
        mediaAsset: this.mediaDescriptors.resolveImage(item.mediaAsset, locale),
        order: item.order,
        caption: item.translations[0]?.caption ?? null,
      })),
      metaTitle: translation.metaTitle,
      metaDescription: translation.metaDescription,
      ogImageId: translation.ogImageId,
      ogImage: translation.ogImage
        ? this.mediaDescriptors.resolveImage(translation.ogImage, locale)
        : null,
      canonicalUrl: translation.canonicalUrl,
    };
  }
}

// What "a project the public can reach in this locale" means — the SINGLE definition, deliberately
// extracted (D10-19).
//
// The listing and the facet query MUST agree on this or the filter lies: a facet computed over a
// wider set than the listing offers a chip that then returns "no projects", and a narrower one
// hides a technology that does have work behind it. Coupling them by CONSTRUCTION rather than by
// two predicates that merely happen to match today is what makes "every rendered facet returns at
// least one published project" a structural property instead of a passing test.
export function publishedProjectScope(
  locale: string,
): Prisma.ProjectWhereInput {
  return { isPublished: true, translations: { some: { locale } } };
}

// The taxonomy groups the Projects filter may offer, and the only place that policy is stated.
//
// `DELIVERY` is excluded because those are ways of working, not things a project is "built with" —
// filtering case studies by "Testing" or "Deployment" answers no question a visitor has.
// `LANGUAGE` is excluded by the same instruction.
//
// `LANGUAGE` is excluded DELIBERATELY, and the owner confirmed it on 2026-08-06 with the live
// consequence in front of them: `typescript` sits on 4 of 4 published projects — the most-used
// technology on the site — and is still excluded. Against live Production this rule takes the filter
// from 18 options to 4 (`vue`, `nuxt`, `tailwind-css`, `nestjs`).
//
// No one-off exception is granted for a language merely because every project uses it: a filter
// option that matches everything separates nothing, and "used a lot" is not the same question as
// "what is this built with". Admitting Languages is a separate, explicit taxonomy and UX decision,
// not an edit to this line.
//
// Widening this constant is still one line — but `projects.e2e-spec.ts` asserts the LANGUAGE
// exclusion against a fixture that every other rule would admit, so the change cannot happen
// silently.
export const FACET_GROUPS = [SkillGroup.FRONTEND, SkillGroup.BACKEND] as const;

// Storage taxonomy → the two buckets the filter renders. Exhaustive over FACET_GROUPS by type.
const FACET_GROUP_NAMES: Record<
  (typeof FACET_GROUPS)[number],
  'frontend' | 'backend'
> = {
  [SkillGroup.FRONTEND]: 'frontend',
  [SkillGroup.BACKEND]: 'backend',
};

// Every eligible facet, computed over the WHOLE published set for this locale.
//
// Three filters, each load-bearing and each independently regression-tested:
//   1. `group in FACET_GROUPS`  — drops Delivery & Quality entries and languages.
//   2. `isPublic`               — a skill retired from the public taxonomy keeps its rows (it is
//                                 still referenced by projects and experiences) but must not be
//                                 offered as a filter; visibility is a flag, not a deletion.
//   3. `projectLinks: some(...)`— at least one project in `publishedProjectScope`. This is what
//                                 eliminates zero-project options; the count below reuses the very
//                                 same predicate, so a returned facet cannot have count 0.
// Plus `translations: some({ locale })` — a facet with no label in the requested locale is omitted
// rather than shown in the other language (D10-6: no cross-locale fallback).
//
// NOT filtered by the active `?technology=`: doing so would collapse the list to the selected chip
// and make switching filters impossible. Facets describe what is available, not what is selected.
function facetQuery(prisma: PrismaService, locale: string) {
  return prisma.skill.findMany({
    where: {
      group: { in: [...FACET_GROUPS] },
      isPublic: true,
      translations: { some: { locale } },
      projectLinks: { some: { project: publishedProjectScope(locale) } },
    },
    select: {
      slug: true,
      group: true,
      translations: { where: { locale }, select: { label: true } },
      _count: {
        select: {
          // Same predicate as the `where` above — the count and the existence test cannot drift.
          projectLinks: { where: { project: publishedProjectScope(locale) } },
        },
      },
    },
    // Presentation order comes from the taxonomy, so chips read the same here as everywhere else.
    orderBy: [{ group: 'asc' }, { order: 'asc' }, { slug: 'asc' }],
  });
}

type FacetRow = Awaited<ReturnType<typeof facetQuery>>[number];

function toFacets(rows: FacetRow[]): ProjectTechnologyFacetEntity[] {
  return rows.flatMap((row) => {
    const label = row.translations[0]?.label;
    const group = FACET_GROUP_NAMES[row.group as (typeof FACET_GROUPS)[number]];
    // Both are guaranteed by the query's own filters. Dropping rather than asserting keeps a
    // future taxonomy change from turning a contract violation into a 500 — the facet simply does
    // not appear, which is the same degradation as a missing translation.
    //
    // NOTE: this makes the group rule enforced TWICE (query `where` + this lookup), which a
    // mutation run confirmed: deleting the `where` clause alone changes no observable behaviour.
    // That redundancy is deliberate defence in depth, and it is not a hole — the eligible set is
    // `FACET_GROUPS`, `FACET_GROUP_NAMES` is typed as a total map over it (so widening the policy
    // without widening the map is a compile error), and a mutation that widens BOTH is caught by
    // the Delivery & Quality regression test.
    if (!label || !group) return [];
    return [{ slug: row.slug, label, group, count: row._count.projectLinks }];
  });
}

// Which translated fields `?q=` searches. Kept as one named list so the Swagger description, the
// spec, and the predicate below cannot drift apart — the same coupling-by-construction that keeps
// `PROJECT_TRANSLATION_FIELDS` honest on the content-sync side.
const ADMIN_SEARCH_FIELDS = ['title', 'slug', 'summary'] as const;

/**
 * Admin list predicate (D10-18): publication and featured filters plus cross-translation search.
 *
 * `q` matches when ANY translation matches on ANY of `ADMIN_SEARCH_FIELDS` — `translations: { some }`,
 * not a locale-scoped lookup. That is the whole point: the owner types an Arabic title and reaches
 * the project whose English record they need to edit, from a single list, with no locale toggle.
 *
 * A blank or whitespace-only `q` is DROPPED rather than applied. Applied, it would be a predicate
 * matching everything (harmless) — but the trimming also means a stray space cannot turn a search
 * into a different result set than the same search without it.
 *
 * Substring matching, not full-text: `guard:fts` governs a PUBLIC search index, and the admin
 * collection is bounded at tens of rows. `mode: 'insensitive'` is a no-op for Arabic (no case) and
 * correct for English, which is exactly what the admin Media search already does for filenames.
 */
function buildAdminWhere(
  query: AdminProjectListQueryDto,
): Prisma.ProjectWhereInput {
  const where: Prisma.ProjectWhereInput = {};

  if (query.isPublished !== undefined) {
    where.isPublished = query.isPublished;
  }
  if (query.featured !== undefined) {
    where.featured = query.featured;
  }

  const term = query.q?.trim();
  if (term) {
    where.translations = {
      some: {
        OR: ADMIN_SEARCH_FIELDS.map((field) => ({
          [field]: { contains: term, mode: Prisma.QueryMode.insensitive },
        })),
      },
    };
  }

  return where;
}

/**
 * Admin list ordering (D10-18). Always TOTAL.
 *
 * `id` is appended in every branch for the reason `compareExperiences` already records: without a
 * final tie-breaker, rows sharing a sort value compare equal and the database's row order decides
 * which page they land on — so a paginated list can drop or repeat a row between two identical
 * requests. That is not theoretical here: all nine governed projects share `year: null`, so a
 * `sortBy=year` page would be at the mercy of physical row order without this.
 *
 * `year` is nullable and sorts nulls LAST in both directions, so projects without a year never
 * displace those that have one — `desc` would otherwise float every null to the top.
 */
function buildAdminOrderBy(
  query: AdminProjectListQueryDto,
): Prisma.ProjectOrderByWithRelationInput[] {
  if (!query.sortBy) {
    // Unchanged default — the established ordering this endpoint has always returned.
    return [{ featured: 'desc' }, { order: 'asc' }, { id: 'asc' }];
  }

  const direction = query.sortOrder;

  if (query.sortBy === AdminProjectSortBy.Year) {
    return [{ year: { sort: direction, nulls: 'last' } }, { id: 'asc' }];
  }

  return [{ [query.sortBy]: direction }, { id: 'asc' }];
}

function buildPublicWhere(
  query: ProjectListQueryDto,
): Prisma.ProjectWhereInput {
  return {
    ...publishedProjectScope(query.locale),
    ...(query.technology
      ? {
          technologies: {
            some: isSkillId(query.technology)
              ? // Backward compatibility only — the uuid form is what this endpoint documented
                // before `Skill.slug` existed, so links already published keep resolving.
                { skillId: query.technology }
              : { skill: { slug: query.technology } },
          },
        }
      : {}),
  };
}

// Which column a `?technology=` value is matched against.
//
// A uuid DOES satisfy the query DTO's slug pattern (`^[a-z0-9]+(-[a-z0-9]+)*$` — lowercase hex in
// 8-4-4-4-12 shape is a sequence of alphanumeric groups joined by single hyphens), which is exactly
// why one parameter can carry both forms without a second parameter or a union type. This test is
// what separates them, and it is deliberately the STRICT uuid shape rather than a loose
// "looks like it has hyphens" heuristic.
//
// The discrimination is total in BOTH directions, and neither direction rests on convention:
//   - every Skill id matches, so a legacy link is never read as a slug;
//   - no Skill slug can match, because a uuid-shaped slug is refused by `CreateSkillDto` at the API
//     boundary AND by the `skills_slug_format_check` CHECK constraint at the column — the latter
//     being what also covers the content seed, raw SQL and any future writer.
// Without those rules this function would be a heuristic; with them it is exact.
const SKILL_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function isSkillId(value: string): boolean {
  return SKILL_ID_PATTERN.test(value);
}

function translationWriteFields(translation: ProjectTranslationDto) {
  return {
    locale: translation.locale,
    title: translation.title,
    slug: translation.slug,
    summary: translation.summary,
    overview: translation.overview,
    businessProblem: translation.businessProblem,
    solution: translation.solution,
    role: translation.role,
    architecture: translation.architecture,
    challenges: translation.challenges,
    features: translation.features,
    lessonsLearned: translation.lessonsLearned,
    metaTitle: translation.metaTitle,
    metaDescription: translation.metaDescription,
    ogImageId: translation.ogImageId,
    canonicalUrl: translation.canonicalUrl,
  };
}

function galleryNestedCreateFields(gallery: ProjectGalleryItemDto) {
  return {
    mediaAssetId: gallery.mediaAssetId,
    order: gallery.order,
    translations: {
      create: Object.entries(gallery.translations).map(([locale, value]) => ({
        locale,
        caption: value.caption,
      })),
    },
  };
}

function galleryCreateFields(
  gallery: ProjectGalleryItemDto,
  projectId: string,
) {
  return { projectId, ...galleryNestedCreateFields(gallery) };
}

function technologyRef(
  technology: ProjectPublicPayload['technologies'][number],
  locale: string,
): ProjectTechnologyEntity | null {
  const translation = technology.skill.translations.find(
    (item) => item.locale === locale,
  );
  if (!translation) return null;
  return {
    id: technology.skill.id,
    slug: technology.skill.slug,
    label: translation.label,
  };
}

function toAdminEntity(project: ProjectAdminPayload): AdminProjectEntity {
  const translations: Record<string, AdminProjectTranslationEntity> = {};
  for (const translation of project.translations) {
    translations[translation.locale] = {
      title: translation.title,
      slug: translation.slug,
      summary: translation.summary,
      overview: translation.overview,
      businessProblem: translation.businessProblem,
      solution: translation.solution,
      role: translation.role,
      architecture: translation.architecture,
      challenges: translation.challenges,
      features: translation.features,
      lessonsLearned: translation.lessonsLearned,
      metaTitle: translation.metaTitle,
      metaDescription: translation.metaDescription,
      ogImageId: translation.ogImageId,
      canonicalUrl: translation.canonicalUrl,
    };
  }

  return {
    id: project.id,
    featured: project.featured,
    isPublished: project.isPublished,
    order: project.order,
    liveUrl: project.liveUrl,
    repoUrl: project.repoUrl,
    year: project.year,
    technologyIds: project.technologies.map((technology) => technology.skillId),
    gallery: project.gallery.map((item) => {
      const galleryTranslations: Record<
        string,
        AdminProjectGalleryTranslationEntity
      > = {};
      for (const translation of item.translations) {
        galleryTranslations[translation.locale] = {
          caption: translation.caption,
        };
      }
      const gallery: AdminProjectGalleryItemEntity = {
        id: item.id,
        mediaAssetId: item.mediaAssetId,
        order: item.order,
        translations: galleryTranslations,
      };
      return gallery;
    }),
    translations,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}
