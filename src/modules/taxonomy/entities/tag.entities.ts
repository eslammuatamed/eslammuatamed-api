import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';

// Resolved single-locale tag for public reads (D10-6).
export class PublicTagEntity {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ example: 'NestJS' })
  readonly name!: string;

  @ApiProperty({ example: 'nestjs', description: 'Per-locale slug (D04-2).' })
  readonly slug!: string;

  @ApiProperty({ type: [String], example: ['en', 'ar'] })
  readonly availableLocales!: string[];
}

export class TagTranslationEntity {
  @ApiProperty({ example: 'NestJS' })
  readonly name!: string;

  @ApiProperty({ example: 'nestjs' })
  readonly slug!: string;
}

// @ApiExtraModels registers the map's value type so its $ref resolves in the exported document.
@ApiExtraModels(TagTranslationEntity)
export class AdminTagEntity {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { $ref: getSchemaPath(TagTranslationEntity) },
    description: 'Translation map keyed by locale code.',
  })
  readonly translations!: Record<string, TagTranslationEntity>;
}
