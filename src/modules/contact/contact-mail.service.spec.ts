import { ContactMessage } from '../../generated/prisma/client';
import { AppConfigService } from '../../config/app-config.service';
import { MailMessage, MailSendResult } from '../mail/mail-message';
import { MailService } from '../mail/mail.service';
import { ContactMailService } from './contact-mail.service';

const OWNER_TO = 'owner@eslammuatamed.com';

const message = (overrides: Partial<ContactMessage> = {}): ContactMessage => ({
  id: 'msg-1',
  name: 'Alex Morgan',
  email: 'alex@example.com',
  phone: null,
  subject: 'Project inquiry',
  body: 'I would like to discuss a Nuxt build.',
  isRead: false,
  isArchived: false,
  archivedAt: null,
  meta: {},
  createdAt: new Date('2026-01-01T09:30:00.000Z'),
  updatedAt: new Date('2026-01-01T09:30:00.000Z'),
  ...overrides,
});

const config = (): AppConfigService =>
  ({
    publicWebUrl: 'https://eslammuatamed.com',
    mail: {
      enabled: true,
      smtp: {
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        user: 'relay-user',
      },
      from: 'no-reply@eslammuatamed.com',
      ownerNotificationTo: OWNER_TO,
    },
  }) as unknown as AppConfigService;

interface MailStub {
  readonly service: MailService;
  readonly send: jest.Mock<Promise<MailSendResult>, [MailMessage, string]>;
}

const mailStub = (
  enabled = true,
  result: MailSendResult = { status: 'sent', messageId: '<id>', attempts: 1 },
): MailStub => {
  const send = jest.fn<Promise<MailSendResult>, [MailMessage, string]>(() =>
    Promise.resolve(result),
  );
  return {
    service: { isEnabled: enabled, send } as unknown as MailService,
    send,
  };
};

// Both sends, keyed by recipient, so an assertion never depends on call order.
const sentTo = (send: MailStub['send'], to: string): MailMessage => {
  const call = send.mock.calls.find(([mail]) => mail.to === to);
  if (call === undefined) {
    throw new Error(`No mail was sent to ${to}.`);
  }
  return call[0];
};

describe('ContactMailService', () => {
  describe('owner notification', () => {
    it('sends the message, both contact methods, the timestamp and an inbox link', async () => {
      const mail = mailStub();
      const service = new ContactMailService(mail.service, config());

      await service.dispatchForSubmission(message({ phone: '+201002785408' }));

      const owner = sentTo(mail.send, OWNER_TO);
      expect(owner.subject).toBe('New contact message: Project inquiry');
      expect(owner.text).toContain('Alex Morgan');
      expect(owner.text).toContain('alex@example.com');
      expect(owner.text).toContain('+201002785408');
      expect(owner.text).toContain('I would like to discuss a Nuxt build.');
      expect(owner.text).toContain('2026-01-01T09:30:00.000Z');
      expect(owner.text).toContain(
        'https://eslammuatamed.com/dashboard/messages',
      );
      expect(owner.text).toContain('msg-1');
    });

    // D02-4 says replies happen in the mail client; Reply-To is what makes that one action.
    it('sets Reply-To to the visitor address, and omits it when only a phone was supplied', async () => {
      const mail = mailStub();
      const service = new ContactMailService(mail.service, config());

      await service.dispatchForSubmission(message());
      expect(sentTo(mail.send, OWNER_TO).replyTo).toBe('alex@example.com');

      mail.send.mockClear();
      await service.dispatchForSubmission(
        message({ email: null, phone: '+201002785408' }),
      );
      expect(sentTo(mail.send, OWNER_TO).replyTo).toBeUndefined();
    });

    it('marks an absent contact method rather than rendering a blank field', async () => {
      const mail = mailStub();
      const service = new ContactMailService(mail.service, config());

      await service.dispatchForSubmission(message({ phone: null }));

      expect(sentTo(mail.send, OWNER_TO).text).toContain('Phone:    —');
    });

    // Header injection (doc 19 §6): the DTO trims and length-caps `subject` but permits newlines.
    it('collapses newlines in a visitor subject before it reaches a header', async () => {
      const mail = mailStub();
      const service = new ContactMailService(mail.service, config());

      await service.dispatchForSubmission(
        message({ subject: 'Inquiry\r\nBcc: attacker@example.com' }),
      );

      const owner = sentTo(mail.send, OWNER_TO);
      expect(owner.subject).not.toMatch(/[\r\n]/);
      expect(owner.subject).toBe(
        'New contact message: Inquiry Bcc: attacker@example.com',
      );
    });

    it('leaks no transport or infrastructure detail into the message', async () => {
      const mail = mailStub();
      const service = new ContactMailService(mail.service, config());

      await service.dispatchForSubmission(message());

      const owner = sentTo(mail.send, OWNER_TO);
      expect(owner.text).not.toContain('smtp.example.com');
      expect(owner.text).not.toContain('relay-user');
      expect(owner.text).not.toContain('465');
    });
  });

  describe('visitor acknowledgement', () => {
    it('confirms receipt without promising a response time', async () => {
      const mail = mailStub();
      const service = new ContactMailService(mail.service, config());

      await service.dispatchForSubmission(message());

      const visitor = sentTo(mail.send, 'alex@example.com');
      expect(visitor.subject).toBe('Your message has been received');
      expect(visitor.text).toContain('Alex Morgan');
      expect(visitor.text).toContain('received');
      // The specific failure this guards: any commitment about WHEN a reply arrives.
      expect(visitor.text).not.toMatch(
        /within \d|24 hours|48 hours|business day|as soon as possible|shortly|get back to you/i,
      );
    });

    // The address is claimed, not verified, so the visitor's own words are not mailed back to it.
    it('echoes the subject but never the message body', async () => {
      const mail = mailStub();
      const service = new ContactMailService(mail.service, config());

      await service.dispatchForSubmission(message());

      const visitor = sentTo(mail.send, 'alex@example.com');
      expect(visitor.text).toContain('Project inquiry');
      expect(visitor.text).not.toContain(
        'I would like to discuss a Nuxt build.',
      );
    });

    it('is skipped for a phone-only submission, while the owner is still notified', async () => {
      const mail = mailStub();
      const service = new ContactMailService(mail.service, config());

      await service.dispatchForSubmission(
        message({ email: null, phone: '+201002785408' }),
      );

      expect(mail.send).toHaveBeenCalledTimes(1);
      expect(sentTo(mail.send, OWNER_TO)).toBeDefined();
    });
  });

  describe('failure handling', () => {
    it('sends nothing at all when mail is disabled', async () => {
      const mail = mailStub(false);
      const service = new ContactMailService(mail.service, config());

      await service.dispatchForSubmission(message());

      expect(mail.send).not.toHaveBeenCalled();
    });

    // A failed owner notification must not abandon the acknowledgement, and vice versa: the two
    // emails have different recipients and different failure causes.
    it('still sends the acknowledgement after the owner notification fails', async () => {
      const mail = mailStub(true, {
        status: 'failed',
        attempts: 3,
        reason: 'ECONNREFUSED',
      });
      const service = new ContactMailService(mail.service, config());

      await expect(
        service.dispatchForSubmission(message()),
      ).resolves.toBeUndefined();
      expect(mail.send).toHaveBeenCalledTimes(2);
    });

    // The detached dispatch has no caller left to handle a rejection.
    it('resolves rather than rejecting when the mail layer throws', async () => {
      const send = jest.fn(() =>
        Promise.reject(new Error('transport exploded')),
      );
      const service = new ContactMailService(
        { isEnabled: true, send } as unknown as MailService,
        config(),
      );

      await expect(
        service.dispatchForSubmission(message()),
      ).resolves.toBeUndefined();
    });
  });
});
