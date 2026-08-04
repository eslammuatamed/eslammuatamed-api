import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { SkillGroup } from '@prisma/client';

export class PublicSkillEntity {
  @ApiProperty({ format: 'uuid' }) readonly id!: string;
  @ApiProperty({ example: 'TypeScript' }) readonly label!: string;
  @ApiProperty({ enum: SkillGroup }) readonly group!: SkillGroup;
  @ApiProperty({ example: 1 }) readonly order!: number;
  @ApiProperty({ type: String, nullable: true, example: '#3178C6' })
  readonly brandColor!: string | null;
  @ApiProperty({ type: [String], example: ['en', 'ar'] })
  readonly availableLocales!: string[];
}

export class SkillTranslationEntity {
  @ApiProperty({ example: 'TypeScript' }) readonly label!: string;
}

@ApiExtraModels(SkillTranslationEntity)
export class AdminSkillEntity {
  @ApiProperty({ format: 'uuid' }) readonly id!: string;
  @ApiProperty({ enum: SkillGroup }) readonly group!: SkillGroup;
  @ApiProperty({ example: 1 }) readonly order!: number;
  @ApiProperty({ type: String, nullable: true }) readonly brandColor!:
    string | null;
  @ApiProperty({
    description:
      'Whether the skill appears in public listings. Hidden skills keep their project and experience links.',
  })
  readonly isPublic!: boolean;
  @ApiProperty({
    type: 'object',
    additionalProperties: { $ref: getSchemaPath(SkillTranslationEntity) },
  })
  readonly translations!: Record<string, SkillTranslationEntity>;
}
