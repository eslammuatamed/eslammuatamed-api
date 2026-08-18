import { Injectable, Logger } from '@nestjs/common';
import { ContactMessage } from '../../generated/prisma/client';
import { AppConfigService } from '../../config/app-config.service';
import { MailMessage } from '../mail/mail-message';
import { MailService } from '../mail/mail.service';
// `import type`, not a value import. ContactReplyService now injects THIS service, so a value
// import here would close a runtime require() cycle between the two files and hand one of them a
// half-initialized module at load. The `type` keyword makes the elision explicit and permanent
// rather than a property of how the compiler happens to treat an unused binding today.
import type { RepliableContactMessage } from './contact-reply.service';
import { deriveReplySubject } from './reply-subject';

// Collapses CR/LF to spaces before a visitor-supplied value is used in a mail HEADER. `subject`
// reaches this API through a DTO that trims and length-caps it but does not forbid newlines, and a
// newline in a header is the classic SMTP header-injection vector (doc 19 §6): it would let a
// visitor append their own headers — a second `Bcc:`, a forged `From:` — to a message the owner
// sends. Applied to header values only; the message BODY keeps its line breaks, where they are
// content rather than structure.
function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

// Renders an optional visitor contact method for the notification body. An em dash rather than an
// empty line so the owner reads "this was not supplied" instead of wondering whether the field
// failed to render — exactly one of the two is always absent (D02-10).
function orAbsent(value: string | null): string {
  return value !== null && value.length > 0 ? value : '—';
}

// What a reply send attempt concluded, in terms the reply domain persists — and nothing more.
//
// Deliberately narrower than `MailSendResult`: no SMTP response, no Nodemailer info object, no
// provider error. The domain records a status and an optional external id; giving it the raw
// result would let a transport detail reach a response DTO or the stored history, which doc 19 §7
// forbids and which no amount of care at the call site would keep true over time.
//
// `accepted` means the transport took responsibility for the message. It does NOT mean the mail
// reached an inbox, escaped a spam filter, or was read — see the `SENT` definition on the entity.
export type ReplyDeliveryOutcome =
  | { readonly accepted: true; readonly providerMessageId: string | null }
  | { readonly accepted: false };

// Builds and dispatches the two contact emails. Content lives here, in the module that owns the
// contact domain; MailService owns delivery only.
//
// LOCALE (documented limitation): the Contact intake carries NO locale signal — `CreateContactMessageDto`
// has name/email/phone/subject/body plus the two anti-spam fields, and `ContactIntakeContext` carries
// only user-agent and referrer. Both emails are therefore written in the API's default locale, `en`
// (the same default `LocaleQueryDto` applies). The alternatives were rejected rather than overlooked:
// sniffing `/ar/` out of the referrer or reading `Accept-Language` would invent a signal the contract
// does not carry, and the repo rule is no silent locale fallback. Localizing the acknowledgement
// properly requires an explicit `locale` field on the intake DTO, which is an OpenAPI contract change
// governed by doc 16 §3 and out of this lane's scope.
@Injectable()
export class ContactMailService {
  private readonly logger = new Logger(ContactMailService.name);

  constructor(
    private readonly mail: MailService,
    private readonly config: AppConfigService,
  ) {}

  // Called AFTER the database commit, detached from the request (contact.service.ts). Resolves on
  // every path and never rejects: the visitor's submission is already stored and already answered,
  // so there is no caller left to handle an error — only a log to write.
  async dispatchForSubmission(row: ContactMessage): Promise<void> {
    if (!this.mail.isEnabled) {
      return;
    }

    try {
      const ownerResult = await this.mail.send(
        this.buildOwnerNotification(row),
        row.id,
      );
      if (ownerResult.status === 'failed') {
        // The stored row is the authoritative record, so a failed notification degrades the
        // owner's latency, not the platform's integrity. Stated explicitly so the log line is
        // read as a delivery fault rather than a lost message.
        this.logger.warn(
          `Owner notification undelivered for message ${row.id}; the message is stored and ` +
            `readable in the dashboard inbox.`,
        );
      }

      // Only reachable when the visitor supplied an email — a phone-only submission (D02-10) has
      // no address to acknowledge to, and the API does not send SMS.
      const acknowledgement = this.buildVisitorAcknowledgement(row);
      if (acknowledgement !== null) {
        await this.mail.send(acknowledgement, row.id);
      }
    } catch (error: unknown) {
      // MailService contracts not to throw; this is the backstop that keeps that contract from
      // being load-bearing for the detached dispatch. Only the message is logged, never the error
      // object (which carries transport config, doc 19 §7).
      this.logger.error(
        `Contact mail dispatch failed for message ${row.id}: ` +
          (error instanceof Error ? error.message : 'Unknown error.'),
      );
    }
  }

  // Builds the operator's reply to a visitor (D02-13). CONTENT only — this method sends nothing;
  // it is the message the delivery step will hand to `MailService.send`. It lives here because this
  // module already owns contact mail content while MailService owns delivery, and extending that
  // seam is what the boundary asks for rather than a second reply-specific mail service.
  //
  // THE RECIPIENT INVARIANT, in code (D19-12): `to` is `message.email` and there is no parameter,
  // field or fallback through which a caller could supply a different address. The parameter type
  // requires an already-narrowed message, so the address is not merely unvalidated-but-trusted —
  // it is the only value in scope that could be used.
  //
  // Public so that the invariant is directly assertable by a test rather than only observable
  // through an endpoint that would also have to be authenticated, permitted and persisted first.
  buildReply(
    message: RepliableContactMessage,
    body: string,
    providerIdempotencyKey: string,
  ): MailMessage {
    return {
      to: message.email,
      subject: deriveReplySubject(message.subject),
      // The operator's text, verbatim. Not templated, not wrapped in a signature block, and not
      // given an "automated message" disclaimer — unlike the acknowledgement below, this IS a
      // person writing to a person, and decorating it would misrepresent who wrote it.
      text: body,
      // Required, not optional, on this path: a reply is the one send this API may legitimately
      // RE-ATTEMPT after an ambiguous outcome, and without the key that re-attempt would be a
      // second email to a real person. Typed as a required parameter so a caller cannot omit it —
      // the alternative, an optional field defaulted here, would fail silently and invisibly.
      providerIdempotencyKey,
    };
  }

  // Sends one reply and reports only what the reply domain persists.
  //
  // The reply path differs from the notification path in the one way that matters: an operator
  // explicitly asked for this email and is waiting on its outcome, so this IS awaited, and the
  // caller records what it concluded. `dispatchForSubmission` above stays detached and best-effort;
  // extending this service must never make a visitor's contact submission wait on SMTP (§4).
  //
  // `MailService.send` contracts not to throw, so a provider failure arrives here as a VALUE and
  // never as an exception — which is what keeps raw transport text out of ProblemDetails by
  // construction rather than by remembering to catch it (§22).
  //
  // The backstop below keeps that contract from being LOAD-BEARING, which is the same reason
  // `dispatchForSubmission` has one. The difference is what it does with the failure: that path
  // swallows, because its database write already committed and no caller is left. This one
  // RE-THROWS, sanitized, because the reply's outcome is genuinely unknown at that point and the
  // caller must be allowed to leave the attempt PENDING rather than record a terminal state.
  async dispatchReply(
    message: RepliableContactMessage,
    body: string,
    providerIdempotencyKey: string,
    correlationId: string,
  ): Promise<ReplyDeliveryOutcome> {
    let result;
    try {
      result = await this.mail.send(
        this.buildReply(message, body, providerIdempotencyKey),
        correlationId,
      );
    } catch (error: unknown) {
      // Sanitized at the boundary. The original message is logged and then dropped: a raw
      // Nodemailer message reaching here would otherwise land in ProblemDetails' `detail` outside
      // production (all-exceptions.filter.ts), which is exactly the transport text §22 forbids.
      this.logger.error(
        `Reply ${correlationId} delivery raised unexpectedly: ` +
          (error instanceof Error ? error.message : 'Unknown error.'),
      );
      // `cause` carries the original for a debugger without publishing it: the filter's `detail`
      // is `exception.message` (this sanitized string) and its log line is `exception.stack`,
      // neither of which serializes a cause. So the chain is preserved where it is useful and
      // absent everywhere it would be a leak.
      throw new Error('Reply delivery failed unexpectedly.', { cause: error });
    }

    if (result.status === 'sent') {
      return {
        accepted: true,
        // `MailService` reports the literal string 'unknown' when a transport omits the id, which
        // is a fine thing to put in a log line and a lie to store in a column whose absence means
        // "we have no id". Normalized to null at this boundary — the one place that decides what
        // reaches the database — so no row ever claims 'unknown' is a provider message id.
        providerMessageId:
          result.messageId === 'unknown' ? null : result.messageId,
      };
    }

    // 'failed' and 'disabled' are both "the provider did not take this message", and the reply
    // domain treats them identically: there is no outcome to wait for and no external send to
    // protect against duplicating. They are logged apart because they mean different things to an
    // operator — a relay refused this message, versus this deployment sends no mail at all.
    if (result.status === 'disabled') {
      this.logger.warn(
        `Reply ${correlationId} not sent: mail is disabled in this deployment.`,
      );
    } else {
      // The reason string comes from `describeFailure`, which already reduces the error to its own
      // message and never the error object (which carries `auth.pass`). It is logged and NOWHERE
      // else — not persisted, not returned, not put in a response body (§22).
      this.logger.error(
        `Reply ${correlationId} not accepted by the transport after ` +
          `${result.attempts} attempt(s): ${result.reason}`,
      );
    }

    return { accepted: false };
  }

  // Owner notification. Carries the message and how to answer it — no secrets, no host names, no
  // transport detail: an inbox is not a trusted place to keep infrastructure facts (doc 19 §7).
  private buildOwnerNotification(row: ContactMessage): MailMessage {
    const to = this.config.mail.ownerNotificationTo;
    if (to === null) {
      // Unreachable while `mail.isEnabled` is true — the destination is validated as part of the
      // same env group — but typed as nullable, so the impossible case is named rather than cast.
      throw new Error('Mail is enabled without a notification destination.');
    }

    const lines = [
      'A new contact message was received.',
      '',
      `Name:     ${row.name}`,
      `Email:    ${orAbsent(row.email)}`,
      `Phone:    ${orAbsent(row.phone)}`,
      `Received: ${row.createdAt.toISOString()} (UTC)`,
      `Subject:  ${singleLine(row.subject)}`,
      '',
      'Message:',
      row.body,
      '',
      // The dashboard has an inbox LIST route and no per-message route, so this links to the
      // inbox and names the id rather than minting a deep link that would 404.
      `Open the inbox: ${this.config.publicWebUrl}/dashboard/messages`,
      `Message id: ${row.id}`,
    ];

    return {
      to,
      subject: `New contact message: ${singleLine(row.subject)}`,
      text: lines.join('\n'),
      // Replying in the mail client reaches the visitor directly — which is precisely how D02-4
      // says replies happen. Safe as a header: the address passed @IsEmail at the boundary.
      replyTo: row.email ?? undefined,
    };
  }

  // Visitor acknowledgement. Returns null when there is no address to send to.
  //
  // Deliberately promises NO response time: a personal site has one operator, and a commitment the
  // platform cannot keep is worse for the visitor than no commitment at all. It also echoes only
  // the subject the visitor themselves typed — never the message body, which would mail their own
  // words back to an address that is merely claimed, not verified.
  private buildVisitorAcknowledgement(row: ContactMessage): MailMessage | null {
    if (row.email === null || row.email.length === 0) {
      return null;
    }

    const lines = [
      `Hello ${row.name},`,
      '',
      'Thank you for getting in touch. This is an automated confirmation that your message has',
      'been received.',
      '',
      `Subject: ${singleLine(row.subject)}`,
      `Received: ${row.createdAt.toISOString()} (UTC)`,
      '',
      'There is no need to resend it — it is already with me, and I read every message personally.',
      '',
      'Eslam Muatamed',
      this.config.publicWebUrl,
      '',
      'This message was sent automatically; replies to it are not monitored.',
    ];

    return {
      to: row.email,
      subject: 'Your message has been received',
      text: lines.join('\n'),
    };
  }
}
