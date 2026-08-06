import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Every foreign key that can reference a MediaAsset (doc 10 §6). Enumerated by GET usages and the
// 409 delete-in-use body so an operator sees exactly what blocks a deletion.
export const MEDIA_USAGE_TYPES = [
  'article-cover',
  'article-og',
  'project-og',
  'project-gallery',
  'testimonial-avatar',
  'page-seo-og',
  'settings-resume',
  'settings-portrait',
] as const;

export type MediaUsageType = (typeof MEDIA_USAGE_TYPES)[number];

export class MediaUsageEntity {
  @ApiProperty({ enum: MEDIA_USAGE_TYPES, example: 'article-cover' })
  readonly type!: MediaUsageType;

  @ApiProperty({
    format: 'uuid',
    description: 'Id of the record that references the asset.',
  })
  readonly id!: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
    description:
      'Context for the reference (e.g. articleId, projectId, locale, pageKey).',
    example: { articleId: '018f…', locale: 'en' },
  })
  readonly reference?: Record<string, string>;
}
