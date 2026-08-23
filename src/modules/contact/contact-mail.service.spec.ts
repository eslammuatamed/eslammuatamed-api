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

  // D02-13: the recipient invariant, asserted at the one function that produces the outbound
  // message. `buildReply` is pure and takes no address, so these tests can prove the property
  // directly rather than inferring it from an endpoint that would also have to be authenticated,
  // permitted and persisted first.
  describe('reply content (buildReply)', () => {
    const repliable = (overrides: Partial<ContactMessage> = {}) =>
      message({ email: 'alex@example.com', ...overrides }) as ContactMessage & {
        email: string;
      };

    const PROVIDER_KEY = 'contact-reply/reply-1';

    it('addresses the reply to the message sender and nobody else', () => {
      const mail = mailStub();
      const service = new ContactMailService(mail.service, config());

      const built = service.buildReply(
        repliable({ email: 'visitor@example.com' }),
        'Thanks for reaching out.',
        PROVIDER_KEY,
      );

      expect(built.to).toBe('visitor@example.com');
    });

    // Discriminating: the address must come from THIS message, not from a configured constant.
    // A builder that hard-coded the owner address would pass a weaker assertion.
    it('derives the address per message rather than from configuration', () => {
      const mail = mailStub();
      const service = new ContactMailService(mail.service, config());

      const first = service.buildReply(
        repliable({ email: 'a@example.com' }),
        'x',
        PROVIDER_KEY,
      );
      const second = service.buildReply(
        repliable({ email: 'b@example.com' }),
        'x',
        PROVIDER_KEY,
      );

      expect([first.to, second.to]).toEqual(['a@example.com', 'b@example.com']);
      expect([first.to, second.to]).not.toContain(OWNER_TO);
    });

    // A reply must not silently invite the visitor to answer a third party, and no CC/BCC path
    // exists at all — MailMessage has no such fields, which is why this asserts the whole shape.
    it('sets no replyTo and carries no recipient field beyond `to`', () => {
      const mail = mailStub();
      const service = new ContactMailService(mail.service, config());

      const built = service.buildReply(repliable(), 'Thanks.', PROVIDER_KEY);

      expect(Object.keys(built).sort()).toEqual([
        'providerIdempotencyKey',
        'subject',
        'text',
        'to',
      ]);
      expect(built.replyTo).toBeUndefined();
    });

    // The key is carried provider-neutrally: the domain states "same logical email", and only
    // MailService knows which header expresses that. The provider's name must not appear here.
    it('carries the provider key without naming the provider', () => {
      const mail = mailStub();
      const service = new ContactMailService(mail.service, config());

      const built = service.buildReply(repliable(), 'Thanks.', PROVIDER_KEY);

      expect(built.providerIdempotencyKey).toBe(PROVIDER_KEY);
      expect(Object.keys(built)).not.toContain('headers');
      expect(JSON.stringify(built)).not.toContain('Resend');
    });

    it('derives the subject from the original and does not double the reply prefix', () => {
      const mail = mailStub();
      const service = new ContactMailService(mail.service, config());

      expect(
        service.buildReply(
          repliable({ subject: 'Website enquiry' }),
          'x',
          PROVIDER_KEY,
        ).subject,
      ).toBe('Re: Website enquiry');
      expect(
        service.buildReply(
          repliable({ subject: 'Re: Website enquiry' }),
          'x',
          PROVIDER_KEY,
        ).subject,
      ).toBe('Re: Website enquiry');
    });

    // The operator's words reach the visitor verbatim: this is a person writing to a person, not a
    // templated notification, so a signature block or an "automated message" footer would
    // misrepresent who wrote it.
    it('sends the operator text verbatim, with no template decoration', () => {
      const mail = mailStub();
      const service = new ContactMailService(mail.service, config());

      const body = 'Line one.\n\nLine two, with a link: https://example.com';
      expect(service.buildReply(repliable(), body, PROVIDER_KEY).text).toBe(
        body,
      );
    });

    // Content and delivery stay separate even now that delivery exists: `buildReply` describes an
    // email and `dispatchReply` sends one. Keeping the builder inert is what lets the recipient
    // invariant be asserted directly, with no transport, auth or persistence in the way.
    it('builds without sending', () => {
      const mail = mailStub();
      const service = new ContactMailService(mail.service, config());

      service.buildReply(repliable(), 'Thanks.', PROVIDER_KEY);

      expect(mail.send).not.toHaveBeenCalled();
    });
  });

  // The provider-neutral delivery result the reply domain persists.
  describe('reply delivery (dispatchReply)', () => {
    const repliable = (overrides: Partial<ContactMessage> = {}) =>
      message({ email: 'alex@example.com', ...overrides }) as ContactMessage & {
        email: string;
      };

    const PROVIDER_KEY = 'contact-reply/reply-1';

    const dispatch = (mail: MailStub) =>
      new ContactMailService(mail.service, config()).dispatchReply(
        repliable(),
        'Thanks.',
        PROVIDER_KEY,
        'reply-1',
      );

    it('reports acceptance and the transport message id', async () => {
      const mail = mailStub(true, {
        status: 'sent',
        messageId: '<abc@relay>',
        attempts: 1,
      });

      await expect(dispatch(mail)).resolves.toEqual({
        accepted: true,
        providerMessageId: '<abc@relay>',
      });
    });

    // `readMessageId` reports the literal string 'unknown' when a transport omits the id. That is
    // fine in a log line and a lie in a column whose absence means "we have no id" — so it is
    // normalized here. Asserted as `toBeNull()` rather than "not the real id", which 'unknown'
    // would also satisfy.
    it('normalizes an unknown transport id to null rather than storing the word', async () => {
      const mail = mailStub(true, {
        status: 'sent',
        messageId: 'unknown',
        attempts: 1,
      });

      await expect(dispatch(mail)).resolves.toEqual({
        accepted: true,
        providerMessageId: null,
      });
    });

    it('reports non-acceptance when the transport refuses', async () => {
      const mail = mailStub(true, {
        status: 'failed',
        attempts: 3,
        reason: 'ECONNREFUSED smtp.example.com:465',
      });

      await expect(dispatch(mail)).resolves.toEqual({ accepted: false });
    });

    // Mail being off is a deployment state, not a transient fault, but it is still "the provider
    // did not take this message" — and the reply domain has nothing to wait for either way.
    it('reports non-acceptance when mail is disabled, without attempting a send', async () => {
      const mail = mailStub(true, { status: 'disabled' });

      await expect(dispatch(mail)).resolves.toEqual({ accepted: false });
    });

    // §22 — the outcome the domain persists carries no transport text at all. The reason string
    // exists only in the log, so no response body or stored row can leak it.
    it('returns no provider diagnostics on failure', async () => {
      const mail = mailStub(true, {
        status: 'failed',
        attempts: 3,
        reason: 'ECONNREFUSED smtp.example.com:465',
      });

      const outcome = await dispatch(mail);

      expect(Object.keys(outcome)).toEqual(['accepted']);
      expect(JSON.stringify(outcome)).not.toContain('smtp.example.com');
      expect(JSON.stringify(outcome)).not.toContain('ECONNREFUSED');
    });

    // The backstop, and specifically what it does NOT do. An unexpected throw from the delivery
    // layer leaves the outcome unknown, so it must reach the caller — which keeps the attempt
    // PENDING and recoverable — while carrying none of the original transport text, which would
    // otherwise reach ProblemDetails' `detail` outside production.
    it('rethrows an unexpected transport error without its message', async () => {
      const mail = mailStub();
      mail.send.mockRejectedValue(
        Object.assign(new Error('Invalid login: 535 auth failed'), {
          auth: { user: 'relay-user', pass: 'super-secret-relay-password' },
        }),
      );
      const service = new ContactMailService(mail.service, config());

      await expect(
        service.dispatchReply(repliable(), 'Thanks.', PROVIDER_KEY, 'reply-1'),
      ).rejects.toThrow('Reply delivery failed unexpectedly.');

      // Not swallowed into a FAILED-shaped outcome: that would record a terminal state for a send
      // whose fate nobody knows, and close off the recovery that is still safe.
      await expect(
        service.dispatchReply(repliable(), 'Thanks.', PROVIDER_KEY, 'reply-1'),
      ).rejects.not.toMatchObject({ message: expect.stringContaining('535') });
    });

    // §4 — the regression that matters most about extending this shared service. The reply path is
    // awaited because an operator is waiting on its outcome; the visitor's submission path must
    // stay detached and best-effort, and must never acquire the reply's idempotency key.
    it('leaves the notification path unawaited in shape and free of a provider key', async () => {
      const mail = mailStub();
      const service = new ContactMailService(mail.service, config());

      await service.dispatchForSubmission(message());

      for (const [sent] of mail.send.mock.calls) {
        expect(Object.keys(sent)).not.toContain('providerIdempotencyKey');
      }
    });
  });
});
