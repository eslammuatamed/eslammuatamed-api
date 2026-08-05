import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches, MaxLength } from 'class-validator';
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

  // Accepts a Skill SLUG — the stable, locale-independent public identity that newly generated
  // filter URLs use (`/projects?technology=nestjs&page=2`).
  //
  // A Skill UUID is still accepted, and only for backward compatibility: the uuid form is the one
  // this endpoint has publicly documented until now, so links already in the wild must keep
  // resolving. New URLs must not be built from it.
  //
  // One pattern covers both because a uuid is itself lowercase kebab-shaped; the service decides
  // which column to match on. An unknown value is NOT a validation error — it yields an empty
  // page, so a retired technology degrades to "no results" rather than a 422.
  @ApiPropertyOptional({
    example: 'nestjs',
    pattern: '^[a-z0-9]+(-[a-z0-9]+)*$',
    description:
      'Filter to projects linked to this Skill, by slug. A Skill uuid is accepted for backward compatibility only. Unknown values return an empty page.',
  })
  @IsOptional()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message:
      'technology must be a lowercase kebab-case Skill slug (or a Skill uuid, deprecated).',
  })
  @MaxLength(60)
  readonly technology?: string;
}

export class AdminProjectListQueryDto extends PaginationQueryDto {}
