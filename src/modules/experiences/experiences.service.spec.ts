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

type ExperienceRow = Experience & { translations: ExperienceTranslation[] };

const row = (startDate: string, order: number, id = 'e1'): ExperienceRow => ({
  id,
  startDate: new Date(startDate),
  endDate: null,
  isCurrent: false,
  employmentType: EmploymentType.FULL_TIME,
  order,
  createdAt: new Date(),
  updatedAt: new Date(),
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
      include: { translations: true },
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
});
