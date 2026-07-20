import { ApiProperty } from '@nestjs/swagger';

// The public intake receipt. Deliberately minimal and CONSTANT: the exact same body is returned
// whether the message was persisted or silently dropped-as-success by anti-spam (FR-004-02). It
// carries no id and no field that could distinguish a real submission from a dropped one — a bot
// must learn nothing. The envelope interceptor wraps this as `{ data: { received: true } }`.
export class ContactReceiptEntity {
  @ApiProperty({
    example: true,
    description:
      'Always true. Identical for accepted and silently-dropped submissions.',
  })
  readonly received!: boolean;
}
