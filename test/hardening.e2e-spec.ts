import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createE2eApp, httpServer } from './utils/e2e-app';

// Feature 005 audit-pass regression locks (doc 19). These assert that already-shipped hardening
// controls stay in force, so a future change cannot silently weaken them:
//   - the doc 19 §5 request-body size limit (1 MiB JSON — AD-7), and
//   - the doc 19 §6 auth-login throttle tier (5 / 15 min → 429 + Retry-After).
// The RFC 7807 5xx sanitization, log redaction, trusted-proxy client IP, health probes, and the
// contact/media 429 tiers are already covered by their own specs (all-exceptions.filter.spec,
// pino-logger.config.spec, {contact,upload}-throttler.guard.spec, health.e2e) and are referenced,
// not duplicated, in the Feature 005 closeout.
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

  describe('request body size limit (doc 19 §5, AD-7 — 1 MiB JSON)', () => {
    // A payload under 1 MiB must reach the app (parsed): it is rejected by field validation (422),
    // NOT by the body parser (413). Before AD-7 the framework default (~100 kB) would 413 this.
    it('accepts a JSON body under 1 MiB (parsed, not 413)', async () => {
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

      // The parser accepted it (no 413). Field-length validation may still reject the oversized
      // body field with 422 — that is the DTO's concern, not the transport limit's.
      expect(res.status).not.toBe(413);
    });

    it('rejects a JSON body over 1 MiB with 413 (payload too large)', async () => {
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

      expect(res.status).toBe(413);
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
