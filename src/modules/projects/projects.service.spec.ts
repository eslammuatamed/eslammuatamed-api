import { NotFoundException } from '@nestjs/common';
import {
  MediaKind,
  MediaVariantFormat,
  Prisma,
} from '../../generated/prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalesService } from '../locales/locales.service';
import { MediaDescriptorResolver } from '../media/media-descriptor.resolver';
import { StorageAdapter } from '../media/storage/storage-adapter.interface';
import { RedirectService } from '../redirects/redirect.service';
import {
  AdminProjectListQueryDto,
  AdminProjectSortBy,
  SortOrder,
} from './dto/project-query.dto';
import { ProjectsService } from './projects.service';

const storage = {
  put: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
  publicUrl: (key: string) => `https://media.test/${key}`,
} as unknown as StorageAdapter;

// A loaded image MediaAsset (variants + alts) for gallery / OG descriptor tests.
const imageAsset = (
  id: string,
  alts: { locale: string; alt: string }[] = [],
): Record<string, unknown> => {
  const now = new Date('2026-07-16T00:00:00.000Z');
  return {
    id,
    kind: MediaKind.IMAGE,
    storageKey: `media/${id}/master.webp`,
    originalFilename: 'x.jpg',
    mimeType: 'image/webp',
    sizeBytes: 1000,
    contentHash: id,
    width: 1600,
    height: 900,
    blurhash: 'BH',
    createdAt: now,
    updatedAt: now,
    variants: [
      {
        id: `${id}-w`,
        mediaAssetId: id,
        format: MediaVariantFormat.WEBP,
        width: 1280,
        height: 720,
        storageKey: `media/${id}/1280-webp.webp`,
        sizeBytes: 900,
        overBudget: false,
        createdAt: now,
        updatedAt: now,
      },
    ],
    alts: alts.map((entry, index) => ({
      id: `${id}-alt${index}`,
      mediaAssetId: id,
      locale: entry.locale,
      alt: entry.alt,
      createdAt: now,
      updatedAt: now,
    })),
  };
};

function projectPayload(isPublished: boolean) {
  const now = new Date('2026-07-16T00:00:00.000Z');
  return {
    id: 'project-1',
    featured: true,
    isPublished,
    order: 1,
    liveUrl: 'https://example.com',
    repoUrl: 'https://github.com/example/project',
    year: 2026,
    createdAt: now,
    updatedAt: now,
    translations: [
      {
        id: 'translation-en',
        projectId: 'project-1',
        locale: 'en',
        title: 'English project',
        slug: 'english-project',
        summary: 'English summary',
        overview: 'English overview',
        businessProblem: 'English business problem',
        solution: 'English solution',
        role: 'English role',
        architecture: 'English architecture',
        challenges: 'English challenges',
        features: 'English features',
        lessonsLearned: 'English lessons learned',
        metaTitle: null,
        metaDescription: null,
        ogImageId: null,
        canonicalUrl: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'translation-ar',
        projectId: 'project-1',
        locale: 'ar',
        title: 'Arabic project',
        slug: 'arabic-project',
        summary: 'Arabic summary',
        overview: 'Arabic overview',
        businessProblem: 'Arabic business problem',
        solution: 'Arabic solution',
        role: 'Arabic role',
        architecture: 'Arabic architecture',
        challenges: 'Arabic challenges',
        features: 'Arabic features',
        lessonsLearned: 'Arabic lessons learned',
        metaTitle: null,
        metaDescription: null,
        ogImageId: null,
        canonicalUrl: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    technologies: [
      {
        projectId: 'project-1',
        skillId: 'skill-1',
        skill: {
          id: 'skill-1',
          slug: 'nestjs',
          group: 'FRONTEND',
          order: 1,
          brandColor: null,
          createdAt: now,
          updatedAt: now,
          translations: [
            {
              id: 'skill-translation-en',
              skillId: 'skill-1',
              locale: 'en',
              label: 'NestJS',
              createdAt: now,
              updatedAt: now,
            },
          ],
        },
      },
    ],
    gallery: [
      {
        id: 'gallery-1',
        projectId: 'project-1',
        mediaAssetId: 'media-1',
        mediaAsset: imageAsset('media-1', [
          { locale: 'en', alt: 'Dashboard shot' },
        ]),
        order: 1,
        createdAt: now,
        updatedAt: now,
        translations: [
          {
            id: 'gallery-translation-en',
            galleryItemId: 'gallery-1',
            locale: 'en',
            caption: 'Dashboard',
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
    ],
  };
}

const createDto = {
  featured: false,
  order: 0,
  translations: [
    {
      locale: 'en',
      title: 'Project',
      slug: 'project',
      summary: 'Summary',
      overview: 'Overview',
      businessProblem: 'Problem',
      solution: 'Solution',
      role: 'Role',
      architecture: 'Architecture',
      challenges: 'Challenges',
      features: 'Features',
      lessonsLearned: 'Lessons',
    },
  ],
  technologyIds: [],
  gallery: [],
};

describe('ProjectsService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let locales: DeepMockProxy<LocalesService>;
  let redirects: DeepMockProxy<RedirectService>;
  let service: ProjectsService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    locales = mockDeep<LocalesService>();
    redirects = mockDeep<RedirectService>();
    // Default to an empty op-set so a spread never crashes; the "called" tests override this with a
    // sentinel array and assert those ops land in the $transaction.
    redirects.buildRedirectOps.mockReturnValue([]);
    service = new ProjectsService(
      prisma,
      locales,
      new MediaDescriptorResolver(storage),
      redirects,
    );
  });

  describe('listPublic', () => {
    it('filters the public list to published projects only', async () => {
      prisma.$transaction.mockResolvedValue([
        [projectPayload(true)],
        1,
        [], // facet rows — listPublic now reads facets in the SAME transaction (D10-19)
      ] as never);

      const result = await service.listPublic({
        page: 1,
        perPage: 12,
        skip: 0,
        take: 12,
        locale: 'en',
      });

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isPublished: true }),
        }),
      );
      expect(result.data).toHaveLength(1);
    });

    // Facets (D10-19). The e2e suite proves the BEHAVIOUR against a real database; this pins the
    // QUERY, so a filter cannot be dropped and then re-hidden by some downstream mapping.
    describe('technology facets', () => {
      const facetArgs = (): Record<string, unknown> => {
        const call = prisma.skill.findMany.mock.calls[0]?.[0];
        return call ?? {};
      };

      // Pins the POLICY itself, not just its effect. The e2e suite proves a LANGUAGE fixture is
      // absent from the response; this proves the query never asks for one in the first place, so
      // the owner-confirmed rule (Frontend + Backend only — `typescript` stays out despite being on
      // every published project) is asserted at the layer where someone would change it.
      it('asks for Frontend and Backend groups only — Languages and Delivery are not eligible', async () => {
        prisma.$transaction.mockResolvedValue([[], 0, []] as never);

        await service.listPublic({
          page: 1,
          perPage: 12,
          skip: 0,
          take: 12,
          locale: 'en',
        });

        const where = facetArgs().where as { group: { in: string[] } };
        expect([...where.group.in].sort()).toEqual(['BACKEND', 'FRONTEND']);
        expect(where.group.in).not.toContain('LANGUAGE');
        expect(where.group.in).not.toContain('DELIVERY');
      });

      it('asks only for eligible, public, translated, actually-used technologies', async () => {
        prisma.$transaction.mockResolvedValue([[], 0, []] as never);

        await service.listPublic({
          page: 1,
          perPage: 12,
          skip: 0,
          take: 12,
          locale: 'ar',
        });

        expect(facetArgs().where).toEqual({
          group: { in: ['FRONTEND', 'BACKEND'] },
          isPublic: true,
          translations: { some: { locale: 'ar' } },
          // The published-project requirement — what keeps a zero-project chip off the page.
          projectLinks: {
            some: {
              project: {
                isPublished: true,
                translations: { some: { locale: 'ar' } },
              },
            },
          },
        });
      });

      // The count and the existence test must be the SAME predicate, or a facet can be offered
      // with a count that disagrees with the list it filters.
      it('counts published projects with the identical predicate it filters on', async () => {
        prisma.$transaction.mockResolvedValue([[], 0, []] as never);

        await service.listPublic({
          page: 1,
          perPage: 12,
          skip: 0,
          take: 12,
          locale: 'en',
        });

        const where = facetArgs().where as { projectLinks: { some: unknown } };
        const select = facetArgs().select as {
          _count: { select: { projectLinks: { where: unknown } } };
        };
        expect(select._count.select.projectLinks.where).toEqual(
          where.projectLinks.some,
        );
      });

      // Load-bearing: narrowing facets by the active filter collapses the chip list to the one
      // already selected, and there is then no way to switch to any other filter.
      it('ignores the active technology filter when computing facets', async () => {
        prisma.$transaction.mockResolvedValue([[], 0, []] as never);

        await service.listPublic({
          page: 1,
          perPage: 12,
          skip: 0,
          take: 12,
          locale: 'en',
          technology: 'nestjs',
        });

        expect(JSON.stringify(facetArgs().where)).not.toContain('nestjs');
      });
    });

    // The filter identity is `Skill.slug`: it is locale-independent and survives label edits, so
    // `/projects?technology=nestjs` means the same thing in every locale and keeps working after
    // the skill is renamed. Matching happens on the relation, never on a translated label.
    it('applies the technology Skill slug filter without relaxing publication', async () => {
      prisma.$transaction.mockResolvedValue([[], 0, []] as never);

      await service.listPublic({
        page: 1,
        perPage: 12,
        skip: 0,
        take: 12,
        locale: 'en',
        technology: 'nestjs',
      });

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isPublished: true,
            technologies: { some: { skill: { slug: 'nestjs' } } },
          }),
        }),
      );
    });

    // Backward compatibility: the uuid form is what this endpoint documented before slugs existed,
    // so already-published links must keep resolving. It matches the id column, not the slug —
    // otherwise every legacy link would silently return an empty page instead of its projects.
    it('still accepts a Skill uuid and matches it against the id, not the slug', async () => {
      prisma.$transaction.mockResolvedValue([[], 0, []] as never);

      await service.listPublic({
        page: 1,
        perPage: 12,
        skip: 0,
        take: 12,
        locale: 'en',
        technology: '019fa4e9-2810-7f82-a537-6e3ea8ddcc67',
      });

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isPublished: true,
            technologies: {
              some: { skillId: '019fa4e9-2810-7f82-a537-6e3ea8ddcc67' },
            },
          }),
        }),
      );
    });

    // A retired or mistyped technology must degrade to an empty page, not an error: the filter is
    // a query parameter a visitor can edit, and the governed contract calls for a valid empty
    // paginated collection.
    //
    // The envelope assertions alone would be VACUOUS — the mock returns an empty page whatever the
    // query says, so they would still pass with the technology filter deleted entirely. The where
    // clause is asserted too, which is what ties the empty page to the filter actually having been
    // applied rather than silently ignored (an ignored filter would return the FULL list, which is
    // the failure mode that matters here).
    it('applies an unknown technology slug as a filter and returns a valid empty page', async () => {
      prisma.$transaction.mockResolvedValue([[], 0, []] as never);

      const result = await service.listPublic({
        page: 1,
        perPage: 12,
        skip: 0,
        take: 12,
        locale: 'en',
        technology: 'no-such-technology',
      });

      // The filter WAS applied — not quietly dropped, which would have widened the result set.
      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isPublished: true,
            technologies: { some: { skill: { slug: 'no-such-technology' } } },
          }),
        }),
      );
      expect(result.data).toEqual([]);
      expect(result.meta).toEqual(
        expect.objectContaining({ total: 0, page: 1, perPage: 12 }),
      );
    });

    it('orders featured projects first and then by explicit order', async () => {
      prisma.$transaction.mockResolvedValue([[], 0, []] as never);

      await service.listPublic({
        page: 1,
        perPage: 12,
        skip: 0,
        take: 12,
        locale: 'en',
      });

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ featured: 'desc' }, { order: 'asc' }],
        }),
      );
    });

    it('resolves list fields and technology labels to the requested locale', async () => {
      prisma.$transaction.mockResolvedValue([
        [projectPayload(true)],
        1,
        [], // facet rows — listPublic now reads facets in the SAME transaction (D10-19)
      ] as never);

      const result = await service.listPublic({
        page: 1,
        perPage: 12,
        skip: 0,
        take: 12,
        locale: 'en',
      });

      expect(locales.assertEnabled).toHaveBeenCalledWith('en');
      expect(result.data[0]).toEqual(
        expect.objectContaining({
          title: 'English project',
          slug: 'english-project',
          // slug travels with the label so a client can build the filter URL for a technology
          // straight from a project card, without a second lookup or a guess at the identifier.
          technologies: [{ id: 'skill-1', slug: 'nestjs', label: 'NestJS' }],
        }),
      );
    });
  });

  // D10-18. The e2e suite proves the behaviour against a real database (including the parts that
  // Postgres itself decides, e.g. row order within a tied sort key); this pins the QUERY — where and
  // orderBy — so the predicate and the ordering cannot silently drift even if the e2e fixtures happen
  // not to expose it.
  describe('listAdmin (D10-18)', () => {
    const baseQuery = (
      overrides: Partial<AdminProjectListQueryDto> = {},
    ): AdminProjectListQueryDto => ({
      page: 1,
      perPage: 12,
      skip: 0,
      take: 12,
      sortOrder: SortOrder.Asc,
      ...overrides,
    });

    const findManyArgs = (): Record<string, unknown> => {
      const call = prisma.project.findMany.mock.calls[0]?.[0];
      return call ?? {};
    };

    beforeEach(() => {
      prisma.$transaction.mockResolvedValue([[], 0] as never);
    });

    describe('where (filters + cross-translation search)', () => {
      it('applies no predicate when isPublished, featured, and q are all absent', async () => {
        await service.listAdmin(baseQuery());
        expect(findManyArgs().where).toEqual({});
      });

      it('filters by isPublished: true when present', async () => {
        await service.listAdmin(baseQuery({ isPublished: true }));
        expect(findManyArgs().where).toEqual({ isPublished: true });
      });

      it('filters by isPublished: false when present', async () => {
        await service.listAdmin(baseQuery({ isPublished: false }));
        expect(findManyArgs().where).toEqual({ isPublished: false });
      });

      it('filters by featured: true when present', async () => {
        await service.listAdmin(baseQuery({ featured: true }));
        expect(findManyArgs().where).toEqual({ featured: true });
      });

      it('filters by featured: false when present', async () => {
        await service.listAdmin(baseQuery({ featured: false }));
        expect(findManyArgs().where).toEqual({ featured: false });
      });

      it('combines isPublished and featured as independent predicates', async () => {
        await service.listAdmin(
          baseQuery({ isPublished: true, featured: false }),
        );
        expect(findManyArgs().where).toEqual({
          isPublished: true,
          featured: false,
        });
      });

      // Pins the exact OR shape over ADMIN_SEARCH_FIELDS — if `summary` (or the insensitive mode)
      // were ever dropped from the constant, a looser `objectContaining` assertion would not notice.
      it('matches q across ALL translations, on title/slug/summary, case-insensitive substring', async () => {
        await service.listAdmin(baseQuery({ q: 'zidni' }));
        expect(findManyArgs().where).toEqual({
          translations: {
            some: {
              OR: [
                {
                  title: {
                    contains: 'zidni',
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
                {
                  slug: {
                    contains: 'zidni',
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
                {
                  summary: {
                    contains: 'zidni',
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              ],
            },
          },
        });
      });

      it('trims surrounding whitespace from q before matching', async () => {
        await service.listAdmin(baseQuery({ q: '  zidni  ' }));
        const where = findManyArgs().where as {
          translations: { some: { OR: { title: { contains: string } }[] } };
        };
        expect(where.translations.some.OR[0]?.title.contains).toBe('zidni');
      });

      it('drops an empty q rather than applying it as a predicate', async () => {
        await service.listAdmin(baseQuery({ q: '' }));
        expect(findManyArgs().where).toEqual({});
      });

      // The case that actually exercises `.trim()`, distinct from an empty string.
      it('drops a whitespace-only q rather than applying it as a predicate', async () => {
        await service.listAdmin(baseQuery({ q: '   ' }));
        expect(findManyArgs().where).toEqual({});
      });

      it('combines q with isPublished and featured', async () => {
        await service.listAdmin(
          baseQuery({ q: 'zidni', isPublished: true, featured: true }),
        );
        const where = findManyArgs().where as Record<string, unknown>;
        expect(where.isPublished).toBe(true);
        expect(where.featured).toBe(true);
        expect(where.translations).toBeDefined();
      });
    });

    describe('orderBy (allowlisted sort + total tie-breaker)', () => {
      it('defaults to featured desc, order asc, id asc when sortBy is absent', async () => {
        await service.listAdmin(baseQuery());
        expect(findManyArgs().orderBy).toEqual([
          { featured: 'desc' },
          { order: 'asc' },
          { id: 'asc' },
        ]);
      });

      // Doc 10 §6: "ignored when sortBy is absent." A stray sortOrder must not change the default.
      it('ignores sortOrder when sortBy is absent', async () => {
        await service.listAdmin(baseQuery({ sortOrder: SortOrder.Desc }));
        expect(findManyArgs().orderBy).toEqual([
          { featured: 'desc' },
          { order: 'asc' },
          { id: 'asc' },
        ]);
      });

      it.each([
        [AdminProjectSortBy.Featured, 'featured'],
        [AdminProjectSortBy.Order, 'order'],
        [AdminProjectSortBy.CreatedAt, 'createdAt'],
        [AdminProjectSortBy.UpdatedAt, 'updatedAt'],
      ])(
        'sorts by %s asc with an id asc tie-breaker',
        async (sortBy, field) => {
          await service.listAdmin(
            baseQuery({ sortBy, sortOrder: SortOrder.Asc }),
          );
          expect(findManyArgs().orderBy).toEqual([
            { [field]: 'asc' },
            { id: 'asc' },
          ]);
        },
      );

      it.each([
        [AdminProjectSortBy.Featured, 'featured'],
        [AdminProjectSortBy.Order, 'order'],
        [AdminProjectSortBy.CreatedAt, 'createdAt'],
        [AdminProjectSortBy.UpdatedAt, 'updatedAt'],
      ])(
        'sorts by %s desc with an id asc tie-breaker',
        async (sortBy, field) => {
          await service.listAdmin(
            baseQuery({ sortBy, sortOrder: SortOrder.Desc }),
          );
          expect(findManyArgs().orderBy).toEqual([
            { [field]: 'desc' },
            { id: 'asc' },
          ]);
        },
      );

      it('sorts by year ascending with nulls last', async () => {
        await service.listAdmin(
          baseQuery({
            sortBy: AdminProjectSortBy.Year,
            sortOrder: SortOrder.Asc,
          }),
        );
        expect(findManyArgs().orderBy).toEqual([
          { year: { sort: 'asc', nulls: 'last' } },
          { id: 'asc' },
        ]);
      });

      // year is the one branch where `desc` is NOT simply the reverse of `asc`: a project without a
      // year sorts LAST in BOTH directions, so it never floats to the top under `desc` the way a
      // plain nullable column would. Asserted explicitly so a future refactor to a generic
      // `[{[field]: direction}]` cannot silently drop the `nulls: 'last'` override on this one field.
      it('sorts by year descending, ALSO with nulls last (not the reverse of asc)', async () => {
        await service.listAdmin(
          baseQuery({
            sortBy: AdminProjectSortBy.Year,
            sortOrder: SortOrder.Desc,
          }),
        );
        expect(findManyArgs().orderBy).toEqual([
          { year: { sort: 'desc', nulls: 'last' } },
          { id: 'asc' },
        ]);
      });
    });
  });

  describe('getPublicBySlug', () => {
    const publishedWithOg = (): never => {
      const base = projectPayload(true);
      return {
        ...base,
        translations: base.translations.map((translation) => ({
          ...translation,
          ogImageId: translation.locale === 'en' ? 'og-1' : null,
          ogImage:
            translation.locale === 'en'
              ? imageAsset('og-1', [{ locale: 'en', alt: 'OG alt' }])
              : null,
        })),
      } as never;
    };

    it('returns 404 for an unpublished project slug', async () => {
      prisma.projectTranslation.findUnique.mockResolvedValue({
        project: projectPayload(false),
      } as never);

      await expect(
        service.getPublicBySlug('english-project', 'en'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('resolves gallery + OG descriptors, retains ids, and issues no per-item media query', async () => {
      prisma.projectTranslation.findUnique.mockResolvedValue({
        project: publishedWithOg(),
      } as never);

      const result = await service.getPublicBySlug('english-project', 'en');

      expect(result.gallery[0]?.mediaAssetId).toBe('media-1');
      // D10-14: width/height describe the file `url` points at (the 1280 WebP), NOT the 1600×900
      // master. The fixture deliberately keeps them different so this stays a real assertion; the
      // aspect ratio is identical either way (1.778), which is why the gallery's intrinsic-box
      // reservation is unaffected by the change.
      expect(result.gallery[0]?.mediaAsset).toEqual({
        id: 'media-1',
        kind: MediaKind.IMAGE,
        url: 'https://media.test/media/media-1/1280-webp.webp',
        width: 1280,
        height: 720,
        blurhash: 'BH',
        alt: 'Dashboard shot',
        variants: [
          {
            format: MediaVariantFormat.WEBP,
            width: 1280,
            height: 720,
            url: 'https://media.test/media/media-1/1280-webp.webp',
          },
        ],
      });
      expect(result.ogImageId).toBe('og-1');
      expect(result.ogImage?.url).toBe(
        'https://media.test/media/og-1/1280-webp.webp',
      );
      // No N+1 — gallery + OG came from the single project query.
      expect(prisma.mediaAsset.findUnique).not.toHaveBeenCalled();
      expect(prisma.mediaAsset.findMany).not.toHaveBeenCalled();
    });

    it('returns ogImage: null when the translation has no OG', async () => {
      prisma.projectTranslation.findUnique.mockResolvedValue({
        project: projectPayload(true),
      } as never);

      const result = await service.getPublicBySlug('english-project', 'en');
      expect(result.ogImageId).toBeNull();
      expect(result.ogImage).toBeNull();
    });

    it('resolves a gallery alt to null for a missing locale (no cross-locale fallback)', async () => {
      prisma.projectTranslation.findUnique.mockResolvedValue({
        project: projectPayload(true),
      } as never);

      // Detail resolved to 'ar'; the gallery image has only an 'en' alt row.
      const result = await service.getPublicBySlug('arabic-project', 'ar');
      expect(result.gallery[0]?.mediaAsset.alt).toBeNull();
    });
  });

  describe('getPreviewById (D10-8 draft preview, status-agnostic)', () => {
    it('returns an unpublished project by id, bypassing the isPublished filter', async () => {
      prisma.project.findUnique.mockResolvedValue(projectPayload(false));

      const result = await service.getPreviewById('project-1', 'en');

      expect(locales.assertEnabled).toHaveBeenCalledWith('en');
      expect(prisma.project.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'project-1' } }),
      );
      expect(result.title).toBe('English project');
      expect(result.slug).toBe('english-project');
    });

    it('404s when the project id does not exist', async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.getPreviewById('missing', 'en'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create', () => {
    // The create is ONE nested Prisma write, which is already atomic, so it must not be
    // wrapped in `$transaction`. Asserting both halves — the direct call happened AND no
    // transaction was opened — is what makes this discriminating; the second assertion alone
    // would pass on a service that never wrote at all.
    it('issues a single nested create, with no transaction wrapper', async () => {
      prisma.project.create.mockResolvedValue(projectPayload(true));

      await service.create(createDto);

      expect(prisma.project.create).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    // Relation semantics: the nested writes must survive unwrapping unchanged. `createDto`
    // carries no technologies and no gallery, so a populated DTO is used here — against the bare
    // fixture both relations are `undefined` by design and the assertion would prove nothing.
    it('keeps translations, technologies and gallery as nested writes in that one call', async () => {
      prisma.project.create.mockResolvedValue(projectPayload(true));
      const populated = {
        ...createDto,
        technologyIds: ['skill-1', 'skill-2'],
        gallery: [
          { mediaAssetId: 'asset-1', order: 0, translations: {} },
          { mediaAssetId: 'asset-2', order: 1, translations: {} },
        ],
      };

      await service.create(populated);

      const { data } = prisma.project.create.mock.calls[0]?.[0] ?? {};
      expect(data?.translations).toEqual({
        create: expect.arrayContaining([
          expect.objectContaining({ locale: 'en', slug: 'project' }),
        ]),
      });
      expect(data?.technologies).toEqual({
        create: [{ skillId: 'skill-1' }, { skillId: 'skill-2' }],
      });
      expect(data?.gallery).toEqual({
        create: [
          expect.objectContaining({ mediaAssetId: 'asset-1', order: 0 }),
          expect.objectContaining({ mediaAssetId: 'asset-2', order: 1 }),
        ],
      });
    });

    // The empty-relation shape is deliberate (`undefined`, not `{ create: [] }`) and unchanged by
    // Pinned so unwrapping the transaction cannot quietly start writing empty relations.
    it('omits the optional relations entirely when none are supplied', async () => {
      prisma.project.create.mockResolvedValue(projectPayload(true));

      await service.create(createDto);

      const { data } = prisma.project.create.mock.calls[0]?.[0] ?? {};
      expect(data?.technologies).toBeUndefined();
      expect(data?.gallery).toBeUndefined();
    });

    // The service must NOT translate Prisma errors: `AllExceptionsFilter` is the
    // single translation point (doc 15 §3). A local catch here produced a bare 422 with no
    // `errors[]`, so the same failure returned a different contract than every sibling module.
    //
    // This asserts propagation ONLY. It deliberately does not assert a status code: turning P2002
    // into a 422 is now the filter's job, and a mocked error object cannot prove the filter's
    // behaviour — a plain `{ code: 'P2002' }` is not `instanceof PrismaClientKnownRequestError`
    // and would take the sanitized-500 arm. The real proof is
    // `test/prisma-error-mapping.e2e-spec.ts`, against a REAL PostgreSQL conflict.
    it('propagates a Prisma unique violation untranslated, for the global filter to map', async () => {
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique failed', {
        code: 'P2002',
        clientVersion: 'test',
      });
      prisma.project.create.mockRejectedValue(p2002);

      await expect(service.create(createDto)).rejects.toBe(p2002);
    });
  });

  // D04-6 gating only. The 3-op DB behavior (chain-collapse, rename-back, atomicity across rows) is
  // covered by the buildRedirectOps unit test and the redirects e2e suite; here we assert solely the
  // publish-time predicate and that the returned ops land in the same $transaction as the rename.
  describe('update (D04-6 auto-redirect on published slug rename)', () => {
    // Sentinel op-set standing in for buildRedirectOps' 3 real ops; identity is asserted in the tx.
    const redirectOps = [
      { __redirectOp: 'updateMany' },
      { __redirectOp: 'deleteMany' },
      { __redirectOp: 'create' },
    ] as unknown as Prisma.PrismaPromise<unknown>[];

    // A full ProjectTranslationDto (all required Markdown fields) with a settable locale + slug.
    const translationDto = (locale: string, slug: string) => ({
      locale,
      title: `Title ${locale}`,
      slug,
      summary: 'Summary',
      overview: 'Overview',
      businessProblem: 'Problem',
      solution: 'Solution',
      role: 'Role',
      architecture: 'Architecture',
      challenges: 'Challenges',
      features: 'Features',
      lessonsLearned: 'Lessons',
    });

    it('creates one redirect op-set when a published project is renamed with isPublished omitted', async () => {
      // Guards the dto.isPublished===true regression: an omitted flag must resolve to the existing
      // published state via nextIsPublished = dto.isPublished ?? existing.isPublished.
      prisma.project.findUnique.mockResolvedValue(projectPayload(true));
      redirects.buildRedirectOps.mockReturnValue(redirectOps);

      await service.update('project-1', {
        translations: [translationDto('en', 'english-project-v2')],
      });

      expect(redirects.buildRedirectOps).toHaveBeenCalledTimes(1);
      expect(redirects.buildRedirectOps).toHaveBeenCalledWith({
        locale: 'en',
        entityType: 'project',
        oldSlug: 'english-project',
        newSlug: 'english-project-v2',
      });
      const txOps = prisma.$transaction.mock
        .calls[0]![0] as unknown as unknown[];
      expect(txOps).toEqual(expect.arrayContaining(redirectOps));
    });

    it('does not create a redirect when the project is unpublished', async () => {
      prisma.project.findUnique.mockResolvedValue(projectPayload(false));

      await service.update('project-1', {
        translations: [translationDto('en', 'english-project-v2')],
      });

      expect(redirects.buildRedirectOps).not.toHaveBeenCalled();
    });

    it('does not create a redirect when the slug is unchanged', async () => {
      prisma.project.findUnique.mockResolvedValue(projectPayload(true));

      await service.update('project-1', {
        translations: [translationDto('en', 'english-project')],
      });

      expect(redirects.buildRedirectOps).not.toHaveBeenCalled();
    });

    it('does not create a redirect on an unpublished→published rename (old slug was never public)', async () => {
      prisma.project.findUnique.mockResolvedValue(projectPayload(false));

      await service.update('project-1', {
        isPublished: true,
        translations: [translationDto('en', 'english-project-v2')],
      });

      expect(redirects.buildRedirectOps).not.toHaveBeenCalled();
    });

    it('does not create a redirect on a published→unpublished rename (new slug not live)', async () => {
      prisma.project.findUnique.mockResolvedValue(projectPayload(true));

      await service.update('project-1', {
        isPublished: false,
        translations: [translationDto('en', 'english-project-v2')],
      });

      expect(redirects.buildRedirectOps).not.toHaveBeenCalled();
    });

    it('creates a redirect only for the changed locale (en changed, ar unchanged)', async () => {
      prisma.project.findUnique.mockResolvedValue(projectPayload(true));
      redirects.buildRedirectOps.mockReturnValue(redirectOps);

      await service.update('project-1', {
        translations: [
          translationDto('en', 'english-project-v2'),
          translationDto('ar', 'arabic-project'),
        ],
      });

      expect(redirects.buildRedirectOps).toHaveBeenCalledTimes(1);
      expect(redirects.buildRedirectOps).toHaveBeenCalledWith({
        locale: 'en',
        entityType: 'project',
        oldSlug: 'english-project',
        newSlug: 'english-project-v2',
      });
    });
  });
});
