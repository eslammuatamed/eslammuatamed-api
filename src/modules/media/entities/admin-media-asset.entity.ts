import { ApiProperty } from '@nestjs/swagger';
import { MediaKind, MediaVariantFormat } from '@prisma/client';

// One delivered rendition as the admin sees it. Carries `overBudget` (D20-6) — the public
// descriptor (T7) omits it. `url` is absolute on the media origin.
export class AdminMediaVariantEntity {
  @ApiProperty({ enum: MediaVariantFormat, example: MediaVariantFormat.WEBP })
  readonly format!: MediaVariantFormat;

  @ApiProperty({ example: 1280 })
  readonly width!: number;

  @ApiProperty({ example: 720 })
  readonly height!: number;

  @ApiProperty({ example: 84213, description: 'Rendition size in bytes.' })
  readonly sizeBytes!: number;

  @ApiProperty({
    example: 'https://media.eslammuatamed.com/media/8f…/1280-webp.webp',
  })
  readonly url!: string;

  @ApiProperty({
    example: false,
    description:
      'Kept above its doc 20 §4 budget at the quality floor (D20-6); admin/ops-only.',
  })
  readonly overBudget!: boolean;
}

export class AdminMediaAltEntity {
  @ApiProperty({ example: 'en' })
  readonly locale!: string;

  @ApiProperty({
    example: 'A laptop on a wooden desk',
    description: 'An empty string is an intentionally-decorative alt.',
  })
  readonly alt!: string;
}

// The admin view of a media asset (image or resume PDF). For an IMAGE the base fields describe the
// sanitized WebP master; `url` is the widest WebP rendition (never the master). For a PDF the base
// fields describe the file and `url` is its download; `variants`/`blurhash`/dimensions are empty/null.
export class AdminMediaAssetEntity {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ enum: MediaKind, example: MediaKind.IMAGE })
  readonly kind!: MediaKind;

  @ApiProperty({
    description:
      'IMAGE: widest WebP rendition. PDF: download URL. Absolute on the media origin.',
    example: 'https://media.eslammuatamed.com/media/8f…/1920-webp.webp',
  })
  readonly url!: string;

  @ApiProperty({ example: 'image/webp' })
  readonly mimeType!: string;

  @ApiProperty({ example: 245123 })
  readonly sizeBytes!: number;

  @ApiProperty({
    example: 'desk-setup.jpg',
    description: 'Sanitized original filename (display + search).',
  })
  readonly originalFilename!: string;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 2400,
    description: 'Master width in pixels (images only; null for PDF).',
  })
  readonly width!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 1350 })
  readonly height!: number | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
    description: 'BlurHash LQIP of the master (images only).',
  })
  readonly blurhash!: string | null;

  @ApiProperty({
    example: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    description: 'SHA-256 (lowercase hex) of the original upload bytes.',
  })
  readonly contentHash!: string;

  @ApiProperty({
    type: [AdminMediaVariantEntity],
    description: 'Delivered renditions (images only; empty for a PDF).',
  })
  readonly variants!: AdminMediaVariantEntity[];

  @ApiProperty({
    type: [AdminMediaAltEntity],
    description: 'Per-locale alt text (images only).',
  })
  readonly alts!: AdminMediaAltEntity[];

  @ApiProperty()
  readonly createdAt!: Date;

  @ApiProperty()
  readonly updatedAt!: Date;
}
