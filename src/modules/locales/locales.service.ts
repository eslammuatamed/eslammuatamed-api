import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LocaleEntity } from './entities/locale.entity';

@Injectable()
export class LocalesService {
  constructor(private readonly prisma: PrismaService) {}

  async listEnabled(): Promise<LocaleEntity[]> {
    const locales = await this.prisma.locale.findMany({
      where: { isEnabled: true },
      orderBy: { order: 'asc' },
    });
    return locales.map((locale) => ({
      code: locale.code,
      name: locale.name,
      nativeName: locale.nativeName,
      dir: locale.dir,
    }));
  }

  // Guards the ?locale= parameter for public reads (D10-6). An unknown or disabled locale is
  // a 400 — never a silent fallback to another locale.
  async assertEnabled(code: string): Promise<void> {
    const locale = await this.prisma.locale.findUnique({ where: { code } });
    if (!locale || !locale.isEnabled) {
      throw new BadRequestException(`Unknown or disabled locale '${code}'.`);
    }
  }
}
