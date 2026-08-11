import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { toOptionalBoolean } from '../../../common/dto/boolean-query';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

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
