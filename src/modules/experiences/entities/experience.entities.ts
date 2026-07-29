import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { EmploymentType } from '@prisma/client';

// Same {id, label} shape as ProjectTechnologyEntity (D10-13) so one client component serves
// both surfaces. Declared here rather than imported to keep module independence; the exported
// OpenAPI schema is structurally identical.
export class ExperienceTechnologyEntity {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ example: 'Nuxt.js' })
  readonly label!: string;
}

export class PublicExperienceEntity {
  @ApiProperty({ format: 'uuid' }) readonly id!: string;
  @ApiProperty() readonly role!: string;
  @ApiProperty() readonly company!: string;
  @ApiProperty() readonly location!: string;
  @ApiProperty() readonly impact!: string;
  @ApiProperty({ enum: EmploymentType })
  readonly employmentType!: EmploymentType;
  @ApiProperty() readonly isCurrent!: boolean;
  @ApiProperty({ format: 'date-time' }) readonly startDate!: Date;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  readonly endDate!: Date | null;
  @ApiProperty({ example: 1 }) readonly order!: number;
  // Technologies from the Skill registry (FR-PUB-021). Labels resolve to the requested locale
  // with no cross-locale fallback; order derives from Skill.order (no join order column).
  @ApiProperty({ type: [ExperienceTechnologyEntity] })
  readonly technologies!: ExperienceTechnologyEntity[];

  @ApiProperty({ type: [String], example: ['en', 'ar'] })
  readonly availableLocales!: string[];
}

export class ExperienceTranslationEntity {
  @ApiProperty() readonly role!: string;
  @ApiProperty() readonly company!: string;
  @ApiProperty() readonly location!: string;
  @ApiProperty() readonly impact!: string;
}

@ApiExtraModels(ExperienceTranslationEntity)
export class AdminExperienceEntity {
  @ApiProperty({
    type: [String],
    description: 'Selected Skill ids; write via technologyIds.',
  })
  readonly technologyIds!: string[];

  @ApiProperty({ format: 'uuid' }) readonly id!: string;
  @ApiProperty({ format: 'date-time' }) readonly startDate!: Date;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  readonly endDate!: Date | null;
  @ApiProperty() readonly isCurrent!: boolean;
  @ApiProperty({ enum: EmploymentType })
  readonly employmentType!: EmploymentType;
  @ApiProperty() readonly order!: number;
  @ApiProperty({
    type: 'object',
    additionalProperties: { $ref: getSchemaPath(ExperienceTranslationEntity) },
  })
  readonly translations!: Record<string, ExperienceTranslationEntity>;
}
