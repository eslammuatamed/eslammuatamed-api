import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { SkillGroup } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
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
  @ApiProperty({ enum: SkillGroup, example: SkillGroup.LANGUAGE })
  @IsEnum(SkillGroup)
  readonly group!: SkillGroup;
  @ApiProperty({ example: 1 }) @IsInt() @Min(0) readonly order!: number;
  @ApiPropertyOptional({ example: '#3178C6', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  readonly brandColor?: string | null;
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

export class UpdateSkillDto extends PartialType(CreateSkillDto) {}

export class SkillQueryDto {
  @ApiPropertyOptional({ default: 'en', example: 'ar' })
  @IsOptional()
  @Matches(/^[a-z]{2}$/)
  readonly locale: string = 'en';
}
