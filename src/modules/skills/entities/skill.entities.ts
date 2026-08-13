import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { SkillGroup } from '../../../generated/prisma/client';

export class PublicSkillEntity {
  @ApiProperty({ format: 'uuid' }) readonly id!: string;
  // The stable public identity. This is what a client emits as `GET /projects?technology=`, which
  // is why the filter-option list has to carry it: without a slug here a client could only build
  // filter URLs from the id or the translated label, and both are the thing `slug` replaces.
  @ApiProperty({ example: 'typescript', pattern: '^[a-z0-9]+(-[a-z0-9]+)*$' })
  readonly slug!: string;
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
  @ApiProperty({ example: 'typescript', pattern: '^[a-z0-9]+(-[a-z0-9]+)*$' })
  readonly slug!: string;
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
