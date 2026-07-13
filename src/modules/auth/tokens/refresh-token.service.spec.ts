import { UnauthorizedException } from '@nestjs/common';
import { RefreshToken } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { AppConfigService } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { RefreshTokenService } from './refresh-token.service';

const config = {
  auth: { refreshTokenPepper: 'test-pepper-value', refreshTokenTtlDays: 7 },
} as AppConfigService;

function tokenRow(overrides: Partial<RefreshToken>): RefreshToken {
  return {
    id: 'rt-1',
    userId: 'user-1',
    tokenHash: 'hash',
    familyId: 'family-1',
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('RefreshTokenService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: RefreshTokenService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new RefreshTokenService(prisma, config);
  });

  describe('issueNewFamily', () => {
    it('persists a hashed token (never the raw value) and returns the raw token', async () => {
      const issued = await service.issueNewFamily('user-1');

      expect(issued.token).toEqual(expect.any(String));
      const createArg = prisma.refreshToken.create.mock.calls[0]?.[0];
      expect(createArg?.data.tokenHash).toBeDefined();
      expect(createArg?.data.tokenHash).not.toEqual(issued.token);
      expect(createArg?.data.userId).toBe('user-1');
    });
  });

  describe('rotateOrThrow', () => {
    it('throws 401 for an unknown token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.rotateOrThrow('nope')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rotates a valid token: revokes the old and issues a new one in the same family', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(tokenRow({}));
      prisma.$transaction.mockResolvedValue([]);

      const rotated = await service.rotateOrThrow('valid-token');

      expect(rotated.userId).toBe('user-1');
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: { revokedAt: expect.any(Date) },
      });
      const createArg = prisma.refreshToken.create.mock.calls[0]?.[0];
      expect(createArg?.data.familyId).toBe('family-1');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('detects reuse: presenting a revoked token revokes the whole family and throws 401', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(
        tokenRow({ revokedAt: new Date() }),
      );

      await expect(
        service.rotateOrThrow('stolen-token'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'family-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('throws 401 for an expired token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(
        tokenRow({ expiresAt: new Date(Date.now() - 1000) }),
      );
      await expect(service.rotateOrThrow('old-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('revokeByToken', () => {
    it('revokes the family on logout', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(tokenRow({}));
      await service.revokeByToken('valid-token');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'family-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('is a no-op for an unknown token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await service.revokeByToken('unknown');
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });
  });
});
