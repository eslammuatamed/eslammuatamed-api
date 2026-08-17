import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createE2eApp, httpServer } from './utils/e2e-app';

// Audit-pass regression locks (doc 19). These assert that hardening
// controls stay in force, so a future change cannot silently weaken them:
//   - the doc 19 §5 request-body size limit (1 MiB JSON), and
//   - the doc 19 §6 auth-login throttle tier (5 / 15 min → 429 + Retry-After).
// The RFC 7807 5xx sanitization, log redaction, trusted-proxy client IP, health probes, and the
// contact/media 429 tiers are already covered by their own specs (all-exceptions.filter.spec,
// pino-logger.config.spec, {contact,upload}-throttler.guard.spec, health.e2e) and are referenced,
// not duplicated.
//
// Each e2e suite builds its own app (fresh in-memory throttle bucket) and the suite runs --runInBand,
// so the login-tier counter here never leaks into another suite.
describe('Hardening (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('request body size limit (doc 19 §5 — 1 MiB JSON)', () => {
    // A payload under 1 MiB must reach the app (parsed): it is rejected by field validation (422),
    // NOT by the body parser (413). Without the explicit 1 MiB limit registered at boot, the
    // framework default (~100 kB) would 413 this instead.
    it('accepts a JSON body under 1 MiB (parsed by the transport, not 413)', async () => {
      const halfMebibyteBody = 'x'.repeat(500 * 1024);

      const res = await request(httpServer(app))
        .post('/api/v1/contact')
        .set('Content-Type', 'application/json')
        .send({
          name: 'Alex',
          email: 'alex@example.com',
          subject: 'Large but valid transport',
          body: halfMebibyteBody,
          elapsedMs: 9000,
        });

      // The parser accepted it (no 413): the 500 KB `body` field then fails @MaxLength(5000) with a
      // 422 — a DTO concern, not the transport limit's. Asserted as 200|422 so a 5xx cannot pass.
      expect([200, 422]).toContain(res.status);
    });

    it('rejects a JSON body over 1 MiB as a 413 RFC 7807 problem+json', async () => {
      const overOneMebibyteBody = 'x'.repeat(1200 * 1024);

      const res = await request(httpServer(app))
        .post('/api/v1/contact')
        .set('Content-Type', 'application/json')
        .send({
          name: 'Alex',
          email: 'alex@example.com',
          subject: 'Oversized transport',
          body: overOneMebibyteBody,
          elapsedMs: 9000,
        });

      // Not merely 413 — the exception filter renders it as sanitized RFC 7807 (this locks the
      // filter's client-http-error branch, not a bare Express 413).
      expect(res.status).toBe(413);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect((res.body as { type?: string }).type).toBe(
        '/problems/payload-too-large',
      );
    });

    it('renders malformed JSON as a 400 RFC 7807 problem+json', async () => {
      // Nest maps the body-parser SyntaxError to a BadRequestException upstream; the filter still
      // emits application/problem+json (not a bare Express 400). Locks the envelope, not the detail.
      const res = await request(httpServer(app))
        .post('/api/v1/contact')
        .set('Content-Type', 'application/json')
        .send('{"name": "Alex", "email": ');

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
    });
  });

  describe('auth login throttle tier (doc 19 §6 — 5 / 15 min)', () => {
    it('returns 429 + Retry-After once the login tier is exceeded', async () => {
      const attempt = (): request.Test =>
        request(httpServer(app)).post('/api/v1/auth/login').send({
          email: 'nobody@example.com',
          password: 'wrong-password-123',
        });

      // The tier is 5 requests / 15 min per client IP; the first five are spent on invalid creds.
      const statuses: number[] = [];
      for (let i = 0; i < 5; i++) {
        const res = await attempt();
        statuses.push(res.status);
      }
      // Every pre-limit attempt was handled as an auth failure (401), never a 429.
      expect(statuses.every((s) => s === 401)).toBe(true);

      // The sixth attempt trips the throttle.
      const throttled = await attempt();
      expect(throttled.status).toBe(429);
      expect(throttled.headers['retry-after']).toBeDefined();
    });
  });
});
