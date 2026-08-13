import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ContactMessage,
  ContactMessageReply,
  Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ContactMailService } from './contact-mail.service';
import { CreateMessageReplyDto } from './dto/create-message-reply.dto';
import { ContactMessageReplyEntity } from './entities/contact-message-reply.entity';
import { MessageNotRepliableException } from './message-not-repliable.exception';
import {
  deriveProviderIdempotencyKey,
  isWithinProviderIdempotencyWindow,
} from './provider-idempotency';

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
// delivery, which belongs to MailService through ContactMailService (D19-12).
//
// THE STATE MACHINE, and what each state is allowed to claim:
//
//   PENDING  an attempt exists and NO terminal outcome was recorded. Honestly ambiguous: it covers
//            both "the send was never made" and "the provider accepted it and the status write did
//            not land". Nothing may read it as "not delivered".
//   SENT     the transport accepted the message AND that acceptance was recorded here. It does NOT
//            mean inbox delivery, a passed spam filter, a later successful hop, or a read message.
//   FAILED   no provider acceptance was OBSERVED **on a first send**. Weaker than "no email was
//            sent": MailService retries internally, so a first attempt the provider accepted
//            followed by a dropped connection looks transient, and an exhausted retry loop then
//            reports failure for a message that may in fact have gone out. This is precisely why a
//            same-key replay of a FAILED attempt does not re-send. A refused RECOVERY does not
//            reach this state at all — it stays PENDING (see `deliver`).
//
// Nothing in this file may be changed to report SENT before a transport has confirmed acceptance.
@Injectable()
export class ContactReplyService {
  private readonly logger = new Logger(ContactReplyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: ContactMailService,
  ) {}

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
    // D02-10 permits a phone-only submission, and the database CHECK guarantees only that at least
    // one contact method is present. So a valid stored message can have nowhere to reply to.
    //
    // The narrowed value is what every step below carries. The recipient is fixed HERE, once, from
    // the stored row — no later step re-reads it and none can be handed a different address.
    const message = asRepliable(await this.getMessageOrThrow(messageId));
    if (message === null) {
      throw new MessageNotRepliableException();
    }

    const { row, created } = await this.claim(
      message.id,
      dto.body,
      idempotencyKey,
      initiatedByUserId,
    );

    // Sending is deliberately OUTSIDE the claim's try/catch, not merely after it. Inside, every
    // failure the send or the finalize could raise would have to pass the P2002 predicate first,
    // and the day one of them did, a delivery fault would be reported as an idempotent replay.
    return created
      ? {
          reply: toEntity(await this.deliver(row, message, 'first')),
          created: true,
        }
      : { reply: toEntity(await this.replay(row, message)), created: false };
  }

  // Claims the logical attempt, or reports that someone else already holds it.
  //
  // The claim is a single committed INSERT with no transaction around it and nothing else inside
  // it: a crash from here on leaves a PENDING row, which is recoverable, whereas sending before
  // claiming would leave an email with no record of it at all — something no later request could
  // ever reconcile.
  private async claim(
    messageId: string,
    body: string,
    idempotencyKey: string,
    initiatedByUserId: string,
  ): Promise<{ row: ContactMessageReply; created: boolean }> {
    try {
      const row = await this.prisma.contactMessageReply.create({
        data: {
          contactMessageId: messageId,
          body,
          idempotencyKey,
          // Read from the verified JWT principal, never from the request body (D19-12). There is no
          // parameter on this path that could carry an operator id a client chose.
          initiatedByUserId,
          // status defaults to PENDING; stated by omission rather than written, so there is exactly
          // one place — the schema — that decides what a new attempt's state is.
        },
      });
      return { row, created: true };
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
          row: await this.findClaimed(messageId, idempotencyKey),
          created: false,
        };
      }
      throw error;
    }
  }

  // What a same-key request does about an attempt that already exists. The answer depends entirely
  // on the status it finds, and the three answers are genuinely different (11B-α §6):
  //
  //   SENT    return it. The logical attempt already succeeded; there is nothing to do.
  //   FAILED  return it, send NOTHING. A replay must not silently re-send — the client repeated a
  //           request, it did not ask for a second attempt. A deliberate retry is a NEW key, which
  //           is a new logical attempt with its own row and its own provider key.
  //   PENDING the ambiguous case, and the only one that may act. See below.
  //
  // The row is authoritative throughout: no branch rewrites its body, and none rewrites
  // `initiatedByUserId`. A second authorized operator replaying one key is still replaying the
  // FIRST operator's attempt, and the record of who sent that email must not move to whoever
  // happened to repeat the request (§16).
  private async replay(
    existing: ContactMessageReply,
    message: RepliableContactMessage,
  ): Promise<ContactMessageReply> {
    if (existing.status !== 'PENDING') {
      return existing;
    }

    // A PENDING attempt may be re-sent ONLY while the provider still recognises its key and would
    // therefore refuse to deliver a second copy. Past that window the outcome is permanently
    // ambiguous and the only safe action is none: the row is returned unchanged — not re-sent, not
    // marked SENT, not marked FAILED, and never duplicated into a second row (§12). Guessing here
    // would mean either inventing an outcome we do not know or mailing a real person twice.
    if (!isWithinProviderIdempotencyWindow(existing.createdAt, new Date())) {
      this.logger.warn(
        `Reply ${existing.id} is PENDING past the provider idempotency window; ` +
          `no automatic re-send. A deliberate retry requires a new Idempotency-Key.`,
      );
      return existing;
    }

    return this.deliver(existing, message, 'recovery');
  }

  // Sends one persisted attempt and records what the send concluded.
  //
  // Runs strictly OUTSIDE any database transaction (§7). SMTP is a network call with a bounded
  // retry loop behind it; holding a Postgres transaction open across it would keep row locks for
  // the duration of a remote party's latency, and a relay that is merely slow would become a
  // database problem. The claim is already committed, so there is nothing to keep open.
  //
  // `attempt` distinguishes the FIRST send for a freshly-claimed row from a RECOVERY send for a row
  // that was already PENDING. It changes only what a refusal means — see below.
  private async deliver(
    row: ContactMessageReply,
    message: RepliableContactMessage,
    attempt: 'first' | 'recovery',
  ): Promise<ContactMessageReply> {
    // Re-derived, never stored and never passed in. The same row yields the same key on every
    // attempt for as long as it exists, which is exactly the property a recovery re-send needs:
    // the provider sees the key it already has and does not send a second email.
    const providerKey = deriveProviderIdempotencyKey(row.id);
    const outcome = await this.mail.dispatchReply(
      message,
      row.body,
      providerKey,
      row.id,
    );

    if (!outcome.accepted) {
      // A refused RECOVERY leaves the row PENDING. This is not symmetry for its own sake — it is
      // the same argument §10 makes, applied one step later. The row was already ambiguous, which
      // means the email may ALREADY have been accepted; a refusal now is evidence about this
      // attempt, not about that one, and the SMTP relay's replay behaviour is undocumented, so it
      // is weak evidence even about this one. Writing FAILED here would assert an outcome nobody
      // knows AND foreclose every further recovery, because a FAILED replay never re-sends. The
      // window expiring is what ends recovery, not a refusal inside it.
      if (attempt === 'recovery') {
        this.logger.warn(
          `Reply ${row.id} recovery was not accepted; leaving it PENDING rather than ` +
            `recording a terminal state for an attempt whose outcome is still unknown.`,
        );
        return row;
      }

      // A FIRST send is different: nothing preceded it, so "no acceptance observed" is the whole
      // story of this attempt. (It is still weaker than "no email was sent" — the delivery layer
      // retries internally — which is why even THIS state never triggers an automatic re-send.)
      return this.prisma.contactMessageReply.update({
        where: { id: row.id },
        data: { status: 'FAILED', failedAt: new Date() },
      });
    }

    return this.prisma.contactMessageReply.update({
      where: { id: row.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        // Written only when the row does not already carry one. A recovery re-send goes to a
        // provider that is REPLAYING a key rather than accepting a new message, and what such a
        // replay returns is undocumented for the SMTP relay (ledger §5aj-E) — so a second value is
        // not evidence that the first was wrong. Correctness rests on the row id, the provider key
        // and the status; this column is a diagnostic, and a known-good id is never overwritten.
        providerMessageId: row.providerMessageId ?? outcome.providerMessageId,
      },
    });

    // NOTE — the failure mode this ordering deliberately accepts. If the provider accepts the
    // message and the UPDATE above then fails, the row stays PENDING and this call throws. That is
    // the correct database truth: from Postgres's point of view the external outcome is unknown,
    // and it must not be recorded as FAILED (which would forbid the recovery that is still safe)
    // nor as SENT (which was never written). A same-key retry within the window re-derives the
    // same provider key and re-sends against a provider that will not deliver twice (§10, §11).
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

// Narrows a stored message to one that can actually be replied to, or reports that it cannot.
//
// A function returning the narrowed VALUE rather than an inline `if` guard, because TypeScript's
// control-flow narrowing of `message.email` does not survive being handed to another method: the
// parameter type `RepliableContactMessage` is what carries "this address exists" across the call
// boundary, and constructing the value here is the one place that fact is established (D19-12).
function asRepliable(message: ContactMessage): RepliableContactMessage | null {
  return message.email !== null && message.email.length > 0
    ? { ...message, email: message.email }
    : null;
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
