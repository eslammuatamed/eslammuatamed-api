import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Params } from 'nestjs-pino';
import { AppConfigService } from '../../config/app-config.service';

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
