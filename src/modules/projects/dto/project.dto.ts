import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
  PartialType,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOCALE_PATTERN = /^[a-z]{2}$/;
const MARKDOWN_MAX = 256 * 1024;

export class ProjectTranslationDto {
  @ApiProperty({ example: 'en', description: 'Enabled two-letter locale.' })
  @Matches(LOCALE_PATTERN, {
    message: 'locale must be a two-letter lowercase code.',
  })
  readonly locale!: string;

  @ApiProperty({ example: 'Content platform API' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  readonly title!: string;

  @ApiProperty({ example: 'content-platform-api' })
  @IsString()
  @Matches(SLUG_PATTERN, { message: 'slug must be lowercase kebab-case.' })
  @MaxLength(200)
  readonly slug!: string;

  @ApiProperty({
    example: 'A multilingual content platform built for reliable publishing.',
    description: 'Opaque Markdown.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(MARKDOWN_MAX)
  readonly summary!: string;

  @ApiProperty({
    example: '## Overview\n\nThe platform…',
    description: 'Opaque Markdown.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(MARKDOWN_MAX)
  readonly overview!: string;

  @ApiProperty({
    example: '## Problem\n\nPublishing was fragmented.',
    description: 'Opaque Markdown.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(MARKDOWN_MAX)
  readonly businessProblem!: string;

  @ApiProperty({
    example: '## Solution\n\nA modular monolith.',
    description: 'Opaque Markdown.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(MARKDOWN_MAX)
  readonly solution!: string;

  @ApiProperty({
    example: '## Role\n\nBackend lead.',
    description: 'Opaque Markdown.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(MARKDOWN_MAX)
  readonly role!: string;

  @ApiProperty({
    example: '## Architecture\n\nNestJS and PostgreSQL.',
    description: 'Opaque Markdown.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(MARKDOWN_MAX)
  readonly architecture!: string;

  @ApiProperty({
    example: '## Challenges\n\nLocale-aware routing.',
    description: 'Opaque Markdown.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(MARKDOWN_MAX)
  readonly challenges!: string;

  @ApiProperty({
    example: '## Features\n\n- Publishing\n- RBAC',
    description: 'Opaque Markdown.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(MARKDOWN_MAX)
  readonly features!: string;

  @ApiProperty({
    example: '## Lessons\n\nKeep module seams explicit.',
    description: 'Opaque Markdown.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(MARKDOWN_MAX)
  readonly lessonsLearned!: string;

  @ApiPropertyOptional({ example: 'Content platform API case study' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  readonly metaTitle?: string;

  @ApiPropertyOptional({ example: 'How the multilingual platform was built.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly metaDescription?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    example: '0194f9a2-ef2a-7a31-8cb7-369c87f7933a',
  })
  @IsOptional()
  @IsUUID()
  readonly ogImageId?: string;

  @ApiPropertyOptional({
    format: 'uri',
    example: 'https://eslammuatamed.com/projects/content-platform-api',
  })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  readonly canonicalUrl?: string;
}

export class ProjectGalleryCaptionDto {
  @ApiPropertyOptional({
    nullable: true,
    example: 'Admin dashboard overview.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly caption?: string | null;
}

@ValidatorConstraint({ name: 'projectGalleryTranslationMap', async: false })
class ProjectGalleryTranslationMapConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false;
    }
    return Object.entries(value).every(([locale, translation]) => {
      if (!LOCALE_PATTERN.test(locale)) return false;
      if (
        typeof translation !== 'object' ||
        translation === null ||
        Array.isArray(translation)
      ) {
        return false;
      }
      const translationRecord = translation as Record<string, unknown>;
      const fields = Object.keys(translationRecord);
      if (fields.some((field) => field !== 'caption')) return false;
      const caption = translationRecord.caption;
      return (
        caption === undefined ||
        caption === null ||
        (typeof caption === 'string' && caption.length <= 500)
      );
    });
  }

  defaultMessage(): string {
    return 'translations must map lowercase locale codes to optional captions of at most 500 characters.';
  }
}

@ApiExtraModels(ProjectGalleryCaptionDto)
export class ProjectGalleryItemDto {
  @ApiProperty({
    format: 'uuid',
    example: '0194f9a2-ef2a-7a31-8cb7-369c87f7933a',
  })
  @IsUUID()
  readonly mediaAssetId!: string;

  @ApiProperty({ example: 0, minimum: 0 })
  @IsInt()
  @Min(0)
  readonly order!: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: { $ref: getSchemaPath(ProjectGalleryCaptionDto) },
    example: { en: { caption: 'Dashboard overview.' } },
  })
  @IsObject()
  @Validate(ProjectGalleryTranslationMapConstraint)
  readonly translations!: Record<string, ProjectGalleryCaptionDto>;
}

export class CreateProjectDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  readonly featured!: boolean;

  @ApiPropertyOptional({ default: false, example: false })
  @IsOptional()
  @IsBoolean()
  readonly isPublished?: boolean;

  @ApiProperty({ example: 0, minimum: 0 })
  @IsInt()
  @Min(0)
  readonly order!: number;

  @ApiPropertyOptional({
    nullable: true,
    format: 'uri',
    example: 'https://example.com',
  })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  readonly liveUrl?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    format: 'uri',
    example: 'https://github.com/eslammuatamed/example',
  })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  readonly repoUrl?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 2026, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  readonly year?: number | null;

  @ApiProperty({
    type: [ProjectTranslationDto],
    description: 'At least one complete project translation.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProjectTranslationDto)
  readonly translations!: ProjectTranslationDto[];

  @ApiProperty({
    type: [String],
    format: 'uuid',
    example: ['0194f9a2-ef2a-7a31-8cb7-369c87f7933a'],
    description: 'Skill ids; the project technology set is replaced on update.',
  })
  @IsArray()
  @IsUUID('all', { each: true })
  readonly technologyIds!: string[];

  @ApiProperty({
    type: [ProjectGalleryItemDto],
    description: 'Ordered gallery; the set is replaced on update.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectGalleryItemDto)
  readonly gallery!: ProjectGalleryItemDto[];
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
