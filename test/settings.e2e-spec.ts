import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createE2eApp,
  envelopeData,
  httpServer,
  OWNER_EMAIL,
  OWNER_PASSWORD,
} from './utils/e2e-app';
import { loadApiSpec } from './utils/contract';

interface PublicSettings {
  siteName: string | null;
  availableLocales: string[];
  analytics: { provider: string; measurementId: string } | null;
}

interface AdminSettings {
  googleSiteVerification: string | null;
  analyticsEnabled: boolean;
}

describe('Settings (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;

  beforeAll(async () => {
    loadApiSpec();
    app = await createE2eApp();
    const login = await request(httpServer(app))
      .post('/api/v1/auth/login')
      .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
    ownerToken = envelopeData<{ accessToken: string }>(login).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns resolved public settings for a locale', async () => {
    const res = await request(httpServer(app))
      .get('/api/v1/settings/site?locale=en')
      .expect(200);

    expect(res).toSatisfyApiSpec();
    const data = envelopeData<PublicSettings>(res);
    expect(data).toHaveProperty('siteName');
    expect(data).toHaveProperty('availableLocales');
  });

  it('rejects an unknown locale with a contract-valid 400', async () => {
    const res = await request(httpServer(app))
      .get('/api/v1/settings/site?locale=zz')
      .expect(400);
    expect(res).toSatisfyApiSpec();
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('denies the admin surface without a token', async () => {
    const res = await request(httpServer(app))
      .get('/api/v1/admin/settings')
      .expect(401);
    expect(res).toSatisfyApiSpec();
  });

  it('lets the OWNER read and update the FR-DSH-052 head/tag fields', async () => {
    const read = await request(httpServer(app))
      .get('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(read).toSatisfyApiSpec();

    const patched = await request(httpServer(app))
      .patch('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        googleSiteVerification: 'google-e2e-token',
        analyticsProvider: 'ga4',
        analyticsMeasurementId: 'G-E2E',
        analyticsEnabled: true,
        customMetas: [{ name: 'theme-color', content: '#0b0b0f' }],
      })
      .expect(200);

    expect(patched).toSatisfyApiSpec();
    const admin = envelopeData<AdminSettings>(patched);
    expect(admin.googleSiteVerification).toBe('google-e2e-token');
    expect(admin.analyticsEnabled).toBe(true);

    // The enabled analytics tag now surfaces on the public read.
    const publicRead = await request(httpServer(app))
      .get('/api/v1/settings/site?locale=en')
      .expect(200);
    expect(envelopeData<PublicSettings>(publicRead).analytics).toEqual({
      provider: 'ga4',
      measurementId: 'G-E2E',
    });
  });

  it('rejects a custom meta with an injection-shaped name (422)', async () => {
    await request(httpServer(app))
      .patch('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ customMetas: [{ name: '<script>', content: 'x' }] })
      .expect(422);
  });
});
