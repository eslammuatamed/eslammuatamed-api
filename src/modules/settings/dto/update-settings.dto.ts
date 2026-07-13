import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

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

  @ApiPropertyOptional({ example: 'Eslam Muatamed' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  readonly siteName?: string;

  @ApiPropertyOptional({ example: 'Software engineer & architect' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  readonly tagline?: string;

  // Meta length is editor guidance (character counters), not hard validation (doc 22 §3):
  // search engines truncate, they don't reject. The cap here only bounds abuse.
  @ApiPropertyOptional({ example: 'Eslam Muatamed' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  readonly defaultMetaTitle?: string;

  @ApiPropertyOptional({ example: 'Portfolio, case studies, and writing.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly defaultMetaDescription?: string;
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

  @ApiPropertyOptional({ example: 'Open to select consulting engagements' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  readonly availabilityStatus?: string;

  // resumeAssetId is intentionally not writable here: it is a MediaAsset FK, and the media
  // module ships in feature 002+. It remains readable on the admin entity.

  @ApiPropertyOptional({ example: 'google-abc123' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  readonly googleSiteVerification?: string;

  @ApiPropertyOptional({ example: 'bing-def456' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  readonly bingSiteVerification?: string;

  @ApiPropertyOptional({ enum: ['ga4', 'gtm'] })
  @IsOptional()
  @IsIn(['ga4', 'gtm'])
  readonly analyticsProvider?: string;

  @ApiPropertyOptional({ example: 'G-XXXXXXXXXX' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  readonly analyticsMeasurementId?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Analytics is off by default (D20-5).',
  })
  @IsOptional()
  @IsBoolean()
  readonly analyticsEnabled?: boolean;

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
