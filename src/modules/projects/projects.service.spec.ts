import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalesService } from '../locales/locales.service';
import { ProjectsService } from './projects.service';

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
    service = new ProjectsService(prisma, locales);
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
    it('returns 404 for an unpublished project slug', async () => {
      prisma.projectTranslation.findUnique.mockResolvedValue({
        project: projectPayload(false),
      } as never);

      await expect(
        service.getPublicBySlug('english-project', 'en'),
      ).rejects.toBeInstanceOf(NotFoundException);
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
