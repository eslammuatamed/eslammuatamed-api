import { ApiProperty } from '@nestjs/swagger';
import {
  MediaKind,
  MediaVariantFormat,
} from '../../../generated/prisma/client';

// The PUBLIC media descriptors (D10-10, doc 10 §6). Resolved additively onto public responses
// alongside the retained `*Id` fields. Deliberately narrower than the admin entity: NO overBudget,
// NO storage keys, NO content hash, NO master URL — only what a public client renders. Every `url`
// is absolute on the configured media origin (doc 19 §5), never the API origin.

export class PublicMediaVariantDescriptor {
  @ApiProperty({ enum: MediaVariantFormat, example: MediaVariantFormat.WEBP })
  readonly format!: MediaVariantFormat;

  @ApiProperty({ example: 1280 })
  readonly width!: number;

  @ApiProperty({ example: 720 })
  readonly height!: number;

  @ApiProperty({
    example: 'https://media.eslammuatamed.com/media/8f…/1280-webp.webp',
  })
  readonly url!: string;
}

export class PublicMediaImageDescriptor {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ enum: MediaKind, example: MediaKind.IMAGE })
  readonly kind!: MediaKind;

  @ApiProperty({
    description:
      'Widest PUBLIC WebP rendition (never the sanitized master). `width`/`height` are this exact file’s dimensions (D10-14).',
    example: 'https://media.eslammuatamed.com/media/8f…/1920-webp.webp',
  })
  readonly url!: string;

  @ApiProperty({
    example: 1920,
    description:
      'Width (px) of the file served by `url` — NOT the private master’s. Safe to use as that candidate’s width descriptor (D10-14).',
  })
  readonly width!: number;

  @ApiProperty({
    example: 1080,
    description: 'Height (px) of the file served by `url` (D10-14).',
  })
  readonly height!: number;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
    description: 'BlurHash LQIP.',
  })
  readonly blurhash!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'A laptop on a wooden desk',
    description:
      'Alt for the requested ?locale=: null = no translation (no fallback), "" = intentionally decorative.',
  })
  readonly alt!: string | null;

  @ApiProperty({
    type: [PublicMediaVariantDescriptor],
    description: 'Every WebP/AVIF rendition (width asc, format asc).',
  })
  readonly variants!: PublicMediaVariantDescriptor[];
}

export class PublicMediaPdfDescriptor {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ enum: MediaKind, example: MediaKind.PDF })
  readonly kind!: MediaKind;

  @ApiProperty({
    description:
      'Download URL (attachment headers are object metadata, doc 19 §5).',
    example: 'https://media.eslammuatamed.com/media/8f…/document.pdf',
  })
  readonly url!: string;

  @ApiProperty({ example: 'eslam-muatamed-resume.pdf' })
  readonly filename!: string;

  @ApiProperty({ example: 245123 })
  readonly sizeBytes!: number;
}
