import { ApiProperty } from '@nestjs/swagger';

// Admin inbox record (FR-DSH-060). Messages are locale-agnostic, so this is the full row (no
// translation map, no locale resolution). `meta` is opaque spam-forensics captured at intake.
export class ContactMessageEntity {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ example: 'Alex Morgan' })
  readonly name!: string;

  @ApiProperty({ example: 'alex@example.com' })
  readonly email!: string;

  @ApiProperty({ example: 'Project inquiry' })
  readonly subject!: string;

  @ApiProperty({ example: "I'd like to discuss a Nuxt build." })
  readonly body!: string;

  @ApiProperty({ example: false })
  readonly isRead!: boolean;

  @ApiProperty({ example: false })
  readonly isArchived!: boolean;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'Spam forensics captured at intake (userAgent / referrer). Empty object when absent.',
    example: { userAgent: 'Mozilla/5.0', referrer: 'https://example.com' },
  })
  readonly meta!: Record<string, unknown>;

  @ApiProperty({ format: 'date-time' })
  readonly createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  readonly updatedAt!: Date;
}
