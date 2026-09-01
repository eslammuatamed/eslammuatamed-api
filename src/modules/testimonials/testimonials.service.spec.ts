import { MediaKind, MediaVariantFormat } from '../../generated/prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalesService } from '../locales/locales.service';
import { MediaDescriptorResolver } from '../media/media-descriptor.resolver';
import { StorageAdapter } from '../media/storage/storage-adapter.interface';
import { AdminTestimonialListQueryDto } from './dto/testimonial.dto';
import { TestimonialsService } from './testimonials.service';

const storage = {
  put: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
  publicUrl: (key: string) => `https://media.test/${key}`,
} as unknown as StorageAdapter;

const avatarAsset = (): Record<string, unknown> => ({
  id: 'avatar-1',
  kind: MediaKind.IMAGE,
  storageKey: 'media/px/master.webp',
  originalFilename: 'face.jpg',
  mimeType: 'image/webp',
  sizeBytes: 5000,
  contentHash: 'h',
  width: 512,
  height: 512,
  blurhash: 'LKO2',
  createdAt: new Date(),
  updatedAt: new Date(),
  variants: [
    {
      id: 'v1',
      mediaAssetId: 'avatar-1',
      format: MediaVariantFormat.WEBP,
      width: 512,
      height: 512,
      storageKey: 'media/px/512-webp.webp',
      sizeBytes: 3000,
      overBudget: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  alts: [
    {
      id: 'a1',
      mediaAssetId: 'avatar-1',
      locale: 'en',
      alt: 'Portrait of Alex',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
});

const row = (
  isVisible: boolean,
  id: string,
  avatar: Record<string, unknown> | null = null,
  order = 1,
): never =>
  ({
    id,
    avatarId: avatar ? 'avatar-1' : null,
    order,
    isVisible,
    avatar,
    createdAt: new Date(),
    updatedAt: new Date(),
    translations: [
      {
        id: `${id}-en`,
        testimonialId: id,
        locale: 'en',
        quote: 'Great work',
        authorName: 'Alex',
        authorRole: 'CTO',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  }) as never;

describe('TestimonialsService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let locales: DeepMockProxy<LocalesService>;
  let service: TestimonialsService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    locales = mockDeep<LocalesService>();
    service = new TestimonialsService(
      prisma,
      locales,
      new MediaDescriptorResolver(storage),
    );
  });

  it('excludes hidden testimonials and loads the avatar in one query (no N+1)', async () => {
    prisma.testimonial.findMany.mockResolvedValue([
      row(true, 't1', avatarAsset()),
      row(false, 't2'),
    ]);

    const result = await service.listPublic('en');

    expect(prisma.testimonial.findMany).toHaveBeenCalledWith({
      where: { isVisible: true },
      include: {
        translations: true,
        avatar: { include: { variants: true, alts: true } },
      },
      orderBy: { order: 'asc' },
    });
    // No per-item media query — the avatar came from the parent include.
    expect(prisma.mediaAsset.findUnique).not.toHaveBeenCalled();
    expect(prisma.mediaAsset.findMany).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('t1');
  });

  it('resolves the avatar descriptor and retains avatarId', async () => {
    prisma.testimonial.findMany.mockResolvedValue([
      row(true, 't1', avatarAsset()),
    ]);

    const [testimonial] = await service.listPublic('en');

    expect(testimonial?.avatarId).toBe('avatar-1');
    expect(testimonial?.avatar).toEqual({
      id: 'avatar-1',
      kind: MediaKind.IMAGE,
      url: 'https://media.test/media/px/512-webp.webp',
      width: 512,
      height: 512,
      blurhash: 'LKO2',
      alt: 'Portrait of Alex',
      variants: [
        {
          format: MediaVariantFormat.WEBP,
          width: 512,
          height: 512,
          url: 'https://media.test/media/px/512-webp.webp',
        },
      ],
    });
  });

  it('returns avatar: null and avatarId: null when no avatar is set', async () => {
    prisma.testimonial.findMany.mockResolvedValue([row(true, 't1', null)]);

    const [testimonial] = await service.listPublic('en');

    expect(testimonial?.avatarId).toBeNull();
    expect(testimonial?.avatar).toBeNull();
  });

  describe('listAdmin pagination', () => {
    const query = (
      overrides: Partial<AdminTestimonialListQueryDto> = {},
    ): AdminTestimonialListQueryDto =>
      Object.assign(new AdminTestimonialListQueryDto(), overrides);

    it('orders before pagination with an id tie-breaker and shares one predicate with total', async () => {
      const first = row(true, 'aaa', null, 7);
      const second = row(false, 'bbb', null, 7);
      prisma.$transaction.mockResolvedValue([[first, second], 4] as never);

      const result = await service.listAdmin(query({ page: 2, perPage: 2 }));

      expect(prisma.testimonial.findMany).toHaveBeenCalledWith({
        where: {},
        include: { translations: true },
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
        skip: 2,
        take: 2,
      });
      expect(prisma.testimonial.count).toHaveBeenCalledWith({ where: {} });
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

      expect(prisma.testimonial.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 12 }),
      );
      expect(result.meta).toEqual({
        page: 1,
        perPage: 12,
        total: 0,
        totalPages: 0,
      });
    });

    it('keeps the public visibility, locale, and unpaginated query path unchanged', async () => {
      prisma.testimonial.findMany.mockResolvedValue([
        row(true, 'visible', avatarAsset()),
      ]);

      await service.listPublic('en');

      expect(prisma.testimonial.findMany).toHaveBeenCalledWith({
        where: { isVisible: true },
        include: {
          translations: true,
          avatar: { include: { variants: true, alts: true } },
        },
        orderBy: { order: 'asc' },
      });
      expect(prisma.testimonial.count).not.toHaveBeenCalled();
    });
  });
});
