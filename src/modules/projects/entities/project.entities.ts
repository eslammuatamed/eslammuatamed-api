import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { PageMeta } from '../../../common/pagination/page-meta';
import { PublicMediaImageDescriptor } from '../../media/entities/media-descriptor.entity';

export class ProjectTechnologyEntity {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  // The value a client puts in `GET /projects?technology=`. Locale-independent and stable across
  // label changes, so a filter URL means the same thing in every locale and survives copy edits —
  // which neither the id (meaningless in a shared link) nor the label (translated) can offer.
  @ApiProperty({ example: 'nestjs', pattern: '^[a-z0-9]+(-[a-z0-9]+)*$' })
  readonly slug!: string;

  @ApiProperty({ example: 'NestJS' })
  readonly label!: string;
}

// One selectable option in the `/projects` technology filter (D10-19).
//
// A FACET, not a skill: it exists only because at least one published project in the requested
// locale actually uses it. That is the whole point of the type — the filter used to be built from
// the global Skills registry, which offered options that match nothing (a taxonomy entry is not
// evidence of a project) and options that are not technologies at all.
export class ProjectTechnologyFacetEntity {
  @ApiProperty({ example: 'nestjs', pattern: '^[a-z0-9]+(-[a-z0-9]+)*$' })
  readonly slug!: string;

  @ApiProperty({
    example: 'NestJS',
    description: 'Localized label for the requested locale. Display only.',
  })
  readonly label!: string;

  // Normalized here rather than leaking the `SkillGroup` enum: the public contract needs exactly
  // the two buckets the filter renders, and the storage taxonomy is free to grow without that
  // becoming a breaking contract change.
  @ApiProperty({
    enum: ['frontend', 'backend'],
    description: 'Which group the filter renders this facet under.',
  })
  readonly group!: 'frontend' | 'backend';

  @ApiProperty({
    example: 3,
    description:
      'Published projects using this technology in the requested locale. Always ≥ 1, and computed over the whole published set — independent of the current page AND of the active technology filter.',
  })
  readonly count!: number;
}

// `/projects` list meta: pagination plus the facet list (D10-19).
export class ProjectListMeta extends PageMeta {
  @ApiProperty({
    type: [ProjectTechnologyFacetEntity],
    description:
      'Selectable technology filters. Empty when no published project in this locale carries an eligible technology; a group with no facets is simply absent.',
  })
  readonly facets!: ProjectTechnologyFacetEntity[];
}

export class PublicProjectListItemEntity {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ example: 'content-platform-api' })
  readonly slug!: string;

  @ApiProperty({ example: 'Content platform API' })
  readonly title!: string;

  @ApiProperty({ example: 'A multilingual publishing platform.' })
  readonly summary!: string;

  @ApiProperty({ example: true })
  readonly featured!: boolean;

  @ApiProperty({ type: Number, nullable: true, example: 2026 })
  readonly year!: number | null;

  @ApiProperty({ type: [ProjectTechnologyEntity] })
  readonly technologies!: ProjectTechnologyEntity[];

  @ApiProperty({ type: [String], example: ['en', 'ar'] })
  readonly availableLocales!: string[];
}

export class PublicProjectGalleryItemEntity {
  @ApiProperty({ format: 'uuid' })
  readonly mediaAssetId!: string;

  @ApiProperty({
    type: PublicMediaImageDescriptor,
    description: 'Resolved gallery image.',
  })
  readonly mediaAsset!: PublicMediaImageDescriptor;

  @ApiProperty({ example: 0 })
  readonly order!: number;

  @ApiProperty({ type: String, nullable: true, example: 'Dashboard overview.' })
  readonly caption!: string | null;
}

export class PublicProjectDetailEntity extends PublicProjectListItemEntity {
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { en: 'content-platform-api', ar: 'content-platform-api-ar' },
    description: 'Locale code to that locale’s project slug.',
  })
  readonly slugs!: Record<string, string>;

  @ApiProperty({ type: String, nullable: true, format: 'uri' })
  readonly liveUrl!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'uri' })
  readonly repoUrl!: string | null;

  @ApiProperty({ description: 'Opaque Markdown.' })
  readonly overview!: string;

  @ApiProperty({ description: 'Opaque Markdown.' })
  readonly businessProblem!: string;

  @ApiProperty({ description: 'Opaque Markdown.' })
  readonly solution!: string;

  @ApiProperty({ description: 'Opaque Markdown.' })
  readonly role!: string;

  @ApiProperty({ description: 'Opaque Markdown.' })
  readonly architecture!: string;

  @ApiProperty({ description: 'Opaque Markdown.' })
  readonly challenges!: string;

  @ApiProperty({ description: 'Opaque Markdown.' })
  readonly features!: string;

  @ApiProperty({ description: 'Opaque Markdown.' })
  readonly lessonsLearned!: string;

  @ApiProperty({ type: [PublicProjectGalleryItemEntity] })
  readonly gallery!: PublicProjectGalleryItemEntity[];

  @ApiProperty({ type: String, nullable: true })
  readonly metaTitle!: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly metaDescription!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  readonly ogImageId!: string | null;

  // Nullable $ref: explicit allOf + sibling nullable, no `type: object` (jest-openapi/AJV null fix).
  @ApiProperty({
    nullable: true,
    allOf: [{ $ref: getSchemaPath(PublicMediaImageDescriptor) }],
    description: 'Resolved OG image (null when none is set).',
  })
  readonly ogImage!: PublicMediaImageDescriptor | null;

  @ApiProperty({ type: String, nullable: true, format: 'uri' })
  readonly canonicalUrl!: string | null;
}

export class AdminProjectTranslationEntity {
  @ApiProperty() readonly title!: string;
  @ApiProperty() readonly slug!: string;
  @ApiProperty({ description: 'Opaque Markdown.' }) readonly summary!: string;
  @ApiProperty({ description: 'Opaque Markdown.' }) readonly overview!: string;
  @ApiProperty({ description: 'Opaque Markdown.' })
  readonly businessProblem!: string;
  @ApiProperty({ description: 'Opaque Markdown.' }) readonly solution!: string;
  @ApiProperty({ description: 'Opaque Markdown.' }) readonly role!: string;
  @ApiProperty({ description: 'Opaque Markdown.' })
  readonly architecture!: string;
  @ApiProperty({ description: 'Opaque Markdown.' })
  readonly challenges!: string;
  @ApiProperty({ description: 'Opaque Markdown.' }) readonly features!: string;
  @ApiProperty({ description: 'Opaque Markdown.' })
  readonly lessonsLearned!: string;
  @ApiProperty({ type: String, nullable: true }) readonly metaTitle!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) readonly metaDescription!:
    string | null;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  readonly ogImageId!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'uri' })
  readonly canonicalUrl!: string | null;
}

export class AdminProjectGalleryTranslationEntity {
  @ApiProperty({ type: String, nullable: true })
  readonly caption!: string | null;
}

@ApiExtraModels(AdminProjectGalleryTranslationEntity)
export class AdminProjectGalleryItemEntity {
  @ApiProperty({ format: 'uuid' }) readonly id!: string;
  @ApiProperty({ format: 'uuid' }) readonly mediaAssetId!: string;
  @ApiProperty({ example: 0 }) readonly order!: number;
  @ApiProperty({
    type: 'object',
    additionalProperties: {
      $ref: getSchemaPath(AdminProjectGalleryTranslationEntity),
    },
  })
  readonly translations!: Record<string, AdminProjectGalleryTranslationEntity>;
}

@ApiExtraModels(AdminProjectTranslationEntity)
export class AdminProjectEntity {
  @ApiProperty({ format: 'uuid' }) readonly id!: string;
  @ApiProperty({ example: true }) readonly featured!: boolean;
  @ApiProperty({ example: false }) readonly isPublished!: boolean;
  @ApiProperty({ example: 0 }) readonly order!: number;
  @ApiProperty({ type: String, nullable: true, format: 'uri' })
  readonly liveUrl!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'uri' })
  readonly repoUrl!: string | null;
  @ApiProperty({ type: Number, nullable: true, example: 2026 }) readonly year!:
    number | null;
  @ApiProperty({ type: [String], format: 'uuid' })
  readonly technologyIds!: string[];
  @ApiProperty({ type: [AdminProjectGalleryItemEntity] })
  readonly gallery!: AdminProjectGalleryItemEntity[];
  @ApiProperty({
    type: 'object',
    additionalProperties: {
      $ref: getSchemaPath(AdminProjectTranslationEntity),
    },
  })
  readonly translations!: Record<string, AdminProjectTranslationEntity>;
  @ApiProperty({ format: 'date-time' }) readonly createdAt!: string;
  @ApiProperty({ format: 'date-time' }) readonly updatedAt!: string;
}
