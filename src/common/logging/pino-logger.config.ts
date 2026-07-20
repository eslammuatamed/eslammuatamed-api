import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Params } from 'nestjs-pino';
import { AppConfigService } from '../../config/app-config.service';

// Mask the value of a `token` query parameter in a request URL so capability tokens
// (the HMAC preview tokens, D19-7 — carried as `?token=` on the public preview routes)
// never reach the logs (constitution rule 5, doc 19 §6/§7). Matches `?token=`/`&token=`
// case-insensitively and replaces the value up to the next `&`/`#`; `?tokenish=` and a
// literal `token=` inside another value are not affected (the param name must be exactly
// `token` immediately after a `?`/`&`). Exported for direct unit testing.
export function maskUrlToken(url: string | undefined): string | undefined {
  if (url === undefined) return url;
  return url.replace(/([?&]token=)[^&#]*/gi, '$1[Redacted]');
}

// The request shape pino-http hands the serializer: the raw node message plus the id it
// stamped via genReqId.
type LoggedRequest = IncomingMessage & { id?: string };

// Structured logging (D07-5): JSON in production, pretty in development, silent in tests.
// Sensitive fields are redacted — no tokens, cookies, or passwords ever reach the logs
// (constitution rule 5, doc 19 §6). Request IDs correlate a request's log lines.
export function buildPinoOptions(config: AppConfigService): Params {
  const level = config.isTest
    ? 'silent'
    : config.isProduction
      ? 'info'
      : 'debug';

  return {
    pinoHttp: {
      level,
      genReqId: (req: IncomingMessage): string => {
        const header = req.headers['x-request-id'];
        return typeof header === 'string' && header.length > 0
          ? header
          : randomUUID();
      },
      // Replace pino-http's default req serializer: it auto-logs `req.url` AND a raw
      // `req.query` object, both of which would carry the preview `?token=` secret into
      // the logs. We log the masked URL and deliberately omit the separate `query`/`params`
      // objects so no token value is ever emitted. Header secrets are still handled by the
      // `redact` paths below.
      serializers: {
        req(req: LoggedRequest): Record<string, unknown> {
          return {
            id: req.id,
            method: req.method,
            url: maskUrlToken(req.url),
            headers: req.headers,
            remoteAddress: req.socket?.remoteAddress,
          };
        },
      },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
          'req.body.password',
          'req.body.currentPassword',
          'req.body.newPassword',
        ],
        censor: '[Redacted]',
      },
      transport: config.isDevelopment
        ? {
            target: 'pino-pretty',
            options: { singleLine: true, translateTime: 'SYS:standard' },
          }
        : undefined,
    },
  };
}
