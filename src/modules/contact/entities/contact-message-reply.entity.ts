import { ApiProperty } from '@nestjs/swagger';
import { ContactMessageReplyStatus } from '../../../generated/prisma/enums';

// One operator reply attempt, as the admin dashboard sees it (D10-21e).
//
// What is deliberately ABSENT is the substance of this contract: `providerMessageId`, the transport
// name, the SMTP response code, the relay's failure text and any stack are all internal. A client
// needs to know THAT an attempt failed in order to offer a retry; it does not need the relay's
// reason, which is operational detail whose natural habitat is a server log and which for a mail
// library can carry the transport envelope (doc 19 §7). Withdrawing a published field is a breaking
// change and adding one is not, so the default is to publish nothing that has no consumer.
//
// The recipient is likewise absent — not hidden, but genuinely not stored here (D09-23). It is
// `ContactMessage.email`, one relation away, so there is exactly one answer to who this was sent to.
export class ContactMessageReplyEntity {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'The ContactMessage this reply answers.',
  })
  readonly contactMessageId!: string;

  @ApiProperty({
    example: 'Thanks for reaching out — I can take a look at this next week.',
    description: 'The plain-text reply body as it was submitted.',
  })
  readonly body!: string;

  @ApiProperty({
    enum: ContactMessageReplyStatus,
    enumName: 'ContactMessageReplyStatus',
    description:
      'PENDING — the attempt exists but no terminal outcome has been recorded. ' +
      'SENT — the mail transport confirmed acceptance and that outcome was persisted. ' +
      'FAILED — the transport conclusively failed and the failure was persisted. ' +
      'A PENDING attempt is never evidence that nothing was delivered (D09-23).',
  })
  readonly status!: ContactMessageReplyStatus;

  @ApiProperty({
    format: 'uuid',
    description:
      'The authenticated operator who initiated this attempt. An opaque user id — the operator ' +
      'email is not published here, so reply history requires no user-directory access to read.',
  })
  readonly initiatedByUserId!: string;

  @ApiProperty({ format: 'date-time' })
  readonly createdAt!: Date;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'When acceptance was recorded, or null unless status is SENT.',
  })
  readonly sentAt!: Date | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description:
      'When the failure was recorded, or null unless status is FAILED.',
  })
  readonly failedAt!: Date | null;
}
