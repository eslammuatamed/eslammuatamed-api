import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsPhoneNumber,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

// Matches the projects module's Markdown bound (256 KiB): About prose is Markdown source and
// is validated for abuse, not for editorial length.
const MARKDOWN_MAX = 256 * 1024;

// RFC 5321 caps a full address at 254 characters.
const EMAIL_MAX = 254;

export class ProfileLinkDto {
  @ApiPropertyOptional({ example: 'GitHub' })
  @IsString()
  @MaxLength(80)
  readonly label!: string;

  @ApiPropertyOptional({ example: 'https://github.com/eslammuatamed' })
  @IsUrl({ require_protocol: true })
  readonly url!: string;

  @ApiPropertyOptional({ example: 'i-simple-icons-github' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  readonly icon?: string;
}

// FR-DSH-052: name/content pairs only. `name` is constrained to a meta-name charset so the
// pair can never be coerced into anything but a <meta> tag (doc 19 §5, doc 22 §3).
export class CustomMetaDto {
  @ApiPropertyOptional({ example: 'theme-color' })
  @IsString()
  @Matches(/^[a-zA-Z0-9:_.-]{1,60}$/, {
    message: 'name must be a meta-name token (letters, digits, : _ . -).',
  })
  readonly name!: string;

  @ApiPropertyOptional({ example: '#0b0b0f' })
  @IsString()
  @MaxLength(300)
  readonly content!: string;
}

export class SettingsTranslationDto {
  @ApiPropertyOptional({
    example: 'ar',
    description: 'Two-letter locale; must be enabled.',
  })
  @Matches(/^[a-z]{2}$/, {
    message: 'locale must be a two-letter lowercase code.',
  })
  readonly locale!: string;

  // D10-23: every nullable column on this row accepts an explicit `null` to CLEAR it, and the
  // contract says so. Omitting a key leaves the stored value untouched (Prisma treats `undefined`
  // as a no-op); sending `null` writes NULL. Those two meanings are distinct and both are needed —
  // there is no other way to withdraw a tagline or a default meta description once set.
  // `type: String` + `nullable: true` are REQUIRED, not decorative: a `string | null` union erases
  // to `Object` in the emitted design type, and without the pair the field exports as a
  // non-nullable string that `openapi-typescript` renders `field?: string` — which no strict-TS
  // caller can assign `null` to. `portraitAlt` below already carried this treatment; these eight
  // did not, so the runtime accepted a clear the contract forbade.
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Eslam Muatamed',
    description: 'null clears it.',
  })
  @IsOptional()
  @ValidateIf((dto: SettingsTranslationDto) => dto.siteName !== null)
  @IsString()
  @MaxLength(120)
  readonly siteName?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Software engineer & architect',
    description: 'null clears it.',
  })
  @IsOptional()
  @ValidateIf((dto: SettingsTranslationDto) => dto.tagline !== null)
  @IsString()
  @MaxLength(200)
  readonly tagline?: string | null;

  // Per-locale from feature 007 (was a base scalar): localized like tagline so /ar renders Arabic.
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Open to select consulting engagements',
    description: 'null clears it.',
  })
  @IsOptional()
  @ValidateIf((dto: SettingsTranslationDto) => dto.availabilityStatus !== null)
  @IsString()
  @MaxLength(200)
  readonly availabilityStatus?: string | null;

  // Meta length is editor guidance (character counters), not hard validation (doc 22 §3):
  // search engines truncate, they don't reject. The cap here only bounds abuse.
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Eslam Muatamed',
    description: 'null clears it.',
  })
  @IsOptional()
  @ValidateIf((dto: SettingsTranslationDto) => dto.defaultMetaTitle !== null)
  @IsString()
  @MaxLength(300)
  readonly defaultMetaTitle?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Portfolio, case studies, and writing.',
    description: 'null clears it.',
  })
  @IsOptional()
  @ValidateIf(
    (dto: SettingsTranslationDto) => dto.defaultMetaDescription !== null,
  )
  @IsString()
  @MaxLength(500)
  readonly defaultMetaDescription?: string | null;

  // About content (FR-PUB-020, D09-18). Markdown is an opaque string at this layer; the cap
  // matches the project-body Markdown bound rather than a prose-length guess.
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Markdown source. null clears it.',
  })
  @IsOptional()
  @ValidateIf((dto: SettingsTranslationDto) => dto.aboutBio !== null)
  @IsString()
  @MaxLength(MARKDOWN_MAX)
  readonly aboutBio?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Markdown source. null clears it.',
  })
  @IsOptional()
  @ValidateIf(
    (dto: SettingsTranslationDto) => dto.engineeringPhilosophy !== null,
  )
  @IsString()
  @MaxLength(MARKDOWN_MAX)
  readonly engineeringPhilosophy?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Building bilingual product platforms.',
    description: 'null clears it.',
  })
  @IsOptional()
  @ValidateIf((dto: SettingsTranslationDto) => dto.currentFocus !== null)
  @IsString()
  @MaxLength(300)
  readonly currentFocus?: string | null;

  // PER-USAGE alt for the About portrait (D09-22). It belongs to the USAGE, not to the asset:
  // `MediaAssetAlt` is library-level default metadata, and a reusable asset can need a different
  // description in each context, so a consuming relation that defines its own alt owns the
  // published accessibility text and takes precedence over the default.
  //
  // `null` clears it. The API does NOT require an alt when a portrait is set — publication is
  // already governed by the readiness state (`portrait-alt-missing`, D18-7), so forcing it here
  // would make an incomplete draft unsaveable. The Dashboard is where "both locales required" is
  // enforced, and that split is deliberate.
  // `type: String` is REQUIRED, not decorative. Swagger reads the emitted TypeScript design type,
  // and a `string | null` union erases to `Object` — so without it this field exported as
  // `{"type":"object"}` while every sibling nullable string here exported as `{"type":"string"}`.
  // The runtime was always correct (`@IsString()`); only the contract lied, and the contract is the
  // only interface the Web has. `openapi-typescript` turned that into
  // `portraitAlt?: Record<string, never> | null`, which no caller can assign an alt string to — and
  // the Web is forbidden from handwriting a correction, so the defect had to be fixed at the source.
  @ApiPropertyOptional({
    type: String,
    example: 'Eslam Muatamed, smiling, in front of a bookshelf.',
    description:
      'Localized alt text for the About portrait in THIS locale, or null to clear. Per-usage: it overrides the asset-level MediaAssetAlt default.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((dto: SettingsTranslationDto) => dto.portraitAlt !== null)
  @IsString()
  @MaxLength(300)
  readonly portraitAlt?: string | null;
}

// Partial update (D10-2: PATCH is the only update verb). Every field is optional; only those
// present are written. OWNER-only at the controller (doc 19 §3).
export class UpdateSettingsDto {
  @ApiPropertyOptional({ type: [ProfileLinkDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfileLinkDto)
  readonly profileLinks?: ProfileLinkDto[];

  // The resume slot (FR-DSH-070, D02-7): a MediaAsset FK that must reference a PDF asset (enforced
  // in the service). null clears it; the previously-referenced asset is retained in the library
  // until deleted while unreferenced (doc 07 §6).
  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Resume PDF media asset id (must be a PDF), or null to clear.',
  })
  @IsOptional()
  @ValidateIf((dto: UpdateSettingsDto) => dto.resumeAssetId !== null)
  @IsUUID()
  readonly resumeAssetId?: string | null;

  // The About portrait slot (FR-PUB-020): a MediaAsset FK that must reference an IMAGE asset
  // (enforced in the service, 422). null clears it; the prior asset stays in the library.
  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      'About portrait media asset id (must be an IMAGE), or null to clear.',
  })
  @IsOptional()
  @ValidateIf((dto: UpdateSettingsDto) => dto.portraitAssetId !== null)
  @IsUUID()
  readonly portraitAssetId?: string | null;

  // Public addresses. Trimmed, but never lowercased — the local part is case-sensitive
  // (RFC 5321), so folding it could address a different mailbox. null clears.
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'hello@eslammuatamed.com',
  })
  @IsOptional()
  @ValidateIf((dto: UpdateSettingsDto) => dto.professionalEmail !== null)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsEmail()
  @MaxLength(EMAIL_MAX)
  readonly professionalEmail?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'contact@eslammuatamed.com',
  })
  @IsOptional()
  @ValidateIf((dto: UpdateSettingsDto) => dto.contactEmail !== null)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsEmail()
  @MaxLength(EMAIL_MAX)
  readonly contactEmail?: string | null;

  // Public owner numbers (D10-16). Normalized to E.164 on the way in, mirroring the public intake:
  // the stored value is an international number, never a display-formatted one. `null` withdraws a
  // number, which is why the Web never hard-codes either — withdrawal stays a data edit.
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '+201002785408',
    description: 'Public contact number in E.164; null withdraws it.',
  })
  @IsOptional()
  @ValidateIf((dto: UpdateSettingsDto) => dto.contactPhone !== null)
  @Transform(({ value }: { value: unknown }) => normalizeE164(value))
  @IsPhoneNumber()
  readonly contactPhone?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '+201002785408',
    description:
      'Public WhatsApp number in E.164; null withdraws it. Independent of contactPhone.',
  })
  @IsOptional()
  @ValidateIf((dto: UpdateSettingsDto) => dto.whatsappPhone !== null)
  @Transform(({ value }: { value: unknown }) => normalizeE164(value))
  @IsPhoneNumber()
  readonly whatsappPhone?: string | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 2023,
    minimum: 1970,
    maximum: 2100,
    description: 'Career start year; set together with careerStartMonth.',
  })
  @IsOptional()
  @IsInt()
  @Min(1970)
  @Max(2100)
  readonly careerStartYear?: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 11,
    minimum: 1,
    maximum: 12,
    description: 'Career start month; set together with careerStartYear.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  readonly careerStartMonth?: number | null;

  // D10-23 again: a verification token must be WITHDRAWABLE. Retiring a Search Console or Bing
  // property means the meta tag has to stop rendering, and `null` is the only way to say that —
  // omitting the key preserves the stored token. Without `nullable: true` the Web could read a
  // cleared token but never clear one, so the tag would outlive the property it verified.
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'google-abc123',
    description: 'Google Search Console token; null withdraws it.',
  })
  @IsOptional()
  @ValidateIf((dto: UpdateSettingsDto) => dto.googleSiteVerification !== null)
  @IsString()
  @MaxLength(200)
  readonly googleSiteVerification?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'bing-def456',
    description: 'Bing Webmaster token; null withdraws it.',
  })
  @IsOptional()
  @ValidateIf((dto: UpdateSettingsDto) => dto.bingSiteVerification !== null)
  @IsString()
  @MaxLength(200)
  readonly bingSiteVerification?: string | null;

  @ApiPropertyOptional({
    example: false,
    description:
      'Tracking kill switch; off by default (D20-5). Enabling it requires a gtmContainerId — the service rejects the pair otherwise (422).',
  })
  @IsOptional()
  @IsBoolean()
  readonly analyticsEnabled?: boolean;

  // GTM-only (D02-14). The container id is validated by SHAPE here — a value that is not a container
  // id could not load a container, and letting one through would put an unusable string into a head
  // tag on every public page. Google's own format is `GTM-` plus an uppercase-alphanumeric suffix;
  // the length is bounded rather than fixed at 7 because Google has issued longer suffixes and a
  // hard 7 would reject a legitimate container. `null` withdraws it, which is how tracking is torn
  // down without a redeploy — the same withdrawal semantics as the verification tokens above.
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'GTM-ABCD123',
    description:
      'Google Tag Manager container id; null withdraws it. GA4, Meta Pixel, LinkedIn Insight and any other vendor are configured INSIDE the container, never here.',
  })
  @IsOptional()
  @ValidateIf((dto: UpdateSettingsDto) => dto.gtmContainerId !== null)
  @Matches(/^GTM-[A-Z0-9]{4,12}$/, {
    message:
      'gtmContainerId must be a GTM container id, e.g. GTM-ABCD123 (uppercase letters and digits).',
  })
  readonly gtmContainerId?: string | null;

  @ApiPropertyOptional({ type: [CustomMetaDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomMetaDto)
  readonly customMetas?: CustomMetaDto[];

  @ApiPropertyOptional({
    type: [SettingsTranslationDto],
    description: 'Per-locale upserts.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SettingsTranslationDto)
  readonly translations?: SettingsTranslationDto[];
}

// Shared with the public contact intake in spirit: strip everything that is not a digit or the
// leading `+`, so human spacing and grouping never reach storage (D10-16). Shape only — a number
// that is still invalid after this fails `@IsPhoneNumber` rather than being repaired.
function normalizeE164(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const compact = value.replace(/[^\d+]/g, '');
  return compact.startsWith('+')
    ? `+${compact.slice(1).replace(/\+/g, '')}`
    : compact;
}
