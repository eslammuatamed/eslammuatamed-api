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

// Raised when the conditional claim matches no row: something revoked the presented token
// between our read and our write. Module-private — it never escapes rotateOrThrow, whose
// catch turns it back into the ordinary revoked-token response.
class RefreshTokenAlreadyClaimedError extends Error {}

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

  // Rotation (D19-2): a valid presented token is claimed and replaced within the same family
  // in one transaction. Presenting an already-revoked member is a theft signal — the whole
  // family is revoked, forcing re-login. The invariant is that one token can be claimed
  // successfully exactly once, however many requests present it at the same moment.
  async rotateOrThrow(presentedToken: string): Promise<RotatedRefreshToken> {
    const presented = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(presentedToken) },
    });

    if (!presented) {
      throw new UnauthorizedException('Invalid refresh token.');
    }
    if (presented.revokedAt) {
      await this.revokeFamily(presented.familyId);
      throw new UnauthorizedException('Refresh token has been revoked.');
    }
    if (presented.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token has expired.');
    }

    const successorToken = this.generateOpaqueToken();
    const successorExpiresAt = this.computeExpiry();

    try {
      await this.prisma.$transaction(async (tx) => {
        // WHY a conditional updateMany rather than update({ where: { id } }): the revokedAt
        // check above cannot enforce "claimed exactly once". Two requests presenting the same
        // token both read revokedAt = null before either writes, so both pass that check and
        // both mint a successor. Carrying `revokedAt: null` into the WHERE clause hands the
        // decision to PostgreSQL instead — under READ COMMITTED the losing UPDATE blocks on
        // the row, re-evaluates the predicate against the committed version once the winner
        // ends, and matches nothing. `count` is the verdict; our earlier read is not.
        const claim = await tx.refreshToken.updateMany({
          where: { id: presented.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        if (claim.count === 0) {
          throw new RefreshTokenAlreadyClaimedError();
        }

        // Same transaction as the claim, so a token is never left revoked without its
        // replacement: if this fails, the revocation rolls back with it and the operator
        // keeps a token that still works.
        await tx.refreshToken.create({
          data: {
            userId: presented.userId,
            familyId: presented.familyId,
            tokenHash: this.hash(successorToken),
            expiresAt: successorExpiresAt,
          },
        });
      });
    } catch (error) {
      if (!(error instanceof RefreshTokenAlreadyClaimedError)) {
        throw error;
      }
      // The claim transaction has already rolled back here, so this revocation is not undone
      // with it. Losing the claim is deliberately indistinguishable from replaying a stolen
      // token (D19-2): same family revocation, same response.
      await this.revokeFamily(presented.familyId);
      throw new UnauthorizedException('Refresh token has been revoked.');
    }

    return {
      token: successorToken,
      expiresAt: successorExpiresAt,
      userId: presented.userId,
    };
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
