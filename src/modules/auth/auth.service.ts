import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { AuthUserEntity } from './entities/auth.entities';
import { PasswordService } from './hashing/password.service';
import type { AccessTokenPayload } from './tokens/access-token.payload';
import { RefreshTokenService } from './tokens/refresh-token.service';

type UserWithRole = Prisma.UserGetPayload<{ include: { role: true } }>;

export interface AuthSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly refreshExpiresAt: Date;
  readonly user: AuthUserEntity;
}

export interface RefreshedSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly refreshExpiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string): Promise<AuthSession> {
    const user = await this.users.findByEmail(email);
    // Identical failure for unknown email and wrong password — no user enumeration (doc 19 §1).
    if (!user || !(await this.passwords.verify(user.passwordHash, password))) {
      throw new UnauthorizedException('Invalid credentials.');
    }
    // A deactivated account cannot obtain a session (doc 10 §5); permissions are also denied
    // per request by PermissionsGuard, so deactivation takes effect immediately either way.
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated.');
    }

    const issued = await this.refreshTokens.issueNewFamily(user.id);
    return {
      accessToken: await this.signAccessToken(user),
      refreshToken: issued.token,
      refreshExpiresAt: issued.expiresAt,
      user: toAuthUser(user),
    };
  }

  async refresh(presentedToken: string | undefined): Promise<RefreshedSession> {
    if (!presentedToken) {
      throw new UnauthorizedException('Missing refresh token.');
    }
    const rotated = await this.refreshTokens.rotateOrThrow(presentedToken);
    const user = await this.users.findById(rotated.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid refresh token.');
    }
    return {
      accessToken: await this.signAccessToken(user),
      refreshToken: rotated.token,
      refreshExpiresAt: rotated.expiresAt,
    };
  }

  async logout(presentedToken: string | undefined): Promise<void> {
    if (presentedToken) {
      await this.refreshTokens.revokeByToken(presentedToken);
    }
  }

  // Current @nestjs/jwt guidance (docs.nestjs.com Security → Authentication) is async signing
  // (signAsync), not the blocking jwt.sign (D00-6 principle 16). The token carries only `sub`
  // (D19-8); authorization is resolved per request by PermissionsGuard.
  private signAccessToken(user: Pick<User, 'id'>): Promise<string> {
    const payload: AccessTokenPayload = { sub: user.id };
    return this.jwt.signAsync(payload);
  }
}

function toAuthUser(user: UserWithRole): AuthUserEntity {
  return {
    id: user.id,
    email: user.email,
    role: { id: user.role.id, name: user.role.name },
  };
}
