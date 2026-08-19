import { Logger } from '@nestjs/common';
import { Transporter } from 'nodemailer';
import { AppConfigService } from '../../config/app-config.service';
import { MailService } from './mail.service';
import { DEFAULT_RETRY_BACKOFF_MS } from './mail.transport';

const SMTP_PASSWORD = 'super-secret-relay-password';

// Only the two members MailService reads. Typed through the real class so a rename of `mail` or
// `publicWebUrl` breaks this spec rather than silently passing against a structural stand-in.
const config = (): AppConfigService =>
  ({
    mail: {
      enabled: true,
      smtp: {
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        user: 'relay-user',
      },
      from: 'no-reply@eslammuatamed.com',
      ownerNotificationTo: 'owner@eslammuatamed.com',
    },
  }) as unknown as AppConfigService;

// A Nodemailer rejection carries the transport options — including `auth.pass` — on the error, which
// is exactly why MailService must log `error.message` and never the error itself.
const smtpError = (message: string, responseCode?: number): Error =>
  Object.assign(new Error(message), {
    responseCode,
    auth: { user: 'relay-user', pass: SMTP_PASSWORD },
  });

const transport = (): Transporter =>
  ({ sendMail: jest.fn() }) as unknown as Transporter;

const sendMailOf = (t: Transporter): jest.Mock =>
  t.sendMail as unknown as jest.Mock;

// Zero backoff so the retry loop is driven by its own bound, not by the clock — the schedule itself
// is asserted separately against DEFAULT_RETRY_BACKOFF_MS.
const NO_DELAY: readonly number[] = [0, 0];

const message = {
  to: 'owner@eslammuatamed.com',
  subject: 'New contact message: Project inquiry',
  text: 'body',
};

describe('MailService', () => {
  describe('disabled transport', () => {
    it('reports disabled and sends nothing when SMTP is not configured', async () => {
      const service = new MailService(config(), null, NO_DELAY);

      expect(service.isEnabled).toBe(false);
      await expect(service.send(message, 'corr-1')).resolves.toEqual({
        status: 'disabled',
      });
    });
  });

  describe('send — success', () => {
    it('sends on the first attempt and returns the transport message id', async () => {
      const t = transport();
      sendMailOf(t).mockResolvedValue({ messageId: '<abc@relay>' });
      const service = new MailService(config(), t, NO_DELAY);

      const result = await service.send(message, 'corr-1');

      expect(result).toEqual({
        status: 'sent',
        messageId: '<abc@relay>',
        attempts: 1,
      });
      expect(sendMailOf(t)).toHaveBeenCalledTimes(1);
      expect(sendMailOf(t)).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'no-reply@eslammuatamed.com',
          to: 'owner@eslammuatamed.com',
          subject: 'New contact message: Project inquiry',
        }),
      );
    });

    it('still resolves when the transport omits a message id', async () => {
      const t = transport();
      sendMailOf(t).mockResolvedValue({});
      const service = new MailService(config(), t, NO_DELAY);

      await expect(service.send(message, 'corr-1')).resolves.toEqual({
        status: 'sent',
        messageId: 'unknown',
        attempts: 1,
      });
    });
  });

  describe('send — bounded retry', () => {
    it('retries a transient failure and succeeds on a later attempt', async () => {
      const t = transport();
      sendMailOf(t)
        .mockRejectedValueOnce(smtpError('ECONNRESET'))
        .mockResolvedValue({ messageId: '<retried@relay>' });
      const service = new MailService(config(), t, NO_DELAY);

      const result = await service.send(message, 'corr-1');

      expect(result).toEqual({
        status: 'sent',
        messageId: '<retried@relay>',
        attempts: 2,
      });
      expect(sendMailOf(t)).toHaveBeenCalledTimes(2);
    });

    // The bound is the point: a detached dispatch nobody is awaiting must stop on its own.
    it('stops after the bounded number of attempts and never throws', async () => {
      const t = transport();
      sendMailOf(t).mockRejectedValue(smtpError('Connection timeout', 421));
      const service = new MailService(config(), t, NO_DELAY);

      const result = await service.send(message, 'corr-1');

      expect(result).toEqual({
        status: 'failed',
        attempts: NO_DELAY.length + 1,
        reason: 'Connection timeout',
      });
      expect(sendMailOf(t)).toHaveBeenCalledTimes(NO_DELAY.length + 1);
    });

    it('does not retry a permanent 5xx rejection', async () => {
      const t = transport();
      sendMailOf(t).mockRejectedValue(
        smtpError('550 mailbox unavailable', 550),
      );
      const service = new MailService(config(), t, NO_DELAY);

      const result = await service.send(message, 'corr-1');

      expect(result).toEqual({
        status: 'failed',
        attempts: 1,
        reason: '550 mailbox unavailable',
      });
      expect(sendMailOf(t)).toHaveBeenCalledTimes(1);
    });

    it('ships a bounded default backoff schedule', () => {
      expect(DEFAULT_RETRY_BACKOFF_MS.length).toBeGreaterThan(0);
      expect(DEFAULT_RETRY_BACKOFF_MS.length).toBeLessThanOrEqual(3);
      const total = DEFAULT_RETRY_BACKOFF_MS.reduce((sum, ms) => sum + ms, 0);
      expect(total).toBeLessThanOrEqual(30_000);
    });

    // A pending backoff timer would keep the Node event loop — and the Jest worker — alive past
    // the suite, so shutdown must resolve the sleep rather than merely clear the timer.
    it('abandons a pending retry on shutdown instead of leaking a timer', async () => {
      const t = transport();
      sendMailOf(t).mockRejectedValue(smtpError('ECONNREFUSED'));
      const service = new MailService(config(), t, [5_000]);

      const pending = service.send(message, 'corr-1');
      await Promise.resolve();
      service.onModuleDestroy();

      const result = await pending;
      expect(result.status).toBe('failed');
    });
  });

  describe('logging — no secrets', () => {
    // The real risk is logging the caught error OBJECT: Nodemailer hangs the transport options,
    // password included, off its errors. Asserting across every level catches that directly.
    it('never writes the SMTP password or transport config to the logs', async () => {
      const written: string[] = [];
      const capture = (...args: unknown[]): void => {
        written.push(args.map((arg) => String(arg)).join(' '));
      };
      const spies = (['log', 'warn', 'error', 'debug'] as const).map((level) =>
        jest.spyOn(Logger.prototype, level).mockImplementation(capture),
      );

      const t = transport();
      sendMailOf(t).mockRejectedValue(
        smtpError('Invalid login: 535 auth failed'),
      );
      const service = new MailService(config(), t, NO_DELAY);
      await service.send(message, 'corr-1');

      const output = written.join('\n');
      expect(output).not.toContain(SMTP_PASSWORD);
      expect(output).not.toContain('smtp.example.com');
      expect(output).not.toContain('relay-user');
      // The failure itself is still reported — redaction must not become silence.
      expect(output).toContain('Invalid login: 535 auth failed');

      spies.forEach((spy) => spy.mockRestore());
    });
  });

  // The STRUCTURAL proof, at the transport seam rather than the domain one.
  //
  // Everything else about reply idempotency is domain logic and is tested against a fake
  // MailService. This block is the only place that answers a different question: does the REAL
  // production MailService actually put the provider's header on the wire? Nothing below reaches a
  // network — `sendMail` is a jest.fn() and the assertions are on the object handed to it.
  describe('provider idempotency header', () => {
    const sendMailArg = (t: Transporter): Record<string, unknown> =>
      sendMailOf(t).mock.calls[0]?.[0] as Record<string, unknown>;

    it('maps the provider-neutral key onto the Resend SMTP header, verbatim', async () => {
      const t = transport();
      sendMailOf(t).mockResolvedValue({ messageId: '<abc@relay>' });
      const service = new MailService(config(), t, NO_DELAY);

      await service.send(
        {
          to: 'visitor@example.com',
          subject: 'Re: Project inquiry',
          text: 'The operator’s reply, verbatim.',
          providerIdempotencyKey: 'contact-reply/reply-1',
        },
        'reply-1',
      );

      const arg = sendMailArg(t);
      // The exact header name. This string is the entire duplicate-send protection: a typo here
      // costs nothing at compile time, passes every domain test, and silently sends twice.
      expect(arg.headers).toEqual({
        'Resend-Idempotency-Key': 'contact-reply/reply-1',
      });
      // The rest of the reply message, asserted exactly rather than loosely — the recipient in
      // particular, which is the one field a defect here could turn into a leak.
      expect(arg.to).toBe('visitor@example.com');
      expect(arg.subject).toBe('Re: Project inquiry');
      expect(arg.text).toBe('The operator’s reply, verbatim.');
      // Plain text only, no HTML alternative, and nothing carbon-copied anywhere.
      expect(arg).not.toHaveProperty('html');
      expect(arg).not.toHaveProperty('cc');
      expect(arg).not.toHaveProperty('bcc');
      // The configured sender, never one the caller chose — `MailMessage` has no `from` at all.
      expect(arg.from).toBe('no-reply@eslammuatamed.com');
    });

    // §25. The notification path must not acquire the header as a side effect of the reply path
    // existing: those sends are independent logical operations, and a shared key would let the
    // provider suppress one of them as a duplicate of the other.
    //
    // Structural, not vacuous: `headers?.['…']` would read `undefined` on a message that HAS a
    // headers object with the wrong contents, so the assertion is that the property is absent from
    // the object's own keys — see the absent-vs-empty rule.
    it('attaches no header at all to a message that did not ask for one', async () => {
      const t = transport();
      sendMailOf(t).mockResolvedValue({ messageId: '<abc@relay>' });
      const service = new MailService(config(), t, NO_DELAY);

      await service.send(message, 'corr-1');

      const arg = sendMailArg(t);
      expect(Object.keys(arg)).not.toContain('headers');
      expect('headers' in arg).toBe(false);
    });

    // The header must survive the internal retry loop — which is the whole point of attaching it.
    // A retry that dropped the key would turn MailService's own resilience into a duplicate-send
    // mechanism: the first attempt may already have been accepted by the provider.
    it('repeats the same key on every retry', async () => {
      const t = transport();
      sendMailOf(t)
        .mockRejectedValueOnce(smtpError('451 try again'))
        .mockResolvedValue({ messageId: '<abc@relay>' });
      const service = new MailService(config(), t, NO_DELAY);

      await service.send(
        {
          to: 'visitor@example.com',
          subject: 'Re: Project inquiry',
          text: 'body',
          providerIdempotencyKey: 'contact-reply/reply-1',
        },
        'reply-1',
      );

      const keys = sendMailOf(t).mock.calls.map(
        (call) =>
          (call[0] as { headers?: Record<string, string> }).headers?.[
            'Resend-Idempotency-Key'
          ],
      );
      expect(keys).toEqual(['contact-reply/reply-1', 'contact-reply/reply-1']);
    });
  });
});
