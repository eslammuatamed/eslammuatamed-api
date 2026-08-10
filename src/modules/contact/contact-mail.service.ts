import { Injectable, Logger } from '@nestjs/common';
import { ContactMessage } from '../../generated/prisma/client';
import { AppConfigService } from '../../config/app-config.service';
import { MailMessage } from '../mail/mail-message';
import { MailService } from '../mail/mail.service';

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
