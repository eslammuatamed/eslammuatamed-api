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
  gtmContainerId: string | null;
  careerStartYear: number | null;
  careerStartMonth: number | null;
}

interface AdminSettings {
  googleSiteVerification: string | null;
  analyticsEnabled: boolean;
  gtmContainerId: string | null;
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
        gtmContainerId: 'GTM-E2E1234',
        analyticsEnabled: true,
        customMetas: [{ name: 'theme-color', content: '#0b0b0f' }],
      })
      .expect(200);

    expect(patched).toSatisfyApiSpec();
    const admin = envelopeData<AdminSettings>(patched);
    expect(admin.googleSiteVerification).toBe('google-e2e-token');
    expect(admin.analyticsEnabled).toBe(true);
    expect(admin.gtmContainerId).toBe('GTM-E2E1234');

    // The enabled container now surfaces on the public read (D02-14).
    const publicRead = await request(httpServer(app))
      .get('/api/v1/settings/site?locale=en')
      .expect(200);
    expect(publicRead).toSatisfyApiSpec();
    expect(envelopeData<PublicSettings>(publicRead).gtmContainerId).toBe(
      'GTM-E2E1234',
    );
  });

  // ── GTM-only tracking contract (D02-14) ───────────────────────────────────────────────────────

  it('withholds the container from the public read once tracking is disabled', async () => {
    // Establishes its OWN precondition rather than inheriting the previous test's state, so the case
    // can be isolated with `-t`. Enabling first is also the control: the public read is proven to
    // carry the id, so the null below is the switch taking effect rather than an unconfigured row.
    await request(httpServer(app))
      .patch('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ gtmContainerId: 'GTM-E2E1234', analyticsEnabled: true })
      .expect(200);
    const enabledRead = await request(httpServer(app))
      .get('/api/v1/settings/site?locale=en')
      .expect(200);
    expect(envelopeData<PublicSettings>(enabledRead).gtmContainerId).toBe(
      'GTM-E2E1234',
    );

    await request(httpServer(app))
      .patch('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ analyticsEnabled: false })
      .expect(200);

    const publicRead = await request(httpServer(app))
      .get('/api/v1/settings/site?locale=en')
      .expect(200);
    expect(publicRead).toSatisfyApiSpec();
    expect(envelopeData<PublicSettings>(publicRead).gtmContainerId).toBeNull();

    // …while the admin surface still shows what is configured, so it can be switched back on.
    const admin = await request(httpServer(app))
      .get('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(envelopeData<AdminSettings>(admin).gtmContainerId).toBe(
      'GTM-E2E1234',
    );
  });

  it('rejects a malformed GTM container id (422)', async () => {
    const res = await request(httpServer(app))
      .patch('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ gtmContainerId: 'G-XXXXXXXXXX' })
      .expect(422);
    expect(res).toSatisfyApiSpec();
  });

  it('rejects enabling tracking without a container id (422)', async () => {
    // Clear first, then enable — the incoherent pair the public contract cannot express.
    await request(httpServer(app))
      .patch('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ analyticsEnabled: false, gtmContainerId: null })
      .expect(200);

    const res = await request(httpServer(app))
      .patch('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ analyticsEnabled: true })
      .expect(422);
    expect(res).toSatisfyApiSpec();
  });

  it('clears the container id with an explicit null (D10-23)', async () => {
    await request(httpServer(app))
      .patch('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ gtmContainerId: 'GTM-CLEAR99' })
      .expect(200);
    // CONTROL: prove it was actually set, or the null below could pass against an already-empty
    // column and assert nothing at all.
    const set = await request(httpServer(app))
      .get('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(envelopeData<AdminSettings>(set).gtmContainerId).toBe('GTM-CLEAR99');

    const cleared = await request(httpServer(app))
      .patch('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ gtmContainerId: null })
      .expect(200);
    expect(cleared).toSatisfyApiSpec();
    expect(envelopeData<AdminSettings>(cleared).gtmContainerId).toBeNull();
  });

  it('clears a verification token with an explicit null (D10-23)', async () => {
    // Same shape for the other withdrawable head/tag field, and self-contained for the same reason:
    // it SETS the token first so the null assertion cannot pass against an already-empty column.
    await request(httpServer(app))
      .patch('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ googleSiteVerification: 'google-e2e-token' })
      .expect(200);
    const before = await request(httpServer(app))
      .get('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(envelopeData<AdminSettings>(before).googleSiteVerification).toBe(
      'google-e2e-token',
    );

    const cleared = await request(httpServer(app))
      .patch('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ googleSiteVerification: null })
      .expect(200);
    expect(cleared).toSatisfyApiSpec();
    expect(
      envelopeData<AdminSettings>(cleared).googleSiteVerification,
    ).toBeNull();
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
