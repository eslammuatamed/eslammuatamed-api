import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { EmploymentType } from '@prisma/client';

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
