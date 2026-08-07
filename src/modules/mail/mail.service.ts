import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Transporter } from 'nodemailer';
import { AppConfigService } from '../../config/app-config.service';
import { MailMessage, MailSendResult } from './mail-message';
import { MAIL_RETRY_BACKOFF_MS, MAIL_TRANSPORT } from './mail.transport';

// A permanent SMTP rejection: 5xx means the relay has decided, and a retry re-sends the same
// message to the same address for the same verdict. Retrying it would triple the load on a
// mailbox that has already said no — and, for a 550, look like a retry storm to the relay's abuse
// heuristics. 4xx (and a bare connection error, which carries no code) are transient and retried.
function isPermanentRejection(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const code: unknown = (error as { responseCode?: unknown }).responseCode;
  return typeof code === 'number' && code >= 500 && code < 600;
}

// Only the error's own message is ever logged — never the error object, which for Nodemailer
// carries the full transport options including `auth.pass` (doc 19 §7, constitution rule 5).
function describeFailure(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Unknown mail transport error.';
}

// The single outbound-email door. Owns delivery mechanics only — retry, logging, the enabled/
// disabled state — and knows nothing about contacts, so message CONTENT stays in the domain module
// that owns it (contact-mail.service.ts).
//
// `send` never throws. Mail here is always a side effect of a database write that has already
// committed, so a delivery failure is something to record, not something to propagate: a throw
// would invite a caller to treat a stored message as un-stored (doc 19 §6).
@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);

  // Pending backoff sleeps, resolved (not just cleared) on shutdown so an in-flight retry loop
  // finishes its turn and exits instead of leaving a promise that never settles and a timer that
  // keeps the event loop — and a Jest worker — alive.
  private readonly sleepers = new Set<{
    readonly timer: NodeJS.Timeout;
    readonly resolve: () => void;
  }>();
  private stopped = false;

  constructor(
    private readonly config: AppConfigService,
    @Inject(MAIL_TRANSPORT) private readonly transport: Transporter | null,
    @Inject(MAIL_RETRY_BACKOFF_MS)
    private readonly backoffMs: readonly number[],
  ) {}

  // True when the SMTP group is configured and validated. Callers use it to skip building a
  // message at all, so a deployment without mail does no work per submission.
  get isEnabled(): boolean {
    return this.transport !== null;
  }

  async send(
    message: MailMessage,
    correlationId: string,
  ): Promise<MailSendResult> {
    if (this.transport === null) {
      // Debug, not warn: mail being off is a deliberate configuration, not a fault.
      this.logger.debug(
        `Mail disabled; skipped sending "${message.subject}" [${correlationId}]`,
      );
      return { status: 'disabled' };
    }

    const from = this.config.mail.from;
    const maxAttempts = this.backoffMs.length + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const info: unknown = await this.transport.sendMail({
          from: from ?? undefined,
          to: message.to,
          replyTo: message.replyTo,
          subject: message.subject,
          text: message.text,
        });
        const messageId = readMessageId(info);
        // Recipient is deliberately absent: it is visitor PII on the acknowledgement path, and the
        // correlation id already ties this line to the stored message the owner can look up.
        this.logger.log(
          `Mail sent [${correlationId}] messageId=${messageId} attempt=${attempt}/${maxAttempts}`,
        );
        return { status: 'sent', messageId, attempts: attempt };
      } catch (error: unknown) {
        const reason = describeFailure(error);
        const permanent = isPermanentRejection(error);
        const exhausted = attempt === maxAttempts;

        if (permanent || exhausted || this.stopped) {
          this.logger.error(
            `Mail failed [${correlationId}] attempts=${attempt}/${maxAttempts} ` +
              `permanent=${permanent} reason=${reason}`,
          );
          return { status: 'failed', attempts: attempt, reason };
        }

        this.logger.warn(
          `Mail attempt failed [${correlationId}] attempt=${attempt}/${maxAttempts}, ` +
            `retrying: ${reason}`,
        );
        // `?? 0` satisfies the checked index access; the loop bound already guarantees an entry
        // exists on every non-exhausted attempt, so the fallback is never the value used.
        await this.sleep(this.backoffMs[attempt - 1] ?? 0);
      }
    }

    // Unreachable: the loop returns on every path. Present so the function is total rather than
    // relying on the compiler's flow analysis to agree with the loop bound.
    return {
      status: 'failed',
      attempts: maxAttempts,
      reason: 'Retry loop exhausted.',
    };
  }

  onModuleDestroy(): void {
    this.stopped = true;
    for (const sleeper of this.sleepers) {
      clearTimeout(sleeper.timer);
      sleeper.resolve();
    }
    this.sleepers.clear();
  }

  private sleep(ms: number): Promise<void> {
    if (ms <= 0 || this.stopped) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const sleeper = {
        timer: setTimeout(() => {
          this.sleepers.delete(sleeper);
          resolve();
        }, ms),
        resolve,
      };
      this.sleepers.add(sleeper);
    });
  }
}

// Nodemailer types `sendMail`'s result loosely across transports; the id is read defensively so a
// transport that omits it produces a log line rather than an exception on the success path.
function readMessageId(info: unknown): string {
  if (typeof info === 'object' && info !== null) {
    const id: unknown = (info as { messageId?: unknown }).messageId;
    if (typeof id === 'string' && id.length > 0) {
      return id;
    }
  }
  return 'unknown';
}
