import { UnauthorizedException } from '@nestjs/common';
import { RefreshToken } from '../../../generated/prisma/client';
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
  let tx: DeepMockProxy<PrismaService>;
  let service: RefreshTokenService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    // A distinct client for the interactive transaction, so a test can tell a write issued
    // inside the transaction (rolled back on failure) from one committed on its own.
    tx = mockDeep<PrismaService>();
    (prisma.$transaction as unknown as jest.Mock).mockImplementation(
      (run: (client: PrismaService) => Promise<unknown>) => run(tx),
    );
    tx.refreshToken.updateMany.mockResolvedValue({ count: 1 });
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

    it('claims the presented token conditionally and issues exactly one successor', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(tokenRow({}));

      const rotated = await service.rotateOrThrow('valid-token');

      expect(rotated.userId).toBe('user-1');
      // `revokedAt: null` in the WHERE is the whole guarantee: without it two concurrent
      // presentations both match by id and both mint a successor.
      expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'rt-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(tx.refreshToken.create).toHaveBeenCalledTimes(1);
      const createArg = tx.refreshToken.create.mock.calls[0]?.[0];
      expect(createArg?.data.familyId).toBe('family-1');
      expect(createArg?.data.tokenHash).not.toEqual(rotated.token);
      // Claim and successor share one transaction; neither is committed on its own.
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('treats a claim that matches no row as reuse: no successor, family revoked, 401', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(tokenRow({}));
      tx.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      // Byte-identical to the replayed-revoked-token response: losing the race must not be
      // distinguishable from theft.
      await expect(service.rotateOrThrow('raced-token')).rejects.toThrow(
        new UnauthorizedException('Refresh token has been revoked.'),
      );
      expect(tx.refreshToken.create).not.toHaveBeenCalled();
      // Family revocation runs on the client, after the claim transaction rolled back —
      // never inside it, which would roll the revocation back too.
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'family-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('rolls the claim back and revokes nothing when the successor cannot be created', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(tokenRow({}));
      tx.refreshToken.create.mockRejectedValue(new Error('connection lost'));

      const failure: unknown = await service
        .rotateOrThrow('valid-token')
        .catch((error: unknown) => error);

      // Not converted to a 401: the operator keeps a token that still works rather than
      // being logged out with no replacement, and no family is revoked over an
      // infrastructure failure.
      expect(failure).not.toBeInstanceOf(UnauthorizedException);
      expect(failure).toEqual(new Error('connection lost'));
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
      // The claim was issued on the transaction client, so Prisma discards it with the
      // failed transaction. That rollback is proven for real in refresh-token-rotation.e2e-spec.
      expect(tx.refreshToken.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.refreshToken.update).not.toHaveBeenCalled();
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
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.refreshToken.create).not.toHaveBeenCalled();
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
