import { AppConfigService } from '../../config/app-config.service';
import { buildPinoOptions, maskUrlToken } from './pino-logger.config';

// Guards constitution rule 5 / doc 19 §7: the preview `?token=` capability secret (D19-7)
// must never survive into a log line via pino-http's auto-logged request URL.
describe('maskUrlToken', () => {
  it('masks a token as the sole query param', () => {
    expect(maskUrlToken('/api/v1/preview/articles/abc?token=SECRET')).toBe(
      '/api/v1/preview/articles/abc?token=[Redacted]',
    );
  });

  it('masks a token as a leading query param, keeping later params', () => {
    expect(
      maskUrlToken('/api/v1/preview/articles/abc?token=SECRET&locale=en'),
    ).toBe('/api/v1/preview/articles/abc?token=[Redacted]&locale=en');
  });

  it('masks a token appearing after another param (&token=)', () => {
    expect(
      maskUrlToken('/api/v1/preview/projects/abc?locale=en&token=SECRET'),
    ).toBe('/api/v1/preview/projects/abc?locale=en&token=[Redacted]');
  });

  it('masks up to a fragment boundary', () => {
    expect(maskUrlToken('/x?token=SECRET#frag')).toBe(
      '/x?token=[Redacted]#frag',
    );
  });

  it('is case-insensitive on the param name', () => {
    expect(maskUrlToken('/x?TOKEN=SECRET')).toBe('/x?TOKEN=[Redacted]');
  });

  it('does not mask a param whose name merely starts with token', () => {
    expect(maskUrlToken('/x?tokenish=keepme')).toBe('/x?tokenish=keepme');
  });

  it('does not mask a literal "token=" inside another value', () => {
    expect(maskUrlToken('/x?note=token=abc')).toBe('/x?note=token=abc');
  });

  it('leaves a URL with no token untouched', () => {
    expect(maskUrlToken('/api/v1/articles/my-slug?locale=ar')).toBe(
      '/api/v1/articles/my-slug?locale=ar',
    );
  });

  it('passes through undefined', () => {
    expect(maskUrlToken(undefined)).toBeUndefined();
  });
});

// D07-5 / doc 19 §6: contact messages are visitor PII (name, email, subject, body). The custom
// `req` serializer replaces pino-http's default precisely so that no request body is emitted —
// this pins that guarantee for the contact intake specifically, so a future serializer change that
// re-adds `body` (as the pino-http default would) fails here rather than in production logs.
describe('request serializer — no contact PII reaches the logs (D07-5)', () => {
  const options = buildPinoOptions({
    isTest: true,
    isProduction: false,
    isDevelopment: false,
  } as unknown as AppConfigService);

  const serializeReq = (
    req: Record<string, unknown>,
  ): Record<string, unknown> => {
    const serializers = (
      options.pinoHttp as {
        serializers: {
          req(r: Record<string, unknown>): Record<string, unknown>;
        };
      }
    ).serializers;
    return serializers.req(req);
  };

  const contactRequest = (): Record<string, unknown> => ({
    id: 'req-1',
    method: 'POST',
    url: '/api/v1/contact',
    headers: { 'content-type': 'application/json' },
    socket: { remoteAddress: '203.0.113.7' },
    body: {
      name: 'Alex Morgan',
      email: 'alex@example.com',
      subject: 'Project inquiry',
      body: 'A confidential message about a Nuxt build.',
      website: '',
      elapsedMs: 8200,
    },
  });

  it('emits exactly id, method, url, headers and remoteAddress — never body', () => {
    expect(Object.keys(serializeReq(contactRequest())).sort()).toEqual([
      'headers',
      'id',
      'method',
      'remoteAddress',
      'url',
    ]);
  });

  it('leaks no contact field value anywhere in the serialized line', () => {
    const line = JSON.stringify(serializeReq(contactRequest()));
    for (const secret of [
      'Alex Morgan',
      'alex@example.com',
      'Project inquiry',
      'A confidential message about a Nuxt build.',
    ]) {
      expect(line).not.toContain(secret);
    }
  });

  it('drops the body even when the request carries no other identifying fields', () => {
    const serialized = serializeReq({
      url: '/api/v1/contact',
      body: { email: 'someone@example.com' },
    });
    expect(serialized).not.toHaveProperty('body');
    expect(JSON.stringify(serialized)).not.toContain('someone@example.com');
  });
});
