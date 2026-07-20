import { BadRequestException } from '@nestjs/common';
import { SlugRedirect } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalesService } from '../locales/locales.service';
import { RedirectService } from './redirect.service';

const redirectRow = (overrides: Partial<SlugRedirect>): SlugRedirect => ({
  id: 'redirect-1',
  locale: 'en',
  entityType: 'article',
  fromSlug: 'a',
  toSlug: 'b',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('RedirectService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let locales: DeepMockProxy<LocalesService>;
  let service: RedirectService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    locales = mockDeep<LocalesService>();
    locales.assertEnabled.mockResolvedValue(undefined);
    service = new RedirectService(prisma, locales);
  });

  describe('resolve', () => {
    it('resolves a live redirect: /blog/a → { toPath: /blog/b } (one hop only)', async () => {
      prisma.slugRedirect.findUnique.mockResolvedValue(
        redirectRow({ entityType: 'article', fromSlug: 'a', toSlug: 'b' }),
      );

      const result = await service.resolve('en', '/blog/a');

      expect(result).toEqual({ toPath: '/blog/b' });
      expect(locales.assertEnabled).toHaveBeenCalledWith('en');
      expect(prisma.slugRedirect.findUnique).toHaveBeenCalledWith({
        where: {
          locale_entityType_fromSlug: {
            locale: 'en',
            entityType: 'article',
            fromSlug: 'a',
          },
        },
      });
      // One hop: exactly one lookup, never a transitive walk on the resolved slug.
      expect(prisma.slugRedirect.findUnique).toHaveBeenCalledTimes(1);
    });

    it('maps /projects/{slug} to entityType "project"', async () => {
      prisma.slugRedirect.findUnique.mockResolvedValue(
        redirectRow({ entityType: 'project', fromSlug: 'old', toSlug: 'new' }),
      );

      const result = await service.resolve('en', '/projects/old');

      expect(result).toEqual({ toPath: '/projects/new' });
      expect(prisma.slugRedirect.findUnique).toHaveBeenCalledWith({
        where: {
          locale_entityType_fromSlug: {
            locale: 'en',
            entityType: 'project',
            fromSlug: 'old',
          },
        },
      });
    });

    it('returns null on a miss (no record)', async () => {
      prisma.slugRedirect.findUnique.mockResolvedValue(null);

      const result = await service.resolve('en', '/blog/missing');

      expect(result).toBeNull();
    });

    it('returns null for an unknown section and issues no lookup', async () => {
      const result = await service.resolve('en', '/unknown/a');

      expect(result).toBeNull();
      expect(prisma.slugRedirect.findUnique).not.toHaveBeenCalled();
    });

    it('returns null for a malformed path and issues no lookup', async () => {
      const result = await service.resolve('en', '/blog');

      expect(result).toBeNull();
      expect(prisma.slugRedirect.findUnique).not.toHaveBeenCalled();
    });

    it('does not treat inherited object keys (e.g. constructor) as a known section', async () => {
      const result = await service.resolve('en', '/constructor/a');

      expect(result).toBeNull();
      expect(prisma.slugRedirect.findUnique).not.toHaveBeenCalled();
    });

    it('throws (→400) for a disabled/unknown locale and never queries', async () => {
      locales.assertEnabled.mockRejectedValue(
        new BadRequestException("Unknown or disabled locale 'zz'."),
      );

      await expect(service.resolve('zz', '/blog/a')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.slugRedirect.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('buildRedirectOps', () => {
    it('emits exactly the 3 ops in collapse → clear → record order with correct args', () => {
      prisma.slugRedirect.updateMany.mockReturnValue('op-collapse' as never);
      prisma.slugRedirect.deleteMany.mockReturnValue('op-clear' as never);
      prisma.slugRedirect.create.mockReturnValue('op-record' as never);

      const ops = service.buildRedirectOps({
        locale: 'en',
        entityType: 'article',
        oldSlug: 'a',
        newSlug: 'b',
      });

      // Exactly 3 ops; array order is the caller's $transaction order (collapse, clear, record).
      expect(ops).toEqual(['op-collapse', 'op-clear', 'op-record']);

      // 1. Collapse chains: repoint prior redirects that targeted the vacated old slug.
      expect(prisma.slugRedirect.updateMany).toHaveBeenCalledWith({
        where: { locale: 'en', entityType: 'article', toSlug: 'a' },
        data: { toSlug: 'b' },
      });
      // 2. Clear stale source: the new slug is now live, so drop any redirect from it.
      expect(prisma.slugRedirect.deleteMany).toHaveBeenCalledWith({
        where: { locale: 'en', entityType: 'article', fromSlug: 'b' },
      });
      // 3. Record the old→new redirect.
      expect(prisma.slugRedirect.create).toHaveBeenCalledWith({
        data: {
          locale: 'en',
          entityType: 'article',
          fromSlug: 'a',
          toSlug: 'b',
        },
      });
    });

    it('threads locale + entityType through for a project rename', () => {
      prisma.slugRedirect.updateMany.mockReturnValue('op-collapse' as never);
      prisma.slugRedirect.deleteMany.mockReturnValue('op-clear' as never);
      prisma.slugRedirect.create.mockReturnValue('op-record' as never);

      const ops = service.buildRedirectOps({
        locale: 'ar',
        entityType: 'project',
        oldSlug: 'x',
        newSlug: 'y',
      });

      expect(ops).toHaveLength(3);
      expect(prisma.slugRedirect.create).toHaveBeenCalledWith({
        data: {
          locale: 'ar',
          entityType: 'project',
          fromSlug: 'x',
          toSlug: 'y',
        },
      });
    });

    it('does not execute the ops (pure builder — no transaction is run)', () => {
      prisma.slugRedirect.updateMany.mockReturnValue('op-collapse' as never);
      prisma.slugRedirect.deleteMany.mockReturnValue('op-clear' as never);
      prisma.slugRedirect.create.mockReturnValue('op-record' as never);

      // void: the builder returns un-awaited PrismaPromises by design (the caller runs them
      // in its $transaction); we assert only that the builder itself never executes them.
      void service.buildRedirectOps({
        locale: 'en',
        entityType: 'article',
        oldSlug: 'a',
        newSlug: 'b',
      });

      // The builder returns PrismaPromises for the caller's $transaction; it never runs them.
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
