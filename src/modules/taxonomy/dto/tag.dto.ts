import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class TagTranslationDto {
  @ApiProperty({
    example: 'en',
    description: 'Two-letter locale; must be enabled.',
  })
  @Matches(/^[a-z]{2}$/, {
    message: 'locale must be a two-letter lowercase code.',
  })
  readonly locale!: string;

  @ApiProperty({ example: 'NestJS' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  readonly name!: string;

  @ApiProperty({ example: 'nestjs' })
  @IsString()
  @Matches(SLUG_PATTERN, { message: 'slug must be lowercase kebab-case.' })
  @MaxLength(80)
  readonly slug!: string;
}

export class CreateTagDto {
  @ApiProperty({
    type: [TagTranslationDto],
    description: 'At least one locale translation.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TagTranslationDto)
  readonly translations!: TagTranslationDto[];
}

export class UpdateTagDto {
  @ApiPropertyOptional({ type: [TagTranslationDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TagTranslationDto)
  readonly translations?: TagTranslationDto[];
}

// Admin reads return full translation maps and never accept `locale`; pagination is the only
// collection query surface for this endpoint.
export class AdminTagListQueryDto extends PaginationQueryDto {}
