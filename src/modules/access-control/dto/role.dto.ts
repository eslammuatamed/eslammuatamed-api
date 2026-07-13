import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { GRANTABLE_PERMISSIONS } from '../permissions';

export class CreateRoleDto {
  @ApiProperty({ example: 'Editor' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  readonly name!: string;

  @ApiPropertyOptional({
    example: 'Manages content; no settings or user access.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  readonly description?: string;

  // Each grant must be a catalog key or the reserved "*" (D19-8); an unknown key is a 422 at
  // the pipe, so the guarded surface can never reference a permission that does not exist.
  @ApiProperty({
    type: [String],
    example: ['articles.read', 'articles.create', 'articles.publish'],
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  readonly description?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['articles.read', 'articles.update'],
  })
  @IsOptional()
  @IsArray()
  @IsIn(GRANTABLE_PERMISSIONS, { each: true })
  readonly permissions?: string[];
}
