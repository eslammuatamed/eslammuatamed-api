import { ApiProperty } from '@nestjs/swagger';

// Admin inbox record (FR-DSH-060). Messages are locale-agnostic, so this is the full row (no
// translation map, no locale resolution). `meta` is opaque spam-forensics captured at intake.
export class ContactMessageEntity {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ example: 'Alex Morgan' })
  readonly name!: string;

  // Nullable as of D10-16: a visitor supplies email, phone, or both. A dashboard consumer renders
  // each reply affordance only when its own value is non-null, must never print the literal string
  // `null`, and must not assume an email is present.
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'alex@example.com',
    description:
      'The visitor email, or null when they supplied only a phone number (D10-16).',
  })
  readonly email!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '+201002785408',
    description:
      'The visitor phone in E.164, or null when they supplied only an email address (D10-16).',
  })
  readonly phone!: string | null;

  @ApiProperty({ example: 'Project inquiry' })
  readonly subject!: string;

  @ApiProperty({ example: "I'd like to discuss a Nuxt build." })
  readonly body!: string;

  @ApiProperty({ example: false })
  readonly isRead!: boolean;

  @ApiProperty({ example: false })
  readonly isArchived!: boolean;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description:
      'The archival instant (D09-14): set when the message is archived, cleared when un-archived. ' +
      'Null while the message has never been archived. Basis for the 12-month retention purge (doc 19 §6).',
    example: null,
  })
  readonly archivedAt!: Date | null;

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
