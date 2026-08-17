import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PAGE_SEO_KEYS } from '../page-keys';

/**
 * One locale's static-page SEO values (D10-24).
 *
 * The field set is deliberately identical to the entity translation SEO block (D09-4) — same four
 * columns, same caps, same null-clearing semantics (D10-23). A static page and an article page are
 * the same problem for a crawler, so a different shape here would only mean the Dashboard needed two
 * SEO panels to express one concept.
 */
export class PageSeoTranslationDto {
  @ApiProperty({
    example: 'ar',
    description: 'Two-letter locale; must be enabled.',
  })
  @Matches(/^[a-z]{2}$/, {
    message: 'locale must be a two-letter lowercase code.',
  })
  readonly locale!: string;

  // Meta length is editor guidance, not hard validation (doc 22 §3): search engines truncate rather
  // than reject, so the caps here only bound abuse. `null` clears — see D10-23.
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'About — Eslam Muatamed',
    description: 'null clears it.',
  })
  @IsOptional()
  @ValidateIf((dto: PageSeoTranslationDto) => dto.metaTitle !== null)
  @IsString()
  @MaxLength(300)
  readonly metaTitle?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Engineering background, philosophy, and current focus.',
    description: 'null clears it.',
  })
  @IsOptional()
  @ValidateIf((dto: PageSeoTranslationDto) => dto.metaDescription !== null)
  @IsString()
  @MaxLength(500)
  readonly metaDescription?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    example: '0194f9a2-ef2a-7a31-8cb7-369c87f7933a',
    description:
      'OG image MediaAsset id (must be an IMAGE); null clears it. The asset is RESTRICT-referenced while set.',
  })
  @IsOptional()
  @ValidateIf((dto: PageSeoTranslationDto) => dto.ogImageId !== null)
  @IsUUID()
  readonly ogImageId?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'uri',
    nullable: true,
    example: 'https://eslammuatamed.com/about',
    description: 'Canonical override; null clears it.',
  })
  @IsOptional()
  @ValidateIf((dto: PageSeoTranslationDto) => dto.canonicalUrl !== null)
  @IsUrl({ require_protocol: true })
  readonly canonicalUrl?: string | null;
}

/**
 * PATCH body for one page key (D10-2: PATCH is the only update verb).
 *
 * Per-locale UPSERT, mirroring `PATCH /admin/settings` exactly: a locale present in `translations`
 * is created or updated, a locale absent from it is left alone. That is what makes editing `ar`
 * without resending `en` safe, which the translation-tabs editor (doc 11) depends on.
 *
 * `pageKey` is NOT in the body — it is the path parameter, so there is exactly one place it can come
 * from and no way for a body to disagree with the URL it was sent to.
 */
export class UpdatePageSeoDto {
  @ApiProperty({
    type: [PageSeoTranslationDto],
    description: 'Per-locale upserts; at least one entry.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PageSeoTranslationDto)
  readonly translations!: PageSeoTranslationDto[];
}

/**
 * The `{pageKey}` path parameter, validated against the closed set (D09-24).
 *
 * A DTO rather than a bare `@Param()` string so the allowed values reach the exported contract as an
 * enum — the Dashboard builds its page list from the contract, and an undocumented set would have to
 * be duplicated by hand on the other side of a repository boundary.
 */
export class PageSeoKeyParamDto {
  @ApiProperty({ enum: PAGE_SEO_KEYS, example: 'about' })
  @IsIn(PAGE_SEO_KEYS, {
    message: `pageKey must be one of: ${PAGE_SEO_KEYS.join(', ')}.`,
  })
  readonly pageKey!: string;
}
