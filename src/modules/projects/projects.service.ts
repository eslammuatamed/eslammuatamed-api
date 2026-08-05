import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
  ProjectTechnologyEntity,
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
  ): Promise<PaginatedResult<PublicProjectListItemEntity>> {
    await this.locales.assertEnabled(query.locale);
    const where = buildPublicWhere(query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        include: PUBLIC_INCLUDE(query.locale),
        orderBy: [{ featured: 'desc' }, { order: 'asc' }],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.project.count({ where }),
    ]);

    return new PaginatedResult(
      rows.map((row) => this.resolveListItem(row, query.locale)),
      buildPageMeta(query.page, query.perPage, total),
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
    const where: Prisma.ProjectWhereInput = {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        include: ADMIN_INCLUDE,
        orderBy: [{ featured: 'desc' }, { order: 'asc' }],
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
    try {
      const [project] = await this.prisma.$transaction([
        this.prisma.project.create({
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
        }),
      ]);
      return toAdminEntity(project);
    } catch (error) {
      throw mapProjectWriteError(error);
    }
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

    try {
      if (operations.length > 0) await this.prisma.$transaction(operations);
    } catch (error) {
      throw mapProjectWriteError(error);
    }
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

function buildPublicWhere(
  query: ProjectListQueryDto,
): Prisma.ProjectWhereInput {
  return {
    isPublished: true,
    translations: { some: { locale: query.locale } },
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

// A Skill id is a uuid; a Skill slug can never be one, because `^[a-z0-9]+(-[a-z0-9]+)*$` forbids
// the empty group between the doubled hyphens a uuid would need to collide — and no approved slug
// is 36 characters of hex in 8-4-4-4-12 shape. So the two forms are unambiguous and no lookup
// needs to guess or fall back.
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

function mapProjectWriteError(error: unknown): Error {
  if (isPrismaCode(error, 'P2002')) {
    return new UnprocessableEntityException(
      'A project translation slug or relation value already exists.',
    );
  }
  return error instanceof Error ? error : new Error('Project write failed.');
}

function isPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}
