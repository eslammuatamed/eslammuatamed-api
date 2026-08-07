import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { toOptionalBoolean } from '../../../common/dto/boolean-query';
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

/**
 * Orderable columns for the admin Projects list (D10-18).
 *
 * An ALLOWLIST, deliberately, not a passthrough to Prisma's `orderBy`. Accepting arbitrary column
 * names would make every column an accidental part of the published contract — un-versionable, and
 * impossible to change without risking a client that discovered it. These five are the ones the
 * Dashboard actually offers, and `featured` is among them because `featured desc, order asc` is the
 * established default: without it the operator could not reproduce the default ordering explicitly.
 */
export enum AdminProjectSortBy {
  Featured = 'featured',
  Order = 'order',
  Year = 'year',
  CreatedAt = 'createdAt',
  UpdatedAt = 'updatedAt',
}

export enum SortOrder {
  Asc = 'asc',
  Desc = 'desc',
}

/**
 * Admin Projects listing (D10-18): pagination, cross-translation free-text search, publication and
 * featured filters, and allowlisted sorting.
 *
 * NO `locale`. Admin reads return the full translation map (D10-6), and `forbidNonWhitelisted`
 * turns an unsolicited `?locale=` into a 422 — which is exactly the contract the Web `useApi`
 * helper encodes as `locale: false` on every admin call.
 */
export class AdminProjectListQueryDto extends PaginationQueryDto {
  // Matches across ALL of a project's translations, not the caller's locale — so an Arabic title
  // finds the project whose English record needs editing, from one list. A locale-scoped admin
  // search would silently hide half the collection from whichever language the dashboard is in.
  @ApiPropertyOptional({
    description:
      'Free-text search over localized title, slug and summary, across ALL translations (case-insensitive substring). Blank or whitespace-only is ignored rather than treated as a filter.',
    example: 'zidni',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  readonly q?: string;

  @ApiPropertyOptional({
    type: Boolean,
    example: true,
    description: 'Filter by publication state. Omit to return both states.',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  readonly isPublished?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    example: false,
    description: 'Filter by featured state. Omit to return both states.',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  readonly featured?: boolean;

  @ApiPropertyOptional({
    enum: AdminProjectSortBy,
    description:
      'Allowlisted sort column. Omit for the default `featured desc, order asc`.',
  })
  @IsOptional()
  @IsEnum(AdminProjectSortBy)
  readonly sortBy?: AdminProjectSortBy;

  @ApiPropertyOptional({
    enum: SortOrder,
    default: SortOrder.Asc,
    description: 'Direction for `sortBy`. Ignored when `sortBy` is absent.',
  })
  @IsOptional()
  @IsEnum(SortOrder)
  readonly sortOrder: SortOrder = SortOrder.Asc;
}
