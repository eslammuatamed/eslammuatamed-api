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

interface PublicExperience {
  id: string;
  employmentType: string;
  startDate: string;
}

describe('Experiences (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  const createdExperienceIds: string[] = [];
  const unique = Date.now();

  const auth = (): Record<string, string> => ({
    Authorization: `Bearer ${ownerToken}`,
  });

  beforeAll(async () => {
    loadApiSpec();
    app = await createE2eApp();

    const login = await request(httpServer(app))
      .post('/api/v1/auth/login')
      .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
    ownerToken = envelopeData<{ accessToken: string }>(login).accessToken;
  });

  afterAll(async () => {
    for (const id of createdExperienceIds) {
      const removed = await request(httpServer(app))
        .delete(`/api/v1/admin/experiences/${id}`)
        .set(auth())
        .expect(204);
      expect(removed).toSatisfyApiSpec();
    }
    await app.close();
  });

  const experience = (
    tag: string,
    startDate: string,
    employmentType: string,
  ) => ({
    startDate,
    endDate: null,
    isCurrent: true,
    employmentType,
    order: 9000,
    translations: [
      {
        locale: 'en',
        role: `E2E ${tag} Engineer ${unique}`,
        company: `E2E Company ${unique}`,
        location: 'Remote',
        impact: `Delivered the ${tag} end-to-end fixture.`,
      },
    ],
  });

  it('exposes employmentType and orders public experiences newest first', async () => {
    const older = await request(httpServer(app))
      .post('/api/v1/admin/experiences')
      .set(auth())
      .send(experience('Older', '2035-01-01', 'CONTRACT'))
      .expect(201);
    const olderId = envelopeData<{ id: string }>(older).id;
    createdExperienceIds.push(olderId);
    expect(older).toSatisfyApiSpec();

    const newer = await request(httpServer(app))
      .post('/api/v1/admin/experiences')
      .set(auth())
      .send(experience('Newer', '2036-01-01', 'FULL_TIME'))
      .expect(201);
    const newerId = envelopeData<{ id: string }>(newer).id;
    createdExperienceIds.push(newerId);
    expect(newer).toSatisfyApiSpec();

    const publicList = await request(httpServer(app))
      .get('/api/v1/experiences?locale=en')
      .expect(200);
    expect(publicList).toSatisfyApiSpec();

    const experiences = envelopeData<PublicExperience[]>(publicList);
    const newerIndex = experiences.findIndex((item) => item.id === newerId);
    const olderIndex = experiences.findIndex((item) => item.id === olderId);
    expect(newerIndex).toBeGreaterThanOrEqual(0);
    expect(olderIndex).toBeGreaterThanOrEqual(0);
    expect(newerIndex).toBeLessThan(olderIndex);
    expect(experiences[newerIndex]?.employmentType).toBe('FULL_TIME');
    expect(experiences[newerIndex]?.startDate).toBe('2036-01-01T00:00:00.000Z');
  });

  it('rejects an invalid employmentType with a contract-valid 422', async () => {
    const res = await request(httpServer(app))
      .post('/api/v1/admin/experiences')
      .set(auth())
      .send(experience('Invalid', '2037-01-01', 'INTERNSHIP'))
      .expect(422);

    expect(res).toSatisfyApiSpec();
  });

  it('denies an admin route without a token', async () => {
    const res = await request(httpServer(app))
      .get('/api/v1/admin/experiences')
      .expect(401);

    expect(res).toSatisfyApiSpec();
  });
});
