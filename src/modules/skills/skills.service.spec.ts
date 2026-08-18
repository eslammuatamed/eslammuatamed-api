import {
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import {
  Skill,
  SkillTranslation,
  SkillGroup,
} from '../../generated/prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalesService } from '../locales/locales.service';
import { SkillsService } from './skills.service';

type SkillRow = Skill & { translations: SkillTranslation[] };

const row = (group: SkillGroup, order: number, id = 's1'): SkillRow => ({
  id,
  slug: id,
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

  // The public skills list doubles as the technology filter-option source. Without `slug` a client
  // could only build `/projects?technology=` from the id or the translated label — the two forms
  // the slug exists to replace — so its presence here is a contract requirement, not a detail.
  it('exposes the slug on public skills so clients can build filter URLs', async () => {
    prisma.skill.findMany.mockResolvedValue([row(SkillGroup.LANGUAGE, 0)]);

    const result = await service.listPublic('en');

    expect(result[0]).toEqual(expect.objectContaining({ slug: 's1' }));
  });

  it('exposes the slug on admin skills', async () => {
    prisma.skill.findMany.mockResolvedValue([row(SkillGroup.LANGUAGE, 0)]);

    const result = await service.listAdmin();

    expect(result[0]).toEqual(expect.objectContaining({ slug: 's1' }));
  });

  it('persists the requested slug when creating a skill', async () => {
    prisma.skill.create.mockResolvedValue(row(SkillGroup.LANGUAGE, 0));

    await service.create({
      slug: 'tailwind-css',
      group: SkillGroup.LANGUAGE,
      order: 0,
      translations: [{ locale: 'en', label: 'Tailwind CSS' }],
    });

    expect(prisma.skill.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: 'tailwind-css' }),
      }),
    );
  });

  // Two skills behind one public filter URL is precisely what the unique constraint prevents, so a
  // duplicate is a caller error. Left unmapped it surfaces as a 500, which reads as a server fault
  // and tells the caller nothing about how to fix the request.
  // A duplicate slug must NOT be
  // translated here — it belongs to `AllExceptionsFilter`, like every other module's unique
  // violation. Asserting "rejects with the raw Prisma error" is what makes this
  // discriminating: re-adding any local P2002 arm turns the rejection into an `HttpException`
  // and fails both assertions. The public 422 this produces is proven against real PostgreSQL in
  // `test/prisma-error-mapping.e2e-spec.ts` §B3.
  it('lets a duplicate slug reach the global filter instead of translating it locally', async () => {
    const violation = { code: 'P2002' };
    prisma.skill.create.mockRejectedValue(violation);

    const rejection = service.create({
      slug: 'typescript',
      group: SkillGroup.LANGUAGE,
      order: 0,
      translations: [{ locale: 'en', label: 'TypeScript' }],
    });

    await expect(rejection).rejects.toBe(violation);
    await expect(rejection).rejects.not.toBeInstanceOf(HttpException);
  });
});
