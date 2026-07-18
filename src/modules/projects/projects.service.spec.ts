import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MediaKind, MediaVariantFormat } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalesService } from '../locales/locales.service';
import { MediaDescriptorResolver } from '../media/media-descriptor.resolver';
import { StorageAdapter } from '../media/storage/storage-adapter.interface';
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
          group: 'FRAMEWORK',
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
  let service: ProjectsService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    locales = mockDeep<LocalesService>();
    service = new ProjectsService(
      prisma,
      locales,
      new MediaDescriptorResolver(storage),
    );
  });

  describe('listPublic', () => {
    it('filters the public list to published projects only', async () => {
      prisma.$transaction.mockResolvedValue([
        [projectPayload(true)],
        1,
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

    it('applies the technology Skill id filter without relaxing publication', async () => {
      prisma.$transaction.mockResolvedValue([[], 0] as never);

      await service.listPublic({
        page: 1,
        perPage: 12,
        skip: 0,
        take: 12,
        locale: 'en',
        technology: 'skill-1',
      });

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isPublished: true,
            technologies: { some: { skillId: 'skill-1' } },
          }),
        }),
      );
    });

    it('orders featured projects first and then by explicit order', async () => {
      prisma.$transaction.mockResolvedValue([[], 0] as never);

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
          technologies: [{ id: 'skill-1', label: 'NestJS' }],
        }),
      );
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
      expect(result.gallery[0]?.mediaAsset).toEqual({
        id: 'media-1',
        kind: MediaKind.IMAGE,
        url: 'https://media.test/media/media-1/1280-webp.webp',
        width: 1600,
        height: 900,
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

  describe('create', () => {
    it('maps a per-locale slug collision to 422', async () => {
      prisma.$transaction.mockRejectedValue({ code: 'P2002' });

      await expect(service.create(createDto)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });
  });
});
