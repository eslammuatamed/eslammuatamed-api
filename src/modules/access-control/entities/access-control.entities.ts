import { ApiProperty } from '@nestjs/swagger';

// Read-only permission catalog (D10-9): the code-defined keys an operator can grant to roles.
export class PermissionCatalogEntity {
  @ApiProperty({
    type: [String],
    example: ['articles.read', 'articles.publish', 'settings.update'],
    description:
      'Every grantable permission key. The reserved "*" wildcard grants all of them.',
  })
  readonly permissions!: string[];
}

export class RoleEntity {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ example: 'Editor' })
  readonly name!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Can manage content but not settings or users.',
  })
  readonly description!: string | null;

  @ApiProperty({
    example: false,
    description: 'System roles (OWNER) cannot be edited or deleted.',
  })
  readonly isSystem!: boolean;

  @ApiProperty({
    type: [String],
    example: ['articles.read', 'articles.create', 'articles.publish'],
    description: 'Granted permission keys (or "*").',
  })
  readonly permissions!: string[];

  @ApiProperty({ format: 'date-time' })
  readonly createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  readonly updatedAt!: string;
}

// The role reference embedded in a user (name for display; authorization is server-side).
export class UserRoleRefEntity {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ example: 'Editor' })
  readonly name!: string;
}

export class UserEntity {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ format: 'email', example: 'editor@example.com' })
  readonly email!: string;

  @ApiProperty({ example: true })
  readonly isActive!: boolean;

  @ApiProperty({ type: UserRoleRefEntity })
  readonly role!: UserRoleRefEntity;

  @ApiProperty({ format: 'date-time' })
  readonly createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  readonly updatedAt!: string;
}
