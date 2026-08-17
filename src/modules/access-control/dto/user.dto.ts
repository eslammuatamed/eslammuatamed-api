import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ format: 'email', example: 'editor@example.com' })
  @IsEmail()
  readonly email!: string;

  // NIST 800-63 stance (doc 19 §2): minimum length only, no composition rules.
  @ApiProperty({ minLength: 12, example: 'change-me-minimum-12-chars' })
  @IsString()
  @MinLength(12)
  readonly password!: string;

  @ApiProperty({ format: 'uuid', description: 'Assigned role id.' })
  @IsUUID()
  readonly roleId!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  readonly isActive?: boolean;
}

// PATCH: role assignment and activation (doc 10 §5). Password changes are out of scope for this
// DTO — no password-change or reset endpoint exists.
export class UpdateUserDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readonly roleId?: string;

  @ApiPropertyOptional({
    description: 'Deactivating blocks login and denies all grants at once.',
  })
  @IsOptional()
  @IsBoolean()
  readonly isActive?: boolean;
}
