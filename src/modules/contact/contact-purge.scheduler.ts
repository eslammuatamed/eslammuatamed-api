import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ContactService } from './contact.service';

// Retention window (doc 19 §6, D19-10): archived contact messages are purged 12 months after
// archival. A named constant so the window lives in one place and the boundary is unit-tested.
export const RETENTION_MONTHS = 12;

// The purge cutoff: `now` shifted back by the retention window. Computed on a copy so the caller's
// Date is never mutated; the purge query uses a strict `<`, so a row archived exactly at the
// boundary is retained (deleted only once it is strictly older than 12 months).
export function retentionCutoff(now: Date): Date {
  const cutoff = new Date(now.getTime());
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
  return cutoff;
}

// In-process cron (D07-3): once daily, hard-delete contact messages archived more than 12 months
// ago (doc 19 §6, D19-10). Correct for a single API instance (doc 07 §5); horizontal scaling would
// move this to a locked job. @nestjs/schedule auto-wraps @Cron handlers in try/catch, so a
// transient DB error is logged and retried next run rather than crashing the process. The log line
// carries the deleted COUNT only — never message contents (name/email/subject/body are PII, D07-5).
@Injectable()
export class ContactPurgeScheduler {
  private readonly logger = new Logger(ContactPurgeScheduler.name);

  constructor(private readonly contact: ContactService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async purgeExpiredMessages(): Promise<void> {
    const purged = await this.contact.purgeArchivedOlderThan(
      retentionCutoff(new Date()),
    );
    if (purged > 0) {
      this.logger.log(
        `Purged ${purged} archived contact message(s) older than ${RETENTION_MONTHS} months.`,
      );
    }
  }
}
