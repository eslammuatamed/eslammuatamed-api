import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, Matches } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ProjectListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    default: 'en',
    example: 'ar',
    description: 'Two-letter locale code, validated against enabled locales.',
  })
  @IsOptional()
  @Matches(/^[a-z]{2}$/, {
    message: 'locale must be a two-letter lowercase code.',
  })
  readonly locale: string = 'en';

  @ApiPropertyOptional({
    format: 'uuid',
    example: '0194f9a2-ef2a-7a31-8cb7-369c87f7933a',
    description: 'Filter to projects linked to this Skill id.',
  })
  @IsOptional()
  @IsUUID()
  readonly technology?: string;
}

export class AdminProjectListQueryDto extends PaginationQueryDto {}
