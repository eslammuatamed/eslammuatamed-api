import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { PermissionsGuard } from './permissions.guard';

interface Meta {
  isPublic?: boolean;
  required?: string;
}

function context(user?: { id: string }): ExecutionContext {
  return {
    getHandler: () => (): void => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let reflector: DeepMockProxy<Reflector>;
  let guard: PermissionsGuard;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    reflector = mockDeep<Reflector>();
    guard = new PermissionsGuard(reflector, prisma);
  });

  const meta = ({ isPublic = false, required }: Meta): void => {
    reflector.getAllAndOverride.mockImplementation((key: unknown) => {
      if (key === IS_PUBLIC_KEY) return isPublic;
      if (key === REQUIRE_PERMISSION_KEY) return required;
      return undefined;
    });
  };

  const withGrants = (permissions: string[], isActive = true): void => {
    prisma.user.findUnique.mockResolvedValue({
      isActive,
      role: { permissions: permissions.map((permission) => ({ permission })) },
    } as never);
  };

  it('allows a @Public() route without touching the database', async () => {
    meta({ isPublic: true });
    await expect(guard.canActivate(context({ id: 'u1' }))).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('fails closed when a protected route declares no permission', async () => {
    meta({ required: undefined });
    await expect(
      guard.canActivate(context({ id: 'u1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('401s when there is no authenticated user', async () => {
    meta({ required: 'articles.read' });
    await expect(guard.canActivate(context(undefined))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('allows when the role holds the exact grant', async () => {
    meta({ required: 'articles.read' });
    withGrants(['articles.read', 'articles.create']);
    await expect(guard.canActivate(context({ id: 'u1' }))).resolves.toBe(true);
  });

  it('denies when the grant is missing', async () => {
    meta({ required: 'articles.delete' });
    withGrants(['articles.read']);
    await expect(
      guard.canActivate(context({ id: 'u1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows anything for the reserved "*" wildcard grant', async () => {
    meta({ required: 'settings.update' });
    withGrants(['*']);
    await expect(guard.canActivate(context({ id: 'u1' }))).resolves.toBe(true);
  });

  it('401s a deactivated account even with a valid token', async () => {
    meta({ required: 'articles.read' });
    withGrants(['*'], false);
    await expect(
      guard.canActivate(context({ id: 'u1' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('401s when the token references a deleted account', async () => {
    meta({ required: 'articles.read' });
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      guard.canActivate(context({ id: 'gone' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('reflects a grant change on the very next request (resolved per request)', async () => {
    meta({ required: 'articles.read' });

    withGrants(['articles.read']);
    await expect(guard.canActivate(context({ id: 'u1' }))).resolves.toBe(true);

    // The operator revokes the grant; the next request is denied without any re-login.
    withGrants(['articles.create']);
    await expect(
      guard.canActivate(context({ id: 'u1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
