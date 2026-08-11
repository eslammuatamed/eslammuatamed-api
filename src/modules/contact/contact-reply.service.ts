import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ContactMessage,
  ContactMessageReply,
  Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMessageReplyDto } from './dto/create-message-reply.dto';
import { ContactMessageReplyEntity } from './entities/contact-message-reply.entity';
import { MessageNotRepliableException } from './message-not-repliable.exception';

// What `create` concluded. The controller needs the distinction to answer 201 vs 200 (D10-21c) and
// nothing else does, so it travels as a flag on the result rather than as two return types or a
// thrown control-flow signal.
export interface ReplyCreateOutcome {
  readonly reply: ContactMessageReplyEntity;
  // False when this request replayed an attempt that already existed for the same
  // (message, idempotency key) pair — including one this same operator created a moment ago.
  readonly created: boolean;
}

// A message that is known to carry an address. The narrowing is in the TYPE rather than in a check
// inside the mail builder, so "we already established this message is repliable" is something the
// compiler carries rather than something a future reader has to re-derive.
export type RepliableContactMessage = ContactMessage & { email: string };

// The reply domain (D02-13). Owns the reply's persistence, its idempotency and its state — not its
// delivery, which belongs to MailService through ContactMailService's content builder (D19-12).
//
// NOTE ON SCOPE: this service does not send mail yet. `create` persists a PENDING attempt and stops.
// That is a deliberate half of the feature and it is why the status enum has a PENDING value with an
// honest definition: a row here means an attempt exists, never that anything was delivered. Nothing
// in this file may be changed to report SENT before a transport has actually confirmed acceptance.
@Injectable()
export class ContactReplyService {
  constructor(private readonly prisma: PrismaService) {}

  // Reply history for one message, chronological (D10-21f).
  //
  // Available on EVERY message, including a phone-only one that can never be replied to, where it
  // returns an empty list. Repliability is a property of sending, not of reading: gating the history
  // on it would make the dashboard unable to render an empty state for a message it can display.
  async list(messageId: string): Promise<ContactMessageReplyEntity[]> {
    // Resolves the 404 before the list query, so an unknown id cannot answer with an empty array —
    // "no replies" and "no such message" are different facts and must not share a response.
    await this.getMessageOrThrow(messageId);

    const rows = await this.prisma.contactMessageReply.findMany({
      where: { contactMessageId: messageId },
      // `createdAt` then `id`: UUIDv7 ids are time-ordered (D09-2), so the tie-break is both
      // deterministic and chronologically meaningful. Without it two replies created inside the
      // same millisecond would return in database row order — and two identical requests could
      // then disagree, which is exactly the defect D02-11 records for experience ordering.
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    return rows.map(toEntity);
  }

  // Creates — or replays — one logical reply attempt.
  //
  // The ordering of the three failure answers is part of the contract, not an implementation
  // detail (D10-21c): an unknown message 404s before any key is examined, and an unrepliable
  // message 409s before any key is CLAIMED. A client can therefore never burn an idempotency key
  // on a message it was never able to reply to.
  async create(
    messageId: string,
    dto: CreateMessageReplyDto,
    idempotencyKey: string,
    initiatedByUserId: string,
  ): Promise<ReplyCreateOutcome> {
    const message = await this.getMessageOrThrow(messageId);

    // D02-10 permits a phone-only submission, and the database CHECK guarantees only that at least
    // one contact method is present. So a valid stored message can have nowhere to reply to.
    if (message.email === null || message.email.length === 0) {
      throw new MessageNotRepliableException();
    }

    try {
      const row = await this.prisma.contactMessageReply.create({
        data: {
          contactMessageId: message.id,
          body: dto.body,
          idempotencyKey,
          // Read from the verified JWT principal, never from the request body (D19-12). There is no
          // parameter on this path that could carry an operator id a client chose.
          initiatedByUserId,
          // status defaults to PENDING; stated by omission rather than written, so there is exactly
          // one place — the schema — that decides what a new attempt's state is.
        },
      });

      return { reply: toEntity(row), created: true };
    } catch (error: unknown) {
      // P2002 on the (contactMessageId, idempotencyKey) unique index is the ONLY expected conflict
      // here, and it is not an error — it is the idempotency guarantee firing. Two concurrent POSTs
      // carrying one key both reach this INSERT; exactly one wins and the loser lands here and reads
      // the winner's row. This is why the invariant lives in the database: it is the only layer both
      // requests pass through, and a pre-SELECT would be a stale read under any concurrency at all.
      //
      // Narrow catch on purpose. Catching broadly would turn a genuine write failure into a silent
      // "already exists" and then a confident 200 describing a row this request did not create.
      if (isUniqueViolation(error)) {
        return {
          reply: toEntity(await this.findClaimed(messageId, idempotencyKey)),
          created: false,
        };
      }
      throw error;
    }
  }

  // Reads the attempt that owns this logical key after losing the insert race.
  //
  // `findUniqueOrThrow` rather than a nullable read: reaching here means the database just rejected
  // an insert BECAUSE this row exists, so an absent row is not a 404 to report to the client — it is
  // a contradiction, and it should surface as a server error rather than be smoothed into a
  // plausible-looking response. (It is reachable in exactly one way: a concurrent delete of the
  // parent message between the rejected insert and this read, which cascades the row away.)
  private findClaimed(
    messageId: string,
    idempotencyKey: string,
  ): Promise<ContactMessageReply> {
    return this.prisma.contactMessageReply.findUniqueOrThrow({
      where: {
        contactMessageId_idempotencyKey: {
          contactMessageId: messageId,
          idempotencyKey,
        },
      },
    });
  }

  // Mirrors ContactService.getOrThrow's sanitized message — the 404 body must not distinguish
  // "no such message" from anything else, and must be identical on both reply routes.
  private async getMessageOrThrow(id: string): Promise<ContactMessage> {
    const row = await this.prisma.contactMessage.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Message not found.');
    }
    return row;
  }
}

// The unique-constraint predicate, kept local and narrow. Deliberately NOT a general
// `isPrismaCode` helper: B-2 removed one of those, and the repository's accepted shape is a
// single-purpose predicate per call site (cf. `isUniqueViolationOnContentHash` in media.service.ts).
//
// The code alone is matched, never `meta.target`: Prisma 7 degraded that field's contents once
// already (F9-9), and this insert has exactly one unique index, so the code is unambiguous.
function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

function toEntity(row: ContactMessageReply): ContactMessageReplyEntity {
  return {
    id: row.id,
    contactMessageId: row.contactMessageId,
    body: row.body,
    status: row.status,
    initiatedByUserId: row.initiatedByUserId,
    createdAt: row.createdAt,
    sentAt: row.sentAt,
    failedAt: row.failedAt,
    // providerMessageId is read from the row and deliberately dropped here — the mapper is the one
    // place the internal/public boundary is drawn, so a field added to the model is not published
    // by accident (D10-21e).
  };
}
