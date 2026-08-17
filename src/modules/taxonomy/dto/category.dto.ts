import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

// Slugs are lowercase kebab tokens, unique per locale (D04-2); the DB enforces uniqueness
// (a collision surfaces as a 422 via the Prisma P2002 mapping).
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CategoryTranslationDto {
  @ApiProperty({
    example: 'en',
    description: 'Two-letter locale; must be enabled.',
  })
  @Matches(/^[a-z]{2}$/, {
    message: 'locale must be a two-letter lowercase code.',
  })
  readonly locale!: string;

  @ApiProperty({ example: 'Engineering' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  readonly name!: string;

  @ApiProperty({ example: 'engineering' })
  @IsString()
  @Matches(SLUG_PATTERN, { message: 'slug must be lowercase kebab-case.' })
  @MaxLength(120)
  readonly slug!: string;

  // D10-25: nullable column, so `null` clears the description for this locale and an omitted key
  // leaves it as stored. The upsert passes the value straight to Prisma, where the two differ.
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Systems, architecture, and craft.',
    description: 'null clears it.',
  })
  @IsOptional()
  @ValidateIf((dto: CategoryTranslationDto) => dto.description !== null)
  @IsString()
  @MaxLength(500)
  readonly description?: string | null;
}

export class CreateCategoryDto {
  @ApiProperty({
    type: [CategoryTranslationDto],
    description: 'At least one locale translation.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CategoryTranslationDto)
  readonly translations!: CategoryTranslationDto[];
}

// PATCH: translations are upserted per locale (partial edit). Omitting `translations` leaves
// the category untouched.
export class UpdateCategoryDto {
  @ApiPropertyOptional({ type: [CategoryTranslationDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryTranslationDto)
  readonly translations?: CategoryTranslationDto[];
}
