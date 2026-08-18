import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { GRANTABLE_PERMISSIONS } from '../permissions';

export class CreateRoleDto {
  @ApiProperty({ example: 'Editor' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  readonly name!: string;

  // D10-23: nullable column, so `null` is accepted and stores NULL. On create that coincides with
  // omitting the key; the contract states it so a strict-TS caller can pass either.
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Manages content; no settings or user access.',
    description: 'null for no description.',
  })
  @IsOptional()
  @ValidateIf((dto: CreateRoleDto) => dto.description !== null)
  @IsString()
  @MaxLength(200)
  readonly description?: string | null;

  // Each grant must be a catalog key or the reserved "*" (D19-8); an unknown key is a 422 at
  // the pipe, so no HTTP caller can store a permission that does not exist. This pipe is the
  // invariant's ONLY enforcement point: the service writes the array through unchecked and
  // RolePermission.permission is free text with no enum or CHECK — so a writer that bypasses this
  // DTO (prisma/seed.ts does) is unconstrained. See access-control/README.md.
  @ApiProperty({
    type: [String],
    example: ['articles.read', 'articles.create', 'articles.update'],
    description: 'Catalog keys or "*".',
  })
  @IsArray()
  @IsIn(GRANTABLE_PERMISSIONS, { each: true })
  readonly permissions!: string[];
}

// PATCH: name/description/permissions each optional; a provided permissions array replaces the
// grant set wholesale. System roles reject any update with 422 (enforced in the service).
export class UpdateRoleDto {
  @ApiPropertyOptional({ example: 'Senior Editor' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  readonly name?: string;

  // D10-23: `null` clears the description; an omitted key preserves it.
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'null clears it.',
  })
  @IsOptional()
  @ValidateIf((dto: UpdateRoleDto) => dto.description !== null)
  @IsString()
  @MaxLength(200)
  readonly description?: string | null;

  @ApiPropertyOptional({
    type: [String],
    example: ['articles.read', 'articles.update'],
  })
  @IsOptional()
  @IsArray()
  @IsIn(GRANTABLE_PERMISSIONS, { each: true })
  readonly permissions?: string[];
}
