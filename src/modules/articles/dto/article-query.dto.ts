import { ApiPropertyOptional } from '@nestjs/swagger';
import { ContentStatus } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

// Public article listing (D10-4/D10-6): pagination + locale + documented filters. Filters are
// matched in the requested locale (category/tag slugs are per-locale).
export class ArticleListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ default: 'en', example: 'ar' })
  @IsOptional()
  @Matches(/^[a-z]{2}$/, {
    message: 'locale must be a two-letter lowercase code.',
  })
  readonly locale: string = 'en';

  @ApiPropertyOptional({
    example: 'engineering',
    description: 'Category slug (in ?locale=).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  readonly category?: string;

  @ApiPropertyOptional({
    example: 'nestjs',
    description: 'Tag slug (in ?locale=).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  readonly tag?: string;

  @ApiPropertyOptional({
    example: 'monolith',
    description: 'Free-text match on title/excerpt.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  readonly q?: string;
}

// Admin listing: pagination + optional status filter (D10-2). No locale resolution — admin
// reads return the full translation map.
export class AdminArticleListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ContentStatus })
  @IsOptional()
  @IsEnum(ContentStatus)
  readonly status?: ContentStatus;
}
