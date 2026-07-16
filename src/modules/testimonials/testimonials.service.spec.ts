import { Testimonial, TestimonialTranslation } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalesService } from '../locales/locales.service';
import { TestimonialsService } from './testimonials.service';

type TestimonialRow = Testimonial & { translations: TestimonialTranslation[] };

const row = (isVisible: boolean, id: string): TestimonialRow => ({
  id,
  avatarId: null,
  order: 1,
  isVisible,
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
});

describe('TestimonialsService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let locales: DeepMockProxy<LocalesService>;
  let service: TestimonialsService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    locales = mockDeep<LocalesService>();
    service = new TestimonialsService(prisma, locales);
  });

  it('excludes hidden testimonials from the public list', async () => {
    prisma.testimonial.findMany.mockResolvedValue([
      row(true, 't1'),
      row(false, 't2'),
    ]);

    const result = await service.listPublic('en');

    expect(prisma.testimonial.findMany).toHaveBeenCalledWith({
      where: { isVisible: true },
      include: { translations: true },
      orderBy: { order: 'asc' },
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('t1');
  });
});
