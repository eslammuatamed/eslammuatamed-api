import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { AppConfigService } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';

export interface IssuedRefreshToken {
  readonly token: string;
  readonly expiresAt: Date;
}

export interface RotatedRefreshToken extends IssuedRefreshToken {
  readonly userId: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Opaque rotating refresh tokens with family-based reuse detection (doc 19 §2, D19-2). The
// raw 256-bit token is returned to the caller (delivered as an httpOnly cookie) and never
// stored — only its keyed SHA-256 hash lives in the database.
@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async issueNewFamily(userId: string): Promise<IssuedRefreshToken> {
    const familyId = randomUUID();
    const token = this.generateOpaqueToken();
    const expiresAt = this.computeExpiry();
    await this.prisma.refreshToken.create({
      data: { userId, familyId, tokenHash: this.hash(token), expiresAt },
    });
    return { token, expiresAt };
  }

  // Rotation (D19-2): a valid presented token is revoked and replaced within the same family
  // in one transaction. Presenting an already-revoked member is a theft signal — the whole
  // family is revoked, forcing re-login.
  async rotateOrThrow(presentedToken: string): Promise<RotatedRefreshToken> {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(presentedToken) },
    });

    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token.');
    }
    if (existing.revokedAt) {
      await this.revokeFamily(existing.familyId);
      throw new UnauthorizedException('Refresh token has been revoked.');
    }
    if (existing.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token has expired.');
    }

    const token = this.generateOpaqueToken();
    const expiresAt = this.computeExpiry();
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: existing.userId,
          familyId: existing.familyId,
          tokenHash: this.hash(token),
          expiresAt,
        },
      }),
    ]);

    return { token, expiresAt, userId: existing.userId };
  }

  // Logout revokes the whole family (doc 19 §2). Idempotent: an unknown token is a no-op.
  async revokeByToken(presentedToken: string): Promise<void> {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(presentedToken) },
    });
    if (existing) {
      await this.revokeFamily(existing.familyId);
    }
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private generateOpaqueToken(): string {
    return randomBytes(32).toString('base64url'); // 256-bit
  }

  // Keyed hash: HMAC-SHA256 with the server pepper as the key (doc 19 §2, §7). A database
  // dump alone cannot be reversed to usable tokens without the pepper (env-only secret).
  private hash(token: string): string {
    return createHmac('sha256', this.config.auth.refreshTokenPepper)
      .update(token)
      .digest('hex');
  }

  private computeExpiry(): Date {
    return new Date(
      Date.now() + this.config.auth.refreshTokenTtlDays * MS_PER_DAY,
    );
  }
}
