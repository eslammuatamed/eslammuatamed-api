import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

// Query strings arrive as strings; coerce the two documented boolean tokens and leave anything else
// untouched so `@IsBoolean` rejects it with a 422 (rather than silently treating garbage as false).
function toOptionalBoolean(value: unknown): unknown {
  if (value === 'true' || value === true) {
    return true;
  }
  if (value === 'false' || value === false) {
    return false;
  }
  return value;
}

// Admin inbox listing (FR-DSH-060): offset pagination (inherited) plus optional read/archived
// filters. No locale resolution — messages are locale-agnostic.
export class MessageListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    type: Boolean,
    example: false,
    description: 'Filter by read state.',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  readonly isRead?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    example: false,
    description: 'Filter by archived state.',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  readonly isArchived?: boolean;
}
