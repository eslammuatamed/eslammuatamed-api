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

describe('Skills (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let createdSkillId: string | undefined;
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
    if (createdSkillId) {
      const removed = await request(httpServer(app))
        .delete(`/api/v1/admin/skills/${createdSkillId}`)
        .set(auth())
        .expect(204);
      expect(removed).toSatisfyApiSpec();
    }
    await app.close();
  });

  it('lists public skills for a locale (contract-valid)', async () => {
    const res = await request(httpServer(app))
      .get('/api/v1/skills?locale=en')
      .expect(200);

    expect(res).toSatisfyApiSpec();
    expect(Array.isArray(envelopeData<unknown[]>(res))).toBe(true);
  });

  it('denies an admin route without a token', async () => {
    const res = await request(httpServer(app))
      .get('/api/v1/admin/skills')
      .expect(401);

    expect(res).toSatisfyApiSpec();
  });

  it('lets the OWNER create, get, list, update, and delete a skill', async () => {
    const created = await request(httpServer(app))
      .post('/api/v1/admin/skills')
      .set(auth())
      .send({
        group: 'FRAMEWORK',
        order: 9000,
        brandColor: '#7c3aed',
        translations: [{ locale: 'en', label: `E2E Skill ${unique}` }],
      })
      .expect(201);
    createdSkillId = envelopeData<{ id: string }>(created).id;
    expect(created).toSatisfyApiSpec();

    const read = await request(httpServer(app))
      .get(`/api/v1/admin/skills/${createdSkillId}`)
      .set(auth())
      .expect(200);
    expect(read).toSatisfyApiSpec();
    expect(envelopeData<{ id: string }>(read).id).toBe(createdSkillId);

    const listed = await request(httpServer(app))
      .get('/api/v1/admin/skills')
      .set(auth())
      .expect(200);
    expect(listed).toSatisfyApiSpec();
    expect(
      envelopeData<{ id: string }[]>(listed).some(
        (skill) => skill.id === createdSkillId,
      ),
    ).toBe(true);

    const updatedLabel = `Updated E2E Skill ${unique}`;
    const updated = await request(httpServer(app))
      .patch(`/api/v1/admin/skills/${createdSkillId}`)
      .set(auth())
      .send({
        brandColor: '#2563eb',
        translations: [{ locale: 'en', label: updatedLabel }],
      })
      .expect(200);
    expect(updated).toSatisfyApiSpec();
    expect(
      envelopeData<{ translations: { en: { label: string } } }>(updated)
        .translations.en.label,
    ).toBe(updatedLabel);

    const removed = await request(httpServer(app))
      .delete(`/api/v1/admin/skills/${createdSkillId}`)
      .set(auth())
      .expect(204);
    expect(removed).toSatisfyApiSpec();
    createdSkillId = undefined;
  });

  it('rejects an invalid create body with a contract-valid 422', async () => {
    const res = await request(httpServer(app))
      .post('/api/v1/admin/skills')
      .set(auth())
      .send({
        group: 'FRAMEWORK',
        order: 'first',
        translations: { locale: 'en', label: 'Invalid shape' },
      })
      .expect(422);

    expect(res).toSatisfyApiSpec();
  });
});
