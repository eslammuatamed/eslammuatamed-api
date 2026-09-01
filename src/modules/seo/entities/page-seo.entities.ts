import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { PublicMediaImageDescriptor } from '../../media/entities/media-descriptor.entity';
import { PAGE_SEO_KEYS } from '../page-keys';

/**
 * Static-page SEO resolved to one locale for public rendering (D10-24, FR-DSH-051).
 *
 * ── EVERY FIELD IS NULLABLE, AND A MISSING ROW IS A 200 ─────────────────────────────────────────
 *
 * This response is an OVERRIDE LAYER, not a content record. Doc 22 §3's chain is
 * `entity meta → site defaults → app constants`, and F-D4 requires that empty fields "fall back to
 * settings-level defaults — shown as such, not as silently duplicated values". A static page sits at
 * the same tier as an entity, so the shape the Web needs is "what, if anything, overrides the
 * defaults here".
 *
 * That is why a valid page key with no stored row returns **200 with every field null** rather than
 * 404: the caller learns "no override, fall through", which is a real answer. A 404 would be
 * indistinguishable from an unknown route and would force the Web to treat an ordinary
 * not-yet-authored page as an error. 404 is reserved for a `pageKey` outside the closed set (D09-24).
 *
 * No cross-locale fallback (D10-6): an absent `ar` row yields nulls, never the `en` values. Falling
 * back would publish English metadata on an Arabic page, which is worse than publishing the
 * localized site defaults.
 */
@ApiExtraModels(PublicMediaImageDescriptor)
export class PublicPageSeoEntity {
  @ApiProperty({ enum: PAGE_SEO_KEYS, example: 'about' })
  readonly pageKey!: string;

  @ApiProperty({ example: 'ar', description: 'The requested locale.' })
  readonly locale!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'About — Eslam Muatamed',
  })
  readonly metaTitle!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Engineering background, philosophy, and current focus.',
  })
  readonly metaDescription!: string | null;

  // The bare id is kept alongside the resolved descriptor, matching how every other consumer
  // publishes media (D10-10) so a client can reference the asset without a second lookup.
  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  readonly ogImageId!: string | null;

  // Nullable $ref: an explicit `allOf` with a sibling `nullable` and NO `type: object`, which
  // @nestjs/swagger would otherwise add and which makes strict OpenAPI response validation
  // reject `null`.
  @ApiProperty({
    nullable: true,
    allOf: [{ $ref: getSchemaPath(PublicMediaImageDescriptor) }],
    description:
      'Resolved OG image descriptor; null when this page/locale sets none. Its `alt` is the asset-level localized default for the requested locale.',
  })
  readonly ogImage!: PublicMediaImageDescriptor | null;

  @ApiProperty({ type: String, nullable: true, format: 'uri' })
  readonly canonicalUrl!: string | null;
}

/** One locale's stored values, keyed under `translations` in the admin map (mirrors D10-6). */
export class PageSeoTranslationEntity {
  @ApiProperty({ type: String, nullable: true })
  readonly metaTitle!: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly metaDescription!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  readonly ogImageId!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'uri' })
  readonly canonicalUrl!: string | null;
}

/**
 * Full admin view of one page key (D10-24): the per-locale translation map, powering the SEO
 * module's side-by-side editor and its SERP preview (F-D4).
 *
 * The map carries an entry for EVERY enabled locale, including locales with no stored row — those
 * arrive as all-null. An editor that received only the authored locales would have to infer the
 * missing ones from a separate locales call to know which tabs to render, and "not authored" is
 * precisely the state the panel exists to let the owner fix.
 */
@ApiExtraModels(PageSeoTranslationEntity)
export class AdminPageSeoEntity {
  @ApiProperty({ enum: PAGE_SEO_KEYS, example: 'about' })
  readonly pageKey!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { $ref: getSchemaPath(PageSeoTranslationEntity) },
    description:
      'Translation map keyed by locale code, e.g. { "en": {…}, "ar": {…} }. Every enabled locale is present; an unauthored locale is all-null.',
  })
  readonly translations!: Record<string, PageSeoTranslationEntity>;
}
