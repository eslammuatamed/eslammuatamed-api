import { BadRequestException } from '@nestjs/common';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalesService } from './locales.service';

describe('LocalesService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: LocalesService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new LocalesService(prisma);
  });

  it('lists enabled locales as resolved shapes', async () => {
    prisma.locale.findMany.mockResolvedValue([
      {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        dir: 'ltr',
        isEnabled: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await service.listEnabled();

    expect(result).toEqual([
      { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr' },
    ]);
    expect(prisma.locale.findMany).toHaveBeenCalledWith({
      where: { isEnabled: true },
      orderBy: { order: 'asc' },
    });
  });

  it('accepts an enabled locale', async () => {
    prisma.locale.findUnique.mockResolvedValue({
      code: 'ar',
      name: 'Arabic',
      nativeName: 'العربية',
      dir: 'rtl',
      isEnabled: true,
      order: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(service.assertEnabled('ar')).resolves.toBeUndefined();
  });

  it('rejects an unknown locale with 400', async () => {
    prisma.locale.findUnique.mockResolvedValue(null);
    await expect(service.assertEnabled('zz')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a disabled locale with 400', async () => {
    prisma.locale.findUnique.mockResolvedValue({
      code: 'fr',
      name: 'French',
      nativeName: 'Français',
      dir: 'ltr',
      isEnabled: false,
      order: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(service.assertEnabled('fr')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
