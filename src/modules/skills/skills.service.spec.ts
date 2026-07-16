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

  it('orders the public list by group then order and resolves its locale', async () => {
    prisma.skill.findMany.mockResolvedValue([
      row(SkillGroup.FRAMEWORK, 2),
      row(SkillGroup.LANGUAGE, 1, 's2'),
    ]);

    const result = await service.listPublic('en');

    expect(prisma.skill.findMany).toHaveBeenCalledWith({
      include: { translations: true },
      orderBy: [{ group: 'asc' }, { order: 'asc' }],
    });
    expect(result[0]?.group).toBe(SkillGroup.LANGUAGE);
    expect(locales.assertEnabled).toHaveBeenCalledWith('en');
  });

  it('maps a foreign-key delete failure to conflict', async () => {
    prisma.skill.findUnique.mockResolvedValue(row(SkillGroup.TOOLING, 0));
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
