import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';

// Resolved single-locale category for public reads (D10-6).
export class PublicCategoryEntity {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ example: 'Engineering' })
  readonly name!: string;

  @ApiProperty({
    example: 'engineering',
    description: 'Per-locale slug (D04-2).',
  })
  readonly slug!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Systems, architecture, and craft.',
  })
  readonly description!: string | null;

  @ApiProperty({ type: [String], example: ['en', 'ar'] })
  readonly availableLocales!: string[];
}

export class CategoryTranslationEntity {
  @ApiProperty({ example: 'Engineering' })
  readonly name!: string;

  @ApiProperty({ example: 'engineering' })
  readonly slug!: string;

  @ApiProperty({ type: String, nullable: true })
  readonly description!: string | null;
}

// Admin full-map view (D10-6): every locale's translation for side-by-side editing.
// @ApiExtraModels registers the map's value type so its $ref resolves in the exported document.
@ApiExtraModels(CategoryTranslationEntity)
export class AdminCategoryEntity {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { $ref: getSchemaPath(CategoryTranslationEntity) },
    description: 'Translation map keyed by locale code.',
  })
  readonly translations!: Record<string, CategoryTranslationEntity>;
}
