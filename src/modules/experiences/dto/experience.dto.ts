import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { EmploymentType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ExperienceTranslationDto {
  @ApiProperty({ example: 'en' })
  @Matches(/^[a-z]{2}$/)
  readonly locale!: string;
  @ApiProperty({ example: 'Senior Software Engineer' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  readonly role!: string;
  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  readonly company!: string;
  @ApiProperty({ example: 'Cairo, Egypt' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  readonly location!: string;
  @ApiProperty({ example: '- Reduced deployment time by 60%.' })
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  readonly impact!: string;
}

export class CreateExperienceDto {
  @ApiProperty({ example: '2022-01-01', format: 'date' })
  @IsDateString()
  readonly startDate!: string;
  @ApiPropertyOptional({
    example: '2024-06-30',
    format: 'date',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  readonly endDate?: string | null;
  @ApiProperty({ example: true }) @IsBoolean() readonly isCurrent!: boolean;
  @ApiProperty({ enum: EmploymentType, example: EmploymentType.FULL_TIME })
  @IsEnum(EmploymentType)
  readonly employmentType!: EmploymentType;
  @ApiProperty({ example: 1 }) @IsInt() @Min(0) readonly order!: number;
  @ApiProperty({
    type: [ExperienceTranslationDto],
    example: [
      {
        locale: 'en',
        role: 'Engineer',
        company: 'Acme',
        location: 'Remote',
        impact: 'Improved reliability.',
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExperienceTranslationDto)
  readonly translations!: ExperienceTranslationDto[];

  // Technologies come from the Skill registry (D02-9) — ids only, never free-text labels.
  // Duplicates are rejected rather than silently de-duplicated so a mistaken payload is visible.
  @ApiPropertyOptional({
    type: [String],
    description: 'Skill ids; replaces the full set. Empty array clears.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  readonly technologyIds?: string[];
}

export class UpdateExperienceDto extends PartialType(CreateExperienceDto) {}

export class ExperienceQueryDto {
  @ApiPropertyOptional({ default: 'en', example: 'ar' })
  @IsOptional()
  @Matches(/^[a-z]{2}$/)
  readonly locale: string = 'en';
}
