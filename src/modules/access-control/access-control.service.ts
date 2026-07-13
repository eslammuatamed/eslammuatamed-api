import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from '../auth/hashing/password.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import {
  PermissionCatalogEntity,
  RoleEntity,
  UserEntity,
} from './entities/access-control.entities';
import { PERMISSIONS } from './permissions';

type RoleWithPermissions = Prisma.RoleGetPayload<{
  include: { permissions: true };
}>;
type UserWithRole = Prisma.UserGetPayload<{ include: { role: true } }>;

@Injectable()
export class AccessControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  // The code-defined catalog (D10-9) — read-only over HTTP: a permission maps to a guarded
  // function, so it cannot be created via the API.
  getPermissionCatalog(): PermissionCatalogEntity {
    return { permissions: [...PERMISSIONS] };
  }

  async listRoles(): Promise<RoleEntity[]> {
    const roles = await this.prisma.role.findMany({
      include: { permissions: true },
      orderBy: { createdAt: 'asc' },
    });
    return roles.map(toRoleEntity);
  }

  async getRole(id: string): Promise<RoleEntity> {
    return toRoleEntity(await this.getRoleOrThrow(id));
  }

  async createRole(dto: CreateRoleDto): Promise<RoleEntity> {
    const permissions = dedupe(dto.permissions);
    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        isSystem: false,
        permissions: {
          create: permissions.map((permission) => ({ permission })),
        },
      },
      include: { permissions: true },
    });
    return toRoleEntity(role);
  }

  async updateRole(id: string, dto: UpdateRoleDto): Promise<RoleEntity> {
    const role = await this.getRoleOrThrow(id);
    // The OWNER system role (and any system role) is uneditable so a growing catalog can never
    // lock the operator out (D19-8).
    if (role.isSystem) {
      throw new UnprocessableEntityException('System roles cannot be edited.');
    }

    const operations: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.role.update({
        where: { id },
        data: { name: dto.name, description: dto.description },
      }),
    ];
    if (dto.permissions) {
      const permissions = dedupe(dto.permissions);
      operations.push(
        this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      );
      operations.push(
        this.prisma.rolePermission.createMany({
          data: permissions.map((permission) => ({ roleId: id, permission })),
        }),
      );
    }
    await this.prisma.$transaction(operations);
    return this.getRole(id);
  }

  async deleteRole(id: string): Promise<void> {
    const role = await this.getRoleOrThrow(id);
    if (role.isSystem) {
      throw new UnprocessableEntityException('System roles cannot be deleted.');
    }
    const assigned = await this.prisma.user.count({ where: { roleId: id } });
    if (assigned > 0) {
      throw new UnprocessableEntityException(
        'Role is still assigned to users; reassign them first.',
      );
    }
    await this.prisma.role.delete({ where: { id } });
  }

  async listUsers(): Promise<UserEntity[]> {
    const users = await this.prisma.user.findMany({
      include: { role: true },
      orderBy: { createdAt: 'asc' },
    });
    return users.map(toUserEntity);
  }

  async createUser(dto: CreateUserDto): Promise<UserEntity> {
    await this.assertRoleExists(dto.roleId);
    const passwordHash = await this.passwords.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        roleId: dto.roleId,
        isActive: dto.isActive ?? true,
      },
      include: { role: true },
    });
    return toUserEntity(user);
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    await this.getUserOrThrow(id);
    if (dto.roleId) {
      await this.assertRoleExists(dto.roleId);
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: { roleId: dto.roleId, isActive: dto.isActive },
      include: { role: true },
    });
    return toUserEntity(user);
  }

  private async getRoleOrThrow(id: string): Promise<RoleWithPermissions> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { permissions: true },
    });
    if (!role) {
      throw new NotFoundException('Role not found.');
    }
    return role;
  }

  private async getUserOrThrow(id: string): Promise<UserWithRole> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    return user;
  }

  private async assertRoleExists(roleId: string): Promise<void> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true },
    });
    if (!role) {
      throw new UnprocessableEntityException('Assigned role does not exist.');
    }
  }
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function toRoleEntity(role: RoleWithPermissions): RoleEntity {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissions: role.permissions.map((grant) => grant.permission).sort(),
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
  };
}

function toUserEntity(user: UserWithRole): UserEntity {
  return {
    id: user.id,
    email: user.email,
    isActive: user.isActive,
    role: { id: user.role.id, name: user.role.name },
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
