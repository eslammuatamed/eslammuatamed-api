import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { SkillGroup } from '@prisma/client';
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
      'Stable, locale-independent public identity, used in `GET /projects?technology=`. Lowercase kebab-case.',
  })
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message:
      'slug must be lowercase kebab-case: ^[a-z0-9]+(-[a-z0-9]+)*$ (e.g. "tailwind-css").',
  })
  @MaxLength(60)
  readonly slug!: string;
  @ApiProperty({ enum: SkillGroup, example: SkillGroup.LANGUAGE })
  @IsEnum(SkillGroup)
  readonly group!: SkillGroup;
  @ApiProperty({ example: 1 }) @IsInt() @Min(0) readonly order!: number;
  @ApiPropertyOptional({ example: '#3178C6', nullable: true })
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
