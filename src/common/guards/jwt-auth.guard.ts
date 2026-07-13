import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

// The verified access-token claims (doc 19 §2, D19-8): subject id only. Kept local to common/
// so this guard never imports from modules/ (constitution rule 2). Authorization is resolved
// downstream by PermissionsGuard from the database, not from the token.
interface AccessTokenClaims {
  readonly sub: string;
}

// Global default-deny guard (doc 19 §3, D00-6). Current NestJS Security→Authentication docs
// teach a JwtService-based guard rather than a passport strategy: extract the Bearer token,
// verify it with JwtService.verifyAsync, and project its claims onto request.user. Routes
// marked @Public() skip verification. JwtModule is registered globally by AuthModule, so the
// injected JwtService carries the configured access-token secret.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const token = extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing access token.');
    }

    try {
      // Pin the accepted algorithm to HS256 (doc 19 §2): reject any other `alg` (incl. `none`
      // and asymmetric confusion) regardless of what the token header claims.
      const claims = await this.jwtService.verifyAsync<AccessTokenClaims>(
        token,
        {
          algorithms: ['HS256'],
        },
      );
      request.user = { id: claims.sub };
    } catch {
      // Bad signature, malformed, or expired token — all map to 401 (no leak of which).
      throw new UnauthorizedException('Invalid or expired access token.');
    }
    return true;
  }
}

function extractBearerToken(request: Request): string | undefined {
  const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
  return scheme === 'Bearer' ? token : undefined;
}
