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
  ValidateIf,
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

  // D10-23: the four SEO fields are nullable columns, and the SEO panel (FR-DSH-050) must be able
  // to EMPTY one it previously filled. `null` clears; an omitted key leaves the stored value alone
  // (`translationWriteFields` passes `undefined` straight to Prisma, which treats it as a no-op).
  // Both meanings are load-bearing, so both are in the contract.
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'null clears it.',
  })
  @IsOptional()
  @ValidateIf((dto: ArticleTranslationDto) => dto.metaTitle !== null)
  @IsString()
  @MaxLength(300)
  readonly metaTitle?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'null clears it.',
  })
  @IsOptional()
  @ValidateIf((dto: ArticleTranslationDto) => dto.metaDescription !== null)
  @IsString()
  @MaxLength(500)
  readonly metaDescription?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'OG image MediaAsset id; null clears it.',
  })
  @IsOptional()
  @ValidateIf((dto: ArticleTranslationDto) => dto.ogImageId !== null)
  @IsUUID()
  readonly ogImageId?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'uri',
    nullable: true,
    description: 'Canonical override; null clears it.',
  })
  @IsOptional()
  @ValidateIf((dto: ArticleTranslationDto) => dto.canonicalUrl !== null)
  @IsUrl({ require_protocol: true })
  readonly canonicalUrl?: string | null;
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

  // `null` is accepted and means "no publish instant", identical to omitting the key on create —
  // there is no prior value to preserve here, so the two coincide. The create path already read it
  // correctly (`dto.publishAt ? … : null`, a truthy test); only the contract failed to say so.
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Required and future when SCHEDULED; null means unscheduled.',
  })
  @IsOptional()
  @ValidateIf((dto: CreateArticleDto) => dto.publishAt !== null)
  @IsDateString()
  readonly publishAt?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Cover MediaAsset id; null for none.',
  })
  @IsOptional()
  @ValidateIf((dto: CreateArticleDto) => dto.coverImageId !== null)
  @IsUUID()
  readonly coverImageId?: string | null;

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

  // D10-23. Three meanings, and the service now honours all three: omit to keep the stored instant,
  // send `null` to UNSCHEDULE (clears the column, except on a direct PUBLISH which stamps now to
  // keep list ordering stable), send a date to set it. `nullable: true` is only correct here BECAUSE
  // the service was fixed — before that, `null` produced the Unix epoch, and declaring it nullable
  // would have documented that defect as intended behaviour.
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description:
      'null unschedules (clears it); omitted keeps the stored instant. Required and future when SCHEDULED.',
  })
  @IsOptional()
  @ValidateIf((dto: UpdateArticleDto) => dto.publishAt !== null)
  @IsDateString()
  readonly publishAt?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Cover MediaAsset id; null clears it.',
  })
  @IsOptional()
  @ValidateIf((dto: UpdateArticleDto) => dto.coverImageId !== null)
  @IsUUID()
  readonly coverImageId?: string | null;

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
