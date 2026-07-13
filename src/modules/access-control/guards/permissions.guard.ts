import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { WILDCARD_PERMISSION } from '../permissions';

// Dynamic permission enforcement (D19-8), registered globally after JwtAuthGuard so
// request.user is set. It resolves the authenticated user's grants from the database on every
// request — so a role edit or user deactivation takes effect immediately, never waiting out
// the access-token TTL. @Public() routes skip; a protected route without a declared permission
// fails closed.
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<string | undefined>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) {
      // A protected route must declare its permission (doc 19 §3). The doc-18 metadata test
      // catches this at build time; at runtime it is a 403, never an open door.
      throw new ForbiddenException('No permission is declared for this route.');
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const userId = request.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authentication is required.');
    }

    const grants = await this.resolveGrants(userId);
    if (grants === null) {
      // Token references a deleted or deactivated account — reject immediately (D19-8).
      throw new UnauthorizedException('Account is unavailable.');
    }
    if (grants.has(WILDCARD_PERMISSION) || grants.has(required)) {
      return true;
    }
    throw new ForbiddenException(`Missing permission '${required}'.`);
  }

  private async resolveGrants(userId: string): Promise<Set<string> | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        isActive: true,
        role: { select: { permissions: { select: { permission: true } } } },
      },
    });
    if (!user || !user.isActive) {
      return null;
    }
    return new Set(user.role.permissions.map((grant) => grant.permission));
  }
}
