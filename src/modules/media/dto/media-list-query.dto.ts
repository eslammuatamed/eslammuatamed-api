import { ApiPropertyOptional } from '@nestjs/swagger';
import { MediaKind } from '../../../generated/prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

// Admin media grid query (doc 10 §5): offset pagination plus free-text search over the sanitized
// filename and alt text, and a `kind` filter. Ordering (newest first) is fixed in the service.
export class MediaListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Free-text search over sanitized filename and alt text.',
    example: 'desk',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  readonly q?: string;

  @ApiPropertyOptional({
    enum: MediaKind,
    description: 'Filter by asset kind.',
  })
  @IsOptional()
  @IsEnum(MediaKind)
  readonly kind?: MediaKind;
}
