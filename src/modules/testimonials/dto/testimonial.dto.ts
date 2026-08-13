import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
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

export class TestimonialTranslationDto {
  @ApiProperty({ example: 'en' })
  @Matches(/^[a-z]{2}$/)
  readonly locale!: string;
  @ApiProperty({ example: 'This team delivered beyond expectations.' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  readonly quote!: string;
  @ApiProperty({ example: 'Alex Morgan' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  readonly authorName!: string;
  @ApiProperty({ example: 'CTO, Acme' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  readonly authorRole!: string;
}

export class CreateTestimonialDto {
  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    example: '8b4d...',
  })
  @IsOptional()
  @IsUUID()
  readonly avatarId?: string | null;
  @ApiProperty({ example: 1 }) @IsInt() @Min(0) readonly order!: number;
  @ApiProperty({ example: true }) @IsBoolean() readonly isVisible!: boolean;
  @ApiProperty({
    type: [TestimonialTranslationDto],
    example: [
      {
        locale: 'en',
        quote: 'Excellent work.',
        authorName: 'Alex',
        authorRole: 'CTO',
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TestimonialTranslationDto)
  readonly translations!: TestimonialTranslationDto[];
}

export class UpdateTestimonialDto extends PartialType(CreateTestimonialDto) {}
