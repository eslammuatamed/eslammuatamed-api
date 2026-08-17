// The governed model allowlist (doc 09 §6.1, D09-21).
//
// This module is the safety boundary. It is deliberately data, not logic: the list is declared
// once, the apply path validates the plan against it before its first write, and there is no flag
// that skips that validation. A tool that may delete rows in production is protected by a check
// that must pass, not by the care of whoever wrote the plan builder.

/** Models the synchronization may create, update, hide or delete. Exhaustive. */
export const GOVERNED_MODELS = [
  'SiteSettings',
  'SiteSettingsTranslation',
  'Skill',
  'SkillTranslation',
  'Experience',
  'ExperienceTranslation',
  'ExperienceTechnology',
  'Project',
  'ProjectTranslation',
  'ProjectTechnology',
  'ProjectGalleryItem',
  'ProjectGalleryItemTranslation',
  'Category',
  'CategoryTranslation',
  'Tag',
  'TagTranslation',
  'Article',
  'ArticleTranslation',
  'ArticleTag',
] as const;

export type GovernedModel = (typeof GOVERNED_MODELS)[number];

/**
 * Governed models the synchronization NEVER writes directly. They are listed as governed only
 * because deleting a governed `Project` cascades into them, and a cascade that the report did not
 * mention would be an undisclosed deletion. They appear in the plan exclusively as reported
 * consequences.
 */
export const CASCADE_ONLY_MODELS = [
  'ProjectGalleryItem',
  'ProjectGalleryItemTranslation',
] as const;

/**
 * Operational models the synchronization must never create, update or delete.
 *
 * `Locale` is here rather than in the allowlist on purpose: `en`/`ar` are a PRECONDITION the base
 * seed establishes, and the synchronization refuses to run without them instead of creating them.
 * `Testimonial` is here because the canonical dataset does not own testimonials — they are
 * development-overlay content, and a tool that cannot distinguish "not canonical" from "should be
 * deleted" must do nothing rather than guess.
 */
export const PROTECTED_MODELS = [
  'User',
  'Role',
  'RolePermission',
  'RefreshToken',
  'ContactMessage',
  // Operator reply history (D09-23). Protected for the same reason as the message it answers, plus
  // one of its own: these rows record outbound email that a person actually sent, so a content
  // synchronization that could touch them could rewrite an audit trail. It is also unreachable by
  // construction — the canonical dataset has no concept of a reply — but "unreachable" and
  // "classified as protected" are different guarantees, and the second is the one that holds when
  // the dataset changes.
  'ContactMessageReply',
  'MediaAsset',
  'MediaAssetAlt',
  'MediaAssetVariant',
  'Testimonial',
  'TestimonialTranslation',
  // Static-page SEO (FR-DSH-051). The REASON changed when the SEO module shipped (D10-24) and the
  // classification did not, which is worth stating explicitly: this used to be unreachable — nothing
  // could write a `page_seo` row at all — and it is now operator-authored through the Dashboard. So
  // it is protected on the same grounds as `portraitAlt` is operator-owned: the canonical dataset has
  // no concept of static-page metadata, so a synchronization that governed it would write null over
  // the owner's SEO copy on every run.
  'PageSeo',
  'SlugRedirect',
  'Locale',
] as const;

export type ProtectedModel = (typeof PROTECTED_MODELS)[number];

const GOVERNED_SET: ReadonlySet<string> = new Set(GOVERNED_MODELS);
const CASCADE_ONLY_SET: ReadonlySet<string> = new Set(CASCADE_ONLY_MODELS);

export function isGoverned(model: string): model is GovernedModel {
  return GOVERNED_SET.has(model);
}

export function isCascadeOnly(model: string): boolean {
  return CASCADE_ONLY_SET.has(model);
}

/**
 * The governed `SiteSettings` scalar columns (doc 09 §6.3). Everything else on the singleton is
 * operator-owned. Listed explicitly so the update statement cannot quietly widen: the apply path
 * builds its `data` object from THIS list, so adding a column to the schema does not silently make
 * it governed.
 */
export const GOVERNED_SETTINGS_SCALARS = [
  'profileLinks',
  'careerStartYear',
  'careerStartMonth',
  'professionalEmail',
  'contactEmail',
  'contactPhone',
  'whatsappPhone',
] as const;

/**
 * Operator-owned `SiteSettingsTranslation` columns — the translation-side counterpart of
 * `OPERATOR_OWNED_SETTINGS_SCALARS`, and named for the same reason.
 *
 * `portraitAlt` is the PER-USAGE alt for the About portrait (D09-22). It is operator-owned rather
 * than governed because it describes an image the OWNER uploaded through the Dashboard: the
 * canonical dataset has no portrait and therefore cannot know what the picture shows. Governing it
 * would make `content:sync` write null over the owner's accessibility text on every run.
 */
export const OPERATOR_OWNED_SETTINGS_TRANSLATION_FIELDS = [
  'portraitAlt',
] as const;

/**
 * Operator-owned `SiteSettings` columns. Not merely "absent from the governed list" — named, so a
 * test can assert the two lists partition the model and neither drifts into the other.
 */
export const OPERATOR_OWNED_SETTINGS_SCALARS = [
  'resumeAssetId',
  'portraitAssetId',
  'googleSiteVerification',
  'bingSiteVerification',
  'analyticsEnabled',
  'gtmContainerId',
  'customMetas',
] as const;

/**
 * The governed `SiteSettingsTranslation` columns (doc 09 §6.3).
 *
 * NOT every column: `OPERATOR_OWNED_SETTINGS_TRANSLATION_FIELDS` above holds the operator-owned
 * ones. The two lists must partition the model, which `allowlist.spec.ts` asserts.
 */
export const GOVERNED_SETTINGS_TRANSLATION_FIELDS = [
  'siteName',
  'tagline',
  'availabilityStatus',
  'defaultMetaTitle',
  'defaultMetaDescription',
  'aboutBio',
  'engineeringPhilosophy',
  'currentFocus',
] as const;
