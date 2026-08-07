import { Provider } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';
import { AppConfigService } from '../../config/app-config.service';

// DI token for the Nodemailer transport. `null` is a first-class value: it is what "mail is not
// configured" looks like to MailService, so the disabled path is a plain null check rather than a
// scatter of `config.mail.enabled` reads at every call site.
export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');

// The retry backoff schedule, in milliseconds — one entry per RETRY, so attempts = length + 1.
// Injected rather than hard-coded so specs can drive the retry loop with zero delay instead of
// waiting on real timers (or mocking the clock, which would couple every mail spec to fake timers).
export const MAIL_RETRY_BACKOFF_MS = Symbol('MAIL_RETRY_BACKOFF_MS');

// Two retries over ~10 seconds, then give up. Bounded because this runs detached from an HTTP
// request that has already returned 200: an unbounded or long-tailed retry would keep the process
// holding work nobody is waiting for, and the database row — the authoritative record — is already
// safe. A relay that is still refusing after ten seconds is down, not busy, and the owner reads the
// message in the dashboard either way.
export const DEFAULT_RETRY_BACKOFF_MS: readonly number[] = [2_000, 8_000];

// Nodemailer does not open a connection here — `createTransport` only builds a pooled client — so
// this factory is safe at boot and keeps `contract:export` (which boots Nest with no database and
// no mail config) working. Credentials come from the isolated `smtpCredentials` getter and never
// touch the loggable `mail` object.
export const mailTransportProvider: Provider = {
  provide: MAIL_TRANSPORT,
  inject: [AppConfigService],
  useFactory: (config: AppConfigService): Transporter | null => {
    const { enabled, smtp } = config.mail;
    if (!enabled || smtp === null) {
      return null;
    }
    const { user, password } = config.smtpCredentials;
    return createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user, pass: password },
    });
  },
};

export const mailRetryBackoffProvider: Provider = {
  provide: MAIL_RETRY_BACKOFF_MS,
  useValue: DEFAULT_RETRY_BACKOFF_MS,
};
