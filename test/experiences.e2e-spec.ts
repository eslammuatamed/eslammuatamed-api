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

  it('paginates the existing admin collection and leaves the public collection envelope unchanged', async () => {
    const older = await request(httpServer(app))
      .post('/api/v1/admin/experiences')
      .set(auth())
      .send(experience('Admin Page Older', '2098-01-01', 'FULL_TIME'))
      .expect(201);
    const olderId = envelopeData<{ id: string }>(older).id;
    createdExperienceIds.push(olderId);

    const newer = await request(httpServer(app))
      .post('/api/v1/admin/experiences')
      .set(auth())
      .send(experience('Admin Page Newer', '2099-01-01', 'FULL_TIME'))
      .expect(201);
    const newerId = envelopeData<{ id: string }>(newer).id;
    createdExperienceIds.push(newerId);

    const page1 = await request(httpServer(app))
      .get('/api/v1/admin/experiences?page=1&perPage=1')
      .set(auth())
      .expect(200);
    const page2 = await request(httpServer(app))
      .get('/api/v1/admin/experiences?page=2&perPage=1')
      .set(auth())
      .expect(200);
    const defaultPage = await request(httpServer(app))
      .get('/api/v1/admin/experiences')
      .set(auth())
      .expect(200);
    expect(page1).toSatisfyApiSpec();
    expect(page2).toSatisfyApiSpec();
    expect(defaultPage).toSatisfyApiSpec();
    expect(envelopeData<{ id: string }[]>(page1)).toEqual([
      expect.objectContaining({ id: newerId }),
    ]);
    expect(envelopeData<{ id: string }[]>(page2)).toEqual([
      expect.objectContaining({ id: olderId }),
    ]);
    expect(page1.body.meta).toEqual(
      expect.objectContaining({ page: 1, perPage: 1 }),
    );
    expect(page1.body.meta.totalPages).toBe(page1.body.meta.total);
    expect(defaultPage.body.meta).toEqual(
      expect.objectContaining({ page: 1, perPage: 12 }),
    );

    const publicList = await request(httpServer(app))
      .get('/api/v1/experiences?locale=en')
      .expect(200);
    expect(publicList).toSatisfyApiSpec();
    expect(publicList.body).not.toHaveProperty('meta');
    expect(
      envelopeData<PublicExperience[]>(publicList).some(
        (item) => item.id === newerId,
      ),
    ).toBe(true);
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

  it('rejects malformed pagination and a caller without experiences.read', async () => {
    for (const query of ['page=0', 'perPage=51', 'unknown=true']) {
      const invalid = await request(httpServer(app))
        .get(`/api/v1/admin/experiences?${query}`)
        .set(auth())
        .expect(422);
      expect(invalid).toSatisfyApiSpec();
    }

    const role = await request(httpServer(app))
      .post('/api/v1/admin/roles')
      .set(auth())
      .send({
        name: `ExperiencesReadDenied ${unique}`,
        permissions: ['experiences.update'],
      })
      .expect(201);
    const roleId = envelopeData<{ id: string }>(role).id;
    const email = `experiences-read-denied-${unique}@example.com`;
    const password = 'change-me-minimum-12';
    await request(httpServer(app))
      .post('/api/v1/admin/users')
      .set(auth())
      .send({ email, password, roleId })
      .expect(201);
    const login = await request(httpServer(app))
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    const forbidden = await request(httpServer(app))
      .get('/api/v1/admin/experiences?page=1')
      .set({
        Authorization: `Bearer ${envelopeData<{ accessToken: string }>(login).accessToken}`,
      })
      .expect(403);
    expect(forbidden).toSatisfyApiSpec();
  });
});
