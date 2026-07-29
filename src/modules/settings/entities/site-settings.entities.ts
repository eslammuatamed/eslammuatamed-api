import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  PublicMediaImageDescriptor,
  PublicMediaPdfDescriptor,
} from '../../media/entities/media-descriptor.entity';

// Profile link JSON payload (doc 09 SiteSettings.profileLinks). Stored opaque as JSONB; the
// shape is enforced on write by ProfileLinkDto.
export class ProfileLinkEntity {
  @ApiProperty({ example: 'GitHub' })
  readonly label!: string;

  @ApiProperty({ example: 'https://github.com/eslammuatamed', format: 'uri' })
  readonly url!: string;

  @ApiPropertyOptional({
    example: 'i-simple-icons-github',
    description: 'Icon token (UI hint).',
  })
  readonly icon?: string;
}

// Constrained custom meta (FR-DSH-052): a name/content pair only — never a script. Rendered
// as <meta name content>, so injection is structurally impossible (doc 22 §3, doc 19 §5).
export class CustomMetaEntity {
  @ApiProperty({ example: 'theme-color' })
  readonly name!: string;

  @ApiProperty({ example: '#0b0b0f' })
  readonly content!: string;
}

// Public analytics tag descriptor — present only when analytics is enabled (FR-DSH-052,
// D20-5): a disabled tag is never advertised to the client.
export class PublicAnalyticsEntity {
  @ApiProperty({ example: 'ga4', enum: ['ga4', 'gtm'] })
  readonly provider!: string;

  @ApiProperty({ example: 'G-XXXXXXXXXX' })
  readonly measurementId!: string;
}

// Resolved single-locale settings for public rendering (D10-6): translatable fields flattened
// to the requested locale, plus global chrome and the FR-DSH-052 head/tag fields. Nullable
// fields declare `type: String` explicitly — a `string | null` union otherwise reflects as
// `Object`, which would document the flat string values as `type: object` (contract defect).
// Registers PublicMediaPdfDescriptor into components.schemas: resumeAsset now references it via an
// explicit $ref (not `type:`), so @nestjs/swagger no longer auto-registers it (its only such use).
@ApiExtraModels(PublicMediaPdfDescriptor, PublicMediaImageDescriptor)
export class PublicSiteSettingsEntity {
  @ApiProperty({ type: String, nullable: true, example: 'Eslam Muatamed' })
  readonly siteName!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Software engineer & architect',
  })
  readonly tagline!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Eslam Muatamed' })
  readonly defaultMetaTitle!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Portfolio, case studies, and writing.',
  })
  readonly defaultMetaDescription!: string | null;

  @ApiProperty({ type: [ProfileLinkEntity] })
  readonly profileLinks!: ProfileLinkEntity[];

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Open to select consulting engagements',
  })
  readonly availabilityStatus!: string | null;

  @ApiProperty({ type: Number, nullable: true, example: 2023 })
  readonly careerStartYear!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 11 })
  readonly careerStartMonth!: number | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'google-abc123',
    description: 'Google Search Console token.',
  })
  readonly googleSiteVerification!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'bing-def456',
    description: 'Bing Webmaster token.',
  })
  readonly bingSiteVerification!: string | null;

  // Documented as an inline nullable object rather than a nullable $ref: OpenAPI 3.0 validators
  // (ajv) don't honor `nullable` alongside `allOf: [$ref]`, so a null value would spuriously
  // fail contract assertions. Inlining keeps `analytics: null` valid while still validating the
  // present shape.
  @ApiProperty({
    type: 'object',
    nullable: true,
    description:
      'Present only when analytics is enabled; null otherwise (FR-DSH-052, D20-5).',
    properties: {
      provider: { type: 'string', enum: ['ga4', 'gtm'], example: 'ga4' },
      measurementId: { type: 'string', example: 'G-XXXXXXXXXX' },
    },
    required: ['provider', 'measurementId'],
  })
  readonly analytics!: PublicAnalyticsEntity | null;

  @ApiProperty({ type: [CustomMetaEntity] })
  readonly customMetas!: CustomMetaEntity[];

  // Nullable $ref: an explicit `allOf` with a sibling `nullable` (and NO `type: object`, which
  // @nestjs/swagger would otherwise add and which makes strict jest-openapi/AJV reject `null`).
  @ApiProperty({
    nullable: true,
    allOf: [{ $ref: getSchemaPath(PublicMediaPdfDescriptor) }],
    description:
      'Resolved résumé PDF descriptor (FR-PUB-023); null when no résumé is configured. The bare asset id stays admin-only.',
  })
  readonly resumeAsset!: PublicMediaPdfDescriptor | null;

  // Profile contract (D10-13). The bare portrait id is kept alongside the resolved descriptor —
  // additive, matching D10-10 — so a client can reference the asset without a second lookup.
  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  readonly portraitAssetId!: string | null;

  // Nullable $ref, same shape as every other public image (no portrait-specific media shape).
  // `alt` inside is the requested locale's value: null = no alt row, "" = decorative (doc 10 §6).
  @ApiProperty({
    nullable: true,
    allOf: [{ $ref: getSchemaPath(PublicMediaImageDescriptor) }],
    description:
      'Resolved About portrait descriptor (FR-PUB-020); null when no portrait is configured.',
  })
  readonly portrait!: PublicMediaImageDescriptor | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'hello@eslammuatamed.com',
    description: 'Professional address (CV, resume, outreach).',
  })
  readonly professionalEmail!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'contact@eslammuatamed.com',
    description: 'Public website contact address.',
  })
  readonly contactEmail!: string | null;

  // About content resolved to the requested locale (FR-PUB-020). Markdown stays an opaque
  // string here; null means not authored for this locale — the page omits the section.
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Markdown source.',
  })
  readonly aboutBio!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Markdown source.',
  })
  readonly engineeringPhilosophy!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Plain text.' })
  readonly currentFocus!: string | null;

  @ApiProperty({
    type: [String],
    example: ['en', 'ar'],
    description: 'Locales with a translation.',
  })
  readonly availableLocales!: string[];
}

// One locale's translatable settings, keyed under `translations` in the admin map (D10-6).
export class SiteSettingsTranslationEntity {
  @ApiProperty({ type: String, nullable: true, example: 'Eslam Muatamed' })
  readonly siteName!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Software engineer & architect',
  })
  readonly tagline!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Open to select consulting engagements',
  })
  readonly availabilityStatus!: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly defaultMetaTitle!: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly defaultMetaDescription!: string | null;

  // About content per locale (FR-PUB-020, D09-18).
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Markdown source.',
  })
  readonly aboutBio!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Markdown source.',
  })
  readonly engineeringPhilosophy!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Plain text.' })
  readonly currentFocus!: string | null;
}

// Full admin view (D10-6): every stored field plus the per-locale translation map, powering
// side-by-side editing. @ApiExtraModels registers the map's value type so its $ref resolves in
// the exported document (current @nestjs/swagger guidance for map/dictionary properties).
@ApiExtraModels(SiteSettingsTranslationEntity, PublicMediaImageDescriptor)
export class AdminSiteSettingsEntity {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ type: [ProfileLinkEntity] })
  readonly profileLinks!: ProfileLinkEntity[];

  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  readonly resumeAssetId!: string | null;

  // The writable portrait relation. The admin read also carries the resolved descriptor below,
  // mirroring how the media picker already consumes the resume asset.
  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  readonly portraitAssetId!: string | null;

  @ApiProperty({
    nullable: true,
    allOf: [{ $ref: getSchemaPath(PublicMediaImageDescriptor) }],
    description:
      'Resolved portrait descriptor for the media picker; null when unset. Read-only — write via portraitAssetId.',
  })
  readonly portrait!: PublicMediaImageDescriptor | null;

  @ApiProperty({ type: String, nullable: true })
  readonly professionalEmail!: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly contactEmail!: string | null;

  @ApiProperty({ type: Number, nullable: true, example: 2023 })
  readonly careerStartYear!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 11 })
  readonly careerStartMonth!: number | null;

  @ApiProperty({ type: String, nullable: true })
  readonly googleSiteVerification!: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly bingSiteVerification!: string | null;

  @ApiProperty({ type: String, nullable: true, enum: ['ga4', 'gtm'] })
  readonly analyticsProvider!: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly analyticsMeasurementId!: string | null;

  @ApiProperty({ example: false })
  readonly analyticsEnabled!: boolean;

  @ApiProperty({ type: [CustomMetaEntity] })
  readonly customMetas!: CustomMetaEntity[];

  @ApiProperty({
    type: 'object',
    additionalProperties: {
      $ref: getSchemaPath(SiteSettingsTranslationEntity),
    },
    description:
      'Translation map keyed by locale code, e.g. { "en": {…}, "ar": {…} }.',
  })
  readonly translations!: Record<string, SiteSettingsTranslationEntity>;
}
