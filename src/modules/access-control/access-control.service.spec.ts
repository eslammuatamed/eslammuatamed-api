import { UnprocessableEntityException } from '@nestjs/common';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from '../auth/hashing/password.service';
import { AccessControlService } from './access-control.service';

function roleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    name: 'Editor',
    description: null,
    isSystem: false,
    permissions: [{ permission: 'articles.read' }],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AccessControlService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let passwords: DeepMockProxy<PasswordService>;
  let service: AccessControlService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    passwords = mockDeep<PasswordService>();
    service = new AccessControlService(prisma, passwords);
  });

  it('exposes the code-defined permission catalog', () => {
    const catalog = service.getPermissionCatalog();
    expect(catalog.permissions).toContain('articles.update');
    expect(catalog.permissions).toContain('roles.create');
    expect(catalog.permissions).not.toContain('*');
  });

  // D09-7: the catalog must not offer a capability no route enforces. Publishing rides on
  // articles.update, so a separate articles.publish would confer nothing while implying a
  // draft/publish separation the API does not have.
  it('does not offer capabilities that authorize no route', () => {
    const catalog = service.getPermissionCatalog();

    expect(catalog.permissions).not.toContain('articles.publish');
    expect(catalog.permissions).not.toContain('messages.delete');
    expect(catalog.permissions).not.toContain('users.delete');
    expect(catalog.permissions).not.toContain('redirects.create');
    // `seo.read` was listed here until the static-page SEO routes shipped (FR-DSH-051, D10-24) —
    // correctly, because until then it authorized nothing. It moves to the positive assertion below
    // rather than simply being deleted, so the pair records that the reason changed.
    expect(catalog.permissions).not.toContain('seo.create');
    expect(catalog.permissions).not.toContain('seo.delete');
  });

  // The other half of D09-7: a capability whose route DOES exist must be offered, or the operator
  // cannot grant it and the guard on that route is unreachable by any custom role.
  it('offers the static-page SEO capabilities now that routes enforce them', () => {
    const catalog = service.getPermissionCatalog();

    expect(catalog.permissions).toContain('seo.read');
    expect(catalog.permissions).toContain('seo.update');
  });

  it('creates a role with de-duplicated grants', async () => {
    prisma.role.create.mockResolvedValue(roleRow());

    await service.createRole({
      name: 'Editor',
      permissions: ['articles.read', 'articles.read', 'articles.create'],
    });

    const createArg = prisma.role.create.mock.calls[0]?.[0];
    const created = createArg?.data.permissions?.create as {
      permission: string;
    }[];
    expect(created.map((g) => g.permission)).toEqual([
      'articles.read',
      'articles.create',
    ]);
  });

  it('rejects editing a system role with 422', async () => {
    prisma.role.findUnique.mockResolvedValue(roleRow({ isSystem: true }));
    await expect(
      service.updateRole('r1', { name: 'Hacked' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects deleting a system role with 422', async () => {
    prisma.role.findUnique.mockResolvedValue(roleRow({ isSystem: true }));
    await expect(service.deleteRole('r1')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(prisma.role.delete).not.toHaveBeenCalled();
  });

  it('rejects deleting a role still assigned to users with 422', async () => {
    prisma.role.findUnique.mockResolvedValue(roleRow());
    prisma.user.count.mockResolvedValue(2);
    await expect(service.deleteRole('r1')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(prisma.role.delete).not.toHaveBeenCalled();
  });

  it('deletes an unassigned custom role', async () => {
    prisma.role.findUnique.mockResolvedValue(roleRow());
    prisma.user.count.mockResolvedValue(0);
    await service.deleteRole('r1');
    expect(prisma.role.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
  });

  it('hashes the password and requires an existing role when creating a user', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'r1' } as never);
    passwords.hash.mockResolvedValue('argon2-hash');
    prisma.user.create.mockResolvedValue({
      id: 'u1',
      email: 'e@x.com',
      isActive: true,
      role: { id: 'r1', name: 'Editor' },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    await service.createUser({
      email: 'e@x.com',
      password: 'change-me-minimum-12',
      roleId: 'r1',
    });

    expect(passwords.hash).toHaveBeenCalledWith('change-me-minimum-12');
    const arg = prisma.user.create.mock.calls[0]?.[0];
    expect(arg?.data.passwordHash).toBe('argon2-hash');
  });

  it('rejects creating a user with an unknown role (422)', async () => {
    prisma.role.findUnique.mockResolvedValue(null);
    await expect(
      service.createUser({
        email: 'e@x.com',
        password: 'change-me-minimum-12',
        roleId: 'missing',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
