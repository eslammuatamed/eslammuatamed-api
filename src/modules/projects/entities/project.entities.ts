import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { PublicMediaImageDescriptor } from '../../media/entities/media-descriptor.entity';

export class ProjectTechnologyEntity {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ example: 'NestJS' })
  readonly label!: string;
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
