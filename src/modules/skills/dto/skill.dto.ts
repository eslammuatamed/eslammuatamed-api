import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { SkillGroup } from '../../../generated/prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class SkillTranslationDto {
  @ApiProperty({ example: 'en' })
  @Matches(/^[a-z]{2}$/)
  readonly locale!: string;
  @ApiProperty({ example: 'TypeScript' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  readonly label!: string;
}

export class CreateSkillDto {
  @ApiProperty({
    example: 'typescript',
    pattern: '^[a-z0-9]+(-[a-z0-9]+)*$',
    description:
      'Stable, locale-independent public identity, used in `GET /projects?technology=`. Lowercase kebab-case, and MUST NOT be shaped like a uuid (8-4-4-4-12 lowercase hex) — that form is reserved for the legacy technology filter, so a uuid-shaped slug would be unreachable. The uuid exclusion cannot be expressed in `pattern`, so it is stated here: a value can satisfy `pattern` and still be rejected with 422.',
  })
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message:
      'slug must be lowercase kebab-case: ^[a-z0-9]+(-[a-z0-9]+)*$ (e.g. "tailwind-css").',
  })
  // A uuid-shaped slug is REJECTED, and this is load-bearing rather than fussy. `?technology=`
  // carries either a slug or a legacy Skill uuid, and the service tells them apart by shape — a
  // uuid satisfies the kebab-case rule above (lowercase hex groups joined by single hyphens), so
  // without this rule a slug could be minted that the filter would forever route to the id column
  // and answer with an empty page. This rule guards the API boundary, where skills are created;
  // it is NOT the only thing that prevents it. The column carries the same rule as a database
  // CHECK (`skills_slug_format_check`, in the 20260805110000_add_skill_slug migration), which also
  // covers the seed and raw SQL. Two layers on purpose — see that migration's own note on why.
  @Matches(/^(?![0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$)/, {
    message:
      'slug must not be shaped like a uuid — that form is reserved for the legacy technology filter.',
  })
  @MaxLength(60)
  readonly slug!: string;
  @ApiProperty({ enum: SkillGroup, example: SkillGroup.LANGUAGE })
  @IsEnum(SkillGroup)
  readonly group!: SkillGroup;
  @ApiProperty({ example: 1 }) @IsInt() @Min(0) readonly order!: number;
  @ApiPropertyOptional({ type: String, example: '#3178C6', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  readonly brandColor?: string | null;
  @ApiPropertyOptional({
    default: true,
    description:
      'Whether the skill appears in public listings. Hidden skills stay linked to their projects and experiences.',
  })
  @IsOptional()
  @IsBoolean()
  readonly isPublic?: boolean;
  @ApiProperty({
    type: [SkillTranslationDto],
    example: [{ locale: 'en', label: 'TypeScript' }],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SkillTranslationDto)
  readonly translations!: SkillTranslationDto[];
}

// `slug` is deliberately NOT updatable. It is the public identity behind
// `/projects?technology=<slug>`, so editing it silently breaks every shared and indexed filter URL
// that already points at the skill. Labels are the editable, presentational half; re-slugging is a
// governed content decision that belongs in a migration with the redirects it implies, not in a
// routine admin edit. Omitted rather than ignored, so an attempt fails loudly under the global
// `forbidNonWhitelisted` validation instead of appearing to succeed.
export class UpdateSkillDto extends PartialType(
  OmitType(CreateSkillDto, ['slug'] as const),
) {}

export class SkillQueryDto {
  @ApiPropertyOptional({ default: 'en', example: 'ar' })
  @IsOptional()
  @Matches(/^[a-z]{2}$/)
  readonly locale: string = 'en';
}

// Admin reads return full translation maps and never accept `locale`; the optional group filter
// and inherited pagination fields are the complete collection query surface for this endpoint.
export class AdminSkillListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: SkillGroup, example: SkillGroup.FRONTEND })
  @IsOptional()
  @IsEnum(SkillGroup)
  readonly group?: SkillGroup;
}
