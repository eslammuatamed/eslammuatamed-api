import { ConflictException, NotFoundException } from '@nestjs/common';
import { Skill, SkillTranslation, SkillGroup } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalesService } from '../locales/locales.service';
import { SkillsService } from './skills.service';

type SkillRow = Skill & { translations: SkillTranslation[] };

const row = (group: SkillGroup, order: number, id = 's1'): SkillRow => ({
  id,
  group,
  order,
  brandColor: '#fff',
  isPublic: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  translations: [
    {
      id: `${id}-en`,
      skillId: id,
      locale: 'en',
      label: id,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
});

describe('SkillsService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let locales: DeepMockProxy<LocalesService>;
  let service: SkillsService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    locales = mockDeep<LocalesService>();
    service = new SkillsService(prisma, locales);
  });

  it('orders the public list by group then order, filters hidden skills, and resolves its locale', async () => {
    prisma.skill.findMany.mockResolvedValue([
      row(SkillGroup.FRONTEND, 2),
      row(SkillGroup.LANGUAGE, 1, 's2'),
    ]);

    const result = await service.listPublic('en');

    // The hidden-skill filter is the whole visibility mechanism: a skill dropped from the public
    // taxonomy is kept (its project/experience links depend on it) but must not be served here.
    expect(prisma.skill.findMany).toHaveBeenCalledWith({
      where: { isPublic: true },
      include: { translations: true },
      orderBy: [{ group: 'asc' }, { order: 'asc' }],
    });
    expect(result[0]?.group).toBe(SkillGroup.LANGUAGE);
    expect(locales.assertEnabled).toHaveBeenCalledWith('en');
  });

  it('leaves the admin list unfiltered so hidden skills stay manageable', async () => {
    prisma.skill.findMany.mockResolvedValue([row(SkillGroup.LANGUAGE, 0)]);

    await service.listAdmin();

    expect(prisma.skill.findMany).toHaveBeenCalledWith({
      include: { translations: true },
      orderBy: [{ group: 'asc' }, { order: 'asc' }],
    });
  });

  it('maps a foreign-key delete failure to conflict', async () => {
    prisma.skill.findUnique.mockResolvedValue(row(SkillGroup.BACKEND, 0));
    prisma.skill.delete.mockRejectedValue({ code: 'P2003' });

    await expect(service.remove('s1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('throws not found when deleting an unknown skill', async () => {
    prisma.skill.findUnique.mockResolvedValue(null);
    await expect(service.remove('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
