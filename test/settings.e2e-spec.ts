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
  availabilityStatus: string | null;
  availableLocales: string[];
  analytics: { provider: string; measurementId: string } | null;
  careerStartYear: number | null;
  careerStartMonth: number | null;
}

interface AdminSettings {
  googleSiteVerification: string | null;
  analyticsEnabled: boolean;
  careerStartYear: number | null;
  careerStartMonth: number | null;
}

describe('Settings (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let originalCareerStart:
    Pick<AdminSettings, 'careerStartYear' | 'careerStartMonth'> | undefined;

  beforeAll(async () => {
    loadApiSpec();
    app = await createE2eApp();
    const login = await request(httpServer(app))
      .post('/api/v1/auth/login')
      .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
    ownerToken = envelopeData<{ accessToken: string }>(login).accessToken;

    const initial = await request(httpServer(app))
      .get('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(initial).toSatisfyApiSpec();
    const initialSettings = envelopeData<AdminSettings>(initial);
    originalCareerStart = {
      careerStartYear: initialSettings.careerStartYear,
      careerStartMonth: initialSettings.careerStartMonth,
    };
  });

  afterAll(async () => {
    if (originalCareerStart) {
      const restored = await request(httpServer(app))
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(originalCareerStart)
        .expect(200);
      expect(restored).toSatisfyApiSpec();
    }
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

  it.each([
    ['en', 'Open to frontend opportunities'],
    ['ar', 'متاح لفرص عمل في تطوير الواجهات الأمامية'],
  ] as const)(
    'returns the deterministic %s availability translation',
    async (locale, expectedAvailability) => {
      const res = await request(httpServer(app))
        .get(`/api/v1/settings/site?locale=${locale}`)
        .expect(200);

      expect(res).toSatisfyApiSpec();
      expect(envelopeData<PublicSettings>(res).availabilityStatus).toBe(
        expectedAvailability,
      );
    },
  );

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
    expect(publicRead).toSatisfyApiSpec();
    expect(envelopeData<PublicSettings>(publicRead).analytics).toEqual({
      provider: 'ga4',
      measurementId: 'G-E2E',
    });
  });

  it('rejects a custom meta with an injection-shaped name (422)', async () => {
    const res = await request(httpServer(app))
      .patch('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ customMetas: [{ name: '<script>', content: 'x' }] })
      .expect(422);
    expect(res).toSatisfyApiSpec();
  });

  it('sets the career start pair and exposes both fields publicly', async () => {
    const patched = await request(httpServer(app))
      .patch('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ careerStartYear: 2021, careerStartMonth: 4 })
      .expect(200);
    expect(patched).toSatisfyApiSpec();
    expect(envelopeData<AdminSettings>(patched)).toMatchObject({
      careerStartYear: 2021,
      careerStartMonth: 4,
    });

    const publicRead = await request(httpServer(app))
      .get('/api/v1/settings/site?locale=en')
      .expect(200);
    expect(publicRead).toSatisfyApiSpec();
    expect(envelopeData<PublicSettings>(publicRead)).toMatchObject({
      careerStartYear: 2021,
      careerStartMonth: 4,
    });
  });

  it('rejects a PATCH with only one career start field', async () => {
    const baseline = await request(httpServer(app))
      .patch('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ careerStartYear: null, careerStartMonth: null })
      .expect(200);
    expect(baseline).toSatisfyApiSpec();

    const partial = await request(httpServer(app))
      .patch('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ careerStartYear: 2022 })
      .expect(422);
    expect(partial).toSatisfyApiSpec();
  });

  it('rejects careerStartMonth=13 with a contract-valid 422', async () => {
    const res = await request(httpServer(app))
      .patch('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ careerStartYear: 2022, careerStartMonth: 13 })
      .expect(422);

    expect(res).toSatisfyApiSpec();
  });

  it('clears both career start fields to null', async () => {
    const populated = await request(httpServer(app))
      .patch('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ careerStartYear: 2020, careerStartMonth: 8 })
      .expect(200);
    expect(populated).toSatisfyApiSpec();

    const cleared = await request(httpServer(app))
      .patch('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ careerStartYear: null, careerStartMonth: null })
      .expect(200);
    expect(cleared).toSatisfyApiSpec();
    expect(envelopeData<AdminSettings>(cleared)).toMatchObject({
      careerStartYear: null,
      careerStartMonth: null,
    });

    const publicRead = await request(httpServer(app))
      .get('/api/v1/settings/site?locale=en')
      .expect(200);
    expect(publicRead).toSatisfyApiSpec();
    expect(envelopeData<PublicSettings>(publicRead)).toMatchObject({
      careerStartYear: null,
      careerStartMonth: null,
    });
  });
});
