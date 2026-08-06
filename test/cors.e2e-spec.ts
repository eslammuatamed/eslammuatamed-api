import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createE2eApp, httpServer } from './utils/e2e-app';

// CORS policy (doc 19 §2, D10-15). The question this suite answers is NOT "does the API send
// Retry-After" — contact.e2e-spec.ts already asserts that — but "can the browser that receives it
// actually READ it". Those are different facts: a response header exists on the wire regardless of
// CORS, yet browser JS sees `null` for any header outside the CORS-safelisted set unless the server
// names it in `Access-Control-Expose-Headers`. Asserting the raw `retry-after` header alone would
// therefore pass even with the bug this correction fixes.
//
// Scope of the proof: supertest is not a browser, so what is proven here is that the response
// carries the exposure GRANT a browser requires, produced by buildCorsOptions() — the same object
// main.ts installs. The remaining half — JS actually reading the value — is proven in the Web
// repository's 429 test, where a real browser reads the header. The split is deliberate: the API
// repo has no browser lane and adding one for a single header would be disproportionate.
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
const FOREIGN_ORIGIN = 'https://attacker.example';

interface TrustProxyApp {
  set(setting: string, value: unknown): unknown;
}

// Splits the comma-separated header value, matching case-insensitively as browsers do.
function exposes(headerValue: string | undefined, name: string): boolean {
  return (headerValue ?? '')
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .includes(name.toLowerCase());
}

describe('CORS (e2e)', () => {
  let app: INestApplication;
  const unique = Date.now();

  // Throttle isolation, as contact.e2e-spec.ts documents: trust proxy on this suite's own Express
  // instance plus a pinned TEST-NET-3 IP per test, so the buckets this suite deliberately exhausts
  // never collide with each other or with another suite's.
  const validBody = (label: string): Record<string, unknown> => ({
    name: 'Alex Morgan',
    email: 'alex@example.com',
    subject: `E2E cors ${label} ${unique}`,
    body: 'A message long enough to be a real enquiry about a Nuxt build.',
    elapsedMs: 8200,
  });

  beforeAll(async () => {
    app = await createE2eApp({ corsOrigin: ALLOWED_ORIGIN });
    (app.getHttpAdapter().getInstance() as TrustProxyApp).set('trust proxy', 1);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('exposed headers', () => {
    it('names Retry-After in Access-Control-Expose-Headers on a throttled contact 429', async () => {
      const pinnedIp = '203.0.113.240';
      for (let i = 0; i < 3; i += 1) {
        await request(httpServer(app))
          .post('/api/v1/contact')
          .set('Origin', ALLOWED_ORIGIN)
          .set('X-Forwarded-For', pinnedIp)
          .send(validBody(`warm-${i}`))
          .expect(200);
      }

      const blocked = await request(httpServer(app))
        .post('/api/v1/contact')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-Forwarded-For', pinnedIp)
        .send(validBody('blocked'))
        .expect(429);

      // The header is on the wire…
      expect(blocked.headers['retry-after']).toBeDefined();
      // …AND the browser is granted permission to read it. This second assertion is the correction.
      expect(
        exposes(
          blocked.headers['access-control-expose-headers'],
          'Retry-After',
        ),
      ).toBe(true);
    });

    it('sends Retry-After as a positive whole number of seconds, never an HTTP-date', async () => {
      const pinnedIp = '203.0.113.241';
      for (let i = 0; i < 3; i += 1) {
        await request(httpServer(app))
          .post('/api/v1/contact')
          .set('Origin', ALLOWED_ORIGIN)
          .set('X-Forwarded-For', pinnedIp)
          .send(validBody(`unit-warm-${i}`))
          .expect(200);
      }

      const blocked = await request(httpServer(app))
        .post('/api/v1/contact')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-Forwarded-For', pinnedIp)
        .send(validBody('unit-blocked'))
        .expect(429);

      const raw = blocked.headers['retry-after'] as string;
      // Digits only is what rules out the HTTP-date form: RFC 9110 allows either delta-seconds or
      // an IMF-fixdate ("Wed, 21 Oct 2015 07:28:00 GMT"), and doc 19 §6 requires the former.
      // (`Date.parse` is not the discriminator here — it happily reads "3600" as a year.)
      expect(raw).toMatch(/^\d+$/);
      expect(raw).not.toMatch(/GMT|[A-Za-z]/);
      expect(Number.isInteger(Number(raw))).toBe(true);
      expect(Number(raw)).toBeGreaterThan(0);
      // An hourly window: the delay can never exceed it. Guards against a millisecond value being
      // emitted as if it were seconds.
      expect(Number(raw)).toBeLessThanOrEqual(3600);
    });

    it('exposes Retry-After and nothing else — exposure stays minimal', async () => {
      const res = await request(httpServer(app))
        .get('/api/v1/settings/site?locale=en')
        .set('Origin', ALLOWED_ORIGIN)
        .expect(200);

      const exposed = (res.headers['access-control-expose-headers'] ?? '')
        .split(',')
        .map((part: string) => part.trim())
        .filter(Boolean);
      expect(exposed).toEqual(['Retry-After']);
    });
  });

  // Regression guards: the exposure addition must not have loosened the origin allowlist or the
  // credentialed-request configuration the refresh cookie depends on (D19-3).
  describe('no origin or credentials regression', () => {
    it('echoes the exact allowed origin with credentials enabled', async () => {
      const res = await request(httpServer(app))
        .get('/api/v1/settings/site?locale=en')
        .set('Origin', ALLOWED_ORIGIN)
        .expect(200);

      expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('never answers "*" for the allowed origin', async () => {
      const res = await request(httpServer(app))
        .get('/api/v1/settings/site?locale=en')
        .set('Origin', ALLOWED_ORIGIN)
        .expect(200);

      expect(res.headers['access-control-allow-origin']).not.toBe('*');
    });

    it('does not grant a foreign origin', async () => {
      const res = await request(httpServer(app))
        .get('/api/v1/settings/site?locale=en')
        .set('Origin', FOREIGN_ORIGIN)
        .expect(200);

      expect(res.headers['access-control-allow-origin']).not.toBe(
        FOREIGN_ORIGIN,
      );
      expect(res.headers['access-control-allow-origin']).not.toBe('*');
    });

    it('answers a contact preflight for the allowed origin', async () => {
      const res = await request(httpServer(app))
        .options('/api/v1/contact')
        .set('Origin', ALLOWED_ORIGIN)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type');

      expect(res.status).toBeLessThan(300);
      expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });
  });
});
