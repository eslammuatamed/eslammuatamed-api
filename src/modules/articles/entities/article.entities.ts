import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { ContentStatus } from '@prisma/client';

// Resolved category/tag reference embedded in a public article (single locale).
export class ArticleTaxonomyRefEntity {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ example: 'Engineering' })
  readonly name!: string;

  @ApiProperty({ example: 'engineering' })
  readonly slug!: string;
}

// Resolved list item for public reads (D10-6) — no body, kept light for listing. Nullable
// fields declare `type: String` so the `string | null` union does not reflect as `type: object`.
export class PublicArticleListItemEntity {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ example: 'Designing a modular monolith' })
  readonly title!: string;

  @ApiProperty({ example: 'designing-a-modular-monolith' })
  readonly slug!: string;

  @ApiProperty({
    example:
      'Why one deployable with hard module seams beats microservices here.',
  })
  readonly excerpt!: string;

  @ApiProperty({ example: 7, description: 'Computed reading time in minutes.' })
  readonly readingTimeMin!: number;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  readonly publishAt!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    format: 'uuid',
    description: 'Cover MediaAsset id.',
  })
  readonly coverImageId!: string | null;

  @ApiProperty({ type: ArticleTaxonomyRefEntity })
  readonly category!: ArticleTaxonomyRefEntity;

  @ApiProperty({ type: [ArticleTaxonomyRefEntity] })
  readonly tags!: ArticleTaxonomyRefEntity[];

  @ApiProperty({ type: [String], example: ['en', 'ar'] })
  readonly availableLocales!: string[];
}

// Resolved detail for public reads — the list item plus body and per-locale SEO (D09-4).
export class PublicArticleDetailEntity extends PublicArticleListItemEntity {
  // Per-locale slug map so the frontend can switch locales without a 404 (slugs differ per
  // locale — doc 10 §6). Covers exactly the locales in `availableLocales`; detail response only.
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { en: 'building-x', ar: 'binaa-x' },
    description: 'Locale code → that locale’s slug, for locale switching.',
  })
  readonly slugs!: Record<string, string>;

  @ApiProperty({
    example: '# Heading\n\nOpaque Markdown body…',
    description: 'Opaque Markdown (D01-5).',
  })
  readonly body!: string;

  @ApiProperty({ type: String, nullable: true })
  readonly metaTitle!: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly metaDescription!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  readonly ogImageId!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'uri' })
  readonly canonicalUrl!: string | null;
}

// One locale's translatable article fields for the admin map (D10-6).
export class AdminArticleTranslationEntity {
  @ApiProperty()
  readonly title!: string;

  @ApiProperty()
  readonly slug!: string;

  @ApiProperty()
  readonly excerpt!: string;

  @ApiProperty({ description: 'Opaque Markdown (D01-5).' })
  readonly body!: string;

  @ApiProperty({ example: 7 })
  readonly readingTimeMin!: number;

  @ApiProperty({ type: String, nullable: true })
  readonly metaTitle!: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly metaDescription!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  readonly ogImageId!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'uri' })
  readonly canonicalUrl!: string | null;
}

// Full admin view (D10-6): identity, scheduling, relations, and the per-locale translation map.
// @ApiExtraModels registers the map's value type so its $ref resolves in the exported document.
@ApiExtraModels(AdminArticleTranslationEntity)
export class AdminArticleEntity {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ enum: ContentStatus, example: ContentStatus.DRAFT })
  readonly status!: ContentStatus;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  readonly publishAt!: string | null;

  @ApiProperty({ format: 'uuid' })
  readonly categoryId!: string;

  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  readonly coverImageId!: string | null;

  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'Associated tag ids.',
  })
  readonly tagIds!: string[];

  @ApiProperty({
    type: 'object',
    additionalProperties: {
      $ref: getSchemaPath(AdminArticleTranslationEntity),
    },
    description: 'Translation map keyed by locale code.',
  })
  readonly translations!: Record<string, AdminArticleTranslationEntity>;

  @ApiProperty({ format: 'date-time' })
  readonly createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  readonly updatedAt!: string;
}
