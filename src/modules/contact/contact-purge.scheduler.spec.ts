import { Logger } from '@nestjs/common';
import {
  ContactPurgeScheduler,
  RETENTION_MONTHS,
  retentionCutoff,
} from './contact-purge.scheduler';
import { ContactService } from './contact.service';

describe('retentionCutoff (D19-10 boundary)', () => {
  it('is exactly RETENTION_MONTHS before now and never mutates the input', () => {
    const now = new Date('2026-07-20T12:00:00.000Z');

    const cutoff = retentionCutoff(now);

    expect(cutoff.toISOString()).toBe('2025-07-20T12:00:00.000Z');
    expect(RETENTION_MONTHS).toBe(12);
    // The caller's Date is untouched (computed on a copy).
    expect(now.toISOString()).toBe('2026-07-20T12:00:00.000Z');
  });

  it('classifies rows by the strict `<` boundary: 13mo purged, 11mo + exactly-12mo retained', () => {
    const now = new Date('2026-07-20T00:00:00.000Z');
    const cutoff = retentionCutoff(now);

    const archived13moAgo = new Date('2025-06-20T00:00:00.000Z');
    const archived11moAgo = new Date('2025-08-20T00:00:00.000Z');
    const archivedExactly12moAgo = new Date('2025-07-20T00:00:00.000Z');

    expect(archived13moAgo < cutoff).toBe(true); // eligible for purge
    expect(archived11moAgo < cutoff).toBe(false); // retained
    expect(archivedExactly12moAgo < cutoff).toBe(false); // retained (strict `<`)
  });
});

describe('ContactPurgeScheduler', () => {
  const buildContact = (purgedCount: number): ContactService =>
    ({
      purgeArchivedOlderThan: jest.fn().mockResolvedValue(purgedCount),
    }) as unknown as ContactService;

  afterEach(() => jest.restoreAllMocks());

  it('delegates to purgeArchivedOlderThan with a retention cutoff and logs a count-only line', async () => {
    const contact = buildContact(2);
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const scheduler = new ContactPurgeScheduler(contact);

    await scheduler.purgeExpiredMessages();

    const purge = contact.purgeArchivedOlderThan as jest.Mock;
    expect(purge).toHaveBeenCalledTimes(1);
    expect(purge.mock.calls[0][0]).toBeInstanceOf(Date);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = String(logSpy.mock.calls[0]?.[0]);
    expect(line).toContain('2');
    // No PII ever reaches the log line (D07-5).
    expect(line).not.toMatch(/@|email|name|subject|body/i);
  });

  it('stays silent when nothing was purged (no log noise)', async () => {
    const contact = buildContact(0);
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const scheduler = new ContactPurgeScheduler(contact);

    await scheduler.purgeExpiredMessages();

    expect(contact.purgeArchivedOlderThan).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
  });
});
