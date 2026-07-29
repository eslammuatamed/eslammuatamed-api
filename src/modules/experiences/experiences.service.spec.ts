import { UnprocessableEntityException } from '@nestjs/common';
import {
  EmploymentType,
  Experience,
  ExperienceTranslation,
} from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalesService } from '../locales/locales.service';
import { ExperiencesService } from './experiences.service';

// Shaped as the public include loads it: each link carries its skill with the locale-filtered
// translation, so the label resolves without a second query (mirrors ProjectTechnology).
type TechLink = {
  skillId: string;
  skill: {
    id: string;
    order: number;
    translations: { locale: string; label: string }[];
  };
};

type ExperienceRow = Experience & {
  translations: ExperienceTranslation[];
  technologies: TechLink[];
};

const tech = (
  id: string,
  label: string,
  order: number,
  locale = 'en',
): TechLink => ({
  skillId: id,
  skill: { id, order, translations: [{ locale, label }] },
});

const row = (startDate: string, order: number, id = 'e1'): ExperienceRow => ({
  id,
  startDate: new Date(startDate),
  endDate: null,
  isCurrent: false,
  employmentType: EmploymentType.FULL_TIME,
  order,
  createdAt: new Date(),
  updatedAt: new Date(),
  technologies: [],
  translations: [
    {
      id: `${id}-en`,
      experienceId: id,
      locale: 'en',
      role: 'Engineer',
      company: 'Acme',
      location: 'Remote',
      impact: 'Impact',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
});

describe('ExperiencesService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let locales: DeepMockProxy<LocalesService>;
  let service: ExperiencesService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    locales = mockDeep<LocalesService>();
    service = new ExperiencesService(prisma, locales);
  });

  it('orders public experiences reverse chronologically with order tie-breaker', async () => {
    prisma.experience.findMany.mockResolvedValue([
      row('2024-01-01', 2),
      row('2024-02-01', 1, 'e2'),
    ]);

    const result = await service.listPublic('en');

    expect(prisma.experience.findMany).toHaveBeenCalledWith({
      include: {
        translations: true,
        technologies: {
          include: {
            skill: { include: { translations: { where: { locale: 'en' } } } },
          },
        },
      },
      orderBy: [{ startDate: 'desc' }, { order: 'asc' }],
    });
    expect(result.map((item) => item.id)).toEqual(['e2', 'e1']);
  });

  it('rejects an invalid employment type with 422', async () => {
    await expect(
      service.create({
        startDate: '2024-01-01',
        isCurrent: false,
        order: 0,
        employmentType: 'INVALID' as EmploymentType,
        translations: [
          {
            locale: 'en',
            role: 'Engineer',
            company: 'Acme',
            location: 'Remote',
            impact: 'Impact',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.experience.create).not.toHaveBeenCalled();
  });

  // ── Experience technologies (D09-17, D10-13) ───────────────────────────────────────────────
  describe('technologies', () => {
    it('resolves labels for the requested locale, ordered by Skill.order', async () => {
      const experience = row('2024-01-01', 0);
      experience.technologies = [
        tech('s-nuxt', 'Nuxt', 2),
        tech('s-ts', 'TypeScript', 1),
      ];
      prisma.experience.findMany.mockResolvedValue([experience]);

      const [result] = await service.listPublic('en');

      // Order derives from Skill.order, not from insertion order (no join order column).
      expect(result?.technologies).toEqual([
        { id: 's-ts', label: 'TypeScript' },
        { id: 's-nuxt', label: 'Nuxt' },
      ]);
    });

    it('omits a technology with no translation in the requested locale', async () => {
      const experience = row('2024-01-01', 0);
      // The experience itself IS translated into ar — otherwise the whole entry is dropped
      // before technologies matter. Only the skill lacks an ar label.
      experience.translations.push({
        ...experience.translations[0]!,
        id: 'e1-ar',
        locale: 'ar',
      });
      experience.technologies = [tech('s-ts', 'TypeScript', 1, 'en')];
      prisma.experience.findMany.mockResolvedValue([experience]);

      const [result] = await service.listPublic('ar');

      // No cross-locale fallback: an untranslated skill is dropped, never shown in English.
      expect(result?.technologies).toEqual([]);
    });

    it('returns an empty array when no technologies are linked', async () => {
      prisma.experience.findMany.mockResolvedValue([row('2024-01-01', 0)]);

      const [result] = await service.listPublic('en');

      expect(result?.technologies).toEqual([]);
    });

    it('rejects unknown skill ids', async () => {
      prisma.experience.findUnique.mockResolvedValue(row('2024-01-01', 0));
      prisma.skill.findMany.mockResolvedValue([{ id: 's-ts' }] as never);

      await expect(
        service.update('e1', { technologyIds: ['s-ts', 's-missing'] }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('rejects duplicate skill ids in one payload', async () => {
      prisma.experience.findUnique.mockResolvedValue(row('2024-01-01', 0));

      await expect(
        service.update('e1', { technologyIds: ['s-ts', 's-ts'] }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('replaces relation membership transactionally', async () => {
      prisma.experience.findUnique.mockResolvedValue(row('2024-01-01', 0));
      prisma.skill.findMany.mockResolvedValue([
        { id: 's-ts' },
        { id: 's-nuxt' },
      ] as never);

      await service.update('e1', { technologyIds: ['s-ts', 's-nuxt'] });

      // Delete-then-create must ride the same $transaction so a failure cannot leave an
      // experience with its previous links removed and none written.
      expect(prisma.experienceTechnology.deleteMany).toHaveBeenCalledWith({
        where: { experienceId: 'e1' },
      });
      expect(prisma.experienceTechnology.createMany).toHaveBeenCalledWith({
        data: [
          { experienceId: 'e1', skillId: 's-ts' },
          { experienceId: 'e1', skillId: 's-nuxt' },
        ],
      });
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('clears all links when given an empty array', async () => {
      prisma.experience.findUnique.mockResolvedValue(row('2024-01-01', 0));

      await service.update('e1', { technologyIds: [] });

      expect(prisma.experienceTechnology.deleteMany).toHaveBeenCalledWith({
        where: { experienceId: 'e1' },
      });
      expect(prisma.experienceTechnology.createMany).not.toHaveBeenCalled();
    });
  });
});
