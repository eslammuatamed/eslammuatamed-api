import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContentStatus } from '../../../generated/prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Opaque Markdown, length-capped at 256 KiB per doc 19 §5 (no parsing here — D01-5).
const BODY_MAX = 256 * 1024;

export class ArticleTranslationDto {
  @ApiProperty({
    example: 'en',
    description: 'Two-letter locale; must be enabled.',
  })
  @Matches(/^[a-z]{2}$/, {
    message: 'locale must be a two-letter lowercase code.',
  })
  readonly locale!: string;

  @ApiProperty({ example: 'Designing a modular monolith' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  readonly title!: string;

  @ApiProperty({ example: 'designing-a-modular-monolith' })
  @IsString()
  @Matches(SLUG_PATTERN, { message: 'slug must be lowercase kebab-case.' })
  @MaxLength(200)
  readonly slug!: string;

  @ApiProperty({
    example:
      'Why one deployable with hard module seams beats microservices here.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  readonly excerpt!: string;

  @ApiProperty({
    example: '# Heading\n\nOpaque Markdown…',
    description: 'Opaque Markdown (D01-5).',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(BODY_MAX)
  readonly body!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  readonly metaTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly metaDescription?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readonly ogImageId?: string;

  @ApiPropertyOptional({ format: 'uri' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  readonly canonicalUrl?: string;
}

export class CreateArticleDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Required category (FR-CNT-050).',
  })
  @IsUUID()
  readonly categoryId!: string;

  @ApiPropertyOptional({ enum: ContentStatus, default: ContentStatus.DRAFT })
  @IsOptional()
  @IsEnum(ContentStatus)
  readonly status?: ContentStatus;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Required and future when SCHEDULED.',
  })
  @IsOptional()
  @IsDateString()
  readonly publishAt?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Cover MediaAsset id.' })
  @IsOptional()
  @IsUUID()
  readonly coverImageId?: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Tag ids (optional).',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  readonly tagIds?: string[];

  @ApiProperty({
    type: [ArticleTranslationDto],
    description: 'At least one locale translation.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ArticleTranslationDto)
  readonly translations!: ArticleTranslationDto[];
}

// PATCH (D10-2): every field optional. Provided translations are upserted per locale; a
// provided `tagIds` replaces the tag set wholesale.
export class UpdateArticleDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readonly categoryId?: string;

  @ApiPropertyOptional({ enum: ContentStatus })
  @IsOptional()
  @IsEnum(ContentStatus)
  readonly status?: ContentStatus;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  readonly publishAt?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readonly coverImageId?: string;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  readonly tagIds?: string[];

  @ApiPropertyOptional({ type: [ArticleTranslationDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ArticleTranslationDto)
  readonly translations?: ArticleTranslationDto[];
}
