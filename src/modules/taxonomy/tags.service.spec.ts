import { Tag, TagTranslation } from '../../generated/prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalesService } from '../locales/locales.service';
import { AdminTagListQueryDto } from './dto/tag.dto';
import { TagsService } from './tags.service';

type TagRow = Tag & { translations: TagTranslation[] };

function translation(locale: string, slug: string): TagTranslation {
  return {
    id: `tt-${locale}`,
    tagId: 't1',
    locale,
    name: `Name ${locale}`,
    slug,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function tagRow(translations: TagTranslation[], id = 't1'): TagRow {
  return {
    id,
    createdAt: new Date(),
    updatedAt: new Date(),
    translations,
  };
}

describe('TagsService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let locales: DeepMockProxy<LocalesService>;
  let service: TagsService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    locales = mockDeep<LocalesService>();
    service = new TagsService(prisma, locales);
  });

  describe('listAdmin pagination', () => {
    const query = (
      overrides: Partial<AdminTagListQueryDto> = {},
    ): AdminTagListQueryDto =>
      Object.assign(new AdminTagListQueryDto(), overrides);

    it('orders before pagination with an id tie-breaker and shares one predicate with total', async () => {
      const first = tagRow([translation('en', 'first')], 'aaa');
      const second = tagRow([translation('en', 'second')], 'bbb');
      prisma.$transaction.mockResolvedValue([[first, second], 4] as never);

      const result = await service.listAdmin(query({ page: 2, perPage: 2 }));

      expect(prisma.tag.findMany).toHaveBeenCalledWith({
        where: {},
        include: { translations: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: 2,
        take: 2,
      });
      expect(prisma.tag.count).toHaveBeenCalledWith({ where: {} });
      expect(result.data.map((item) => item.id)).toEqual(['aaa', 'bbb']);
      expect(result.meta).toEqual({
        page: 2,
        perPage: 2,
        total: 4,
        totalPages: 2,
      });
    });

    it('uses PaginationQueryDto defaults for the first admin page', async () => {
      prisma.$transaction.mockResolvedValue([[], 0] as never);

      const result = await service.listAdmin(query());

      expect(prisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 12 }),
      );
      expect(result.meta).toEqual({
        page: 1,
        perPage: 12,
        total: 0,
        totalPages: 0,
      });
    });

    it('keeps the public locale-resolved unpaginated query path unchanged', async () => {
      prisma.tag.findMany.mockResolvedValue([
        tagRow([translation('en', 'typescript')]),
      ]);

      await service.listPublic('en');

      expect(prisma.tag.findMany).toHaveBeenCalledWith({
        include: { translations: true },
        orderBy: { createdAt: 'asc' },
      });
      expect(prisma.tag.count).not.toHaveBeenCalled();
    });
  });
});
