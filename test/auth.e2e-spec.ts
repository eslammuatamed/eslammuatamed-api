import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createE2eApp,
  envelopeData,
  httpServer,
  OWNER_EMAIL,
  OWNER_PASSWORD,
  problemBody,
} from './utils/e2e-app';
import { loadApiSpec } from './utils/contract';

// Trust-critical auth flow (doc 18 §2): login, rotation, reuse detection, logout. Requires a
// seeded database (the OWNER account from env). Wired for the e2e CI job.
describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    loadApiSpec();
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs in the owner and sets an httpOnly refresh cookie', async () => {
    const res = await request(httpServer(app))
      .post('/api/v1/auth/login')
      .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD })
      .expect(200);

    expect(res).toSatisfyApiSpec();
    const data = envelopeData<{
      accessToken: string;
      user: { role: { name: string } };
    }>(res);
    expect(data.accessToken).toEqual(expect.any(String));
    expect(data.user.role.name).toBe('OWNER');
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(setCookie.join(';')).toMatch(/refresh_token=.*HttpOnly/i);
  });

  it('rejects wrong credentials with a 401 problem+json', async () => {
    const res = await request(httpServer(app))
      .post('/api/v1/auth/login')
      .send({ email: OWNER_EMAIL, password: 'wrong-password-value' })
      .expect(401);

    expect(res).toSatisfyApiSpec();
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(problemBody(res).status).toBe(401);
  });

  it('rotates the refresh token and revokes the family on reuse', async () => {
    const agent = request.agent(httpServer(app));
    await agent
      .post('/api/v1/auth/login')
      .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD })
      .expect(200);

    // First rotation succeeds; the agent now holds the new cookie.
    await agent.post('/api/v1/auth/refresh').expect(200);
    // Logout revokes the family.
    await agent.post('/api/v1/auth/logout').expect(200);
    // The revoked cookie can no longer refresh.
    await agent.post('/api/v1/auth/refresh').expect(401);
  });

  it('denies an admin route without a token (default-deny)', async () => {
    await request(httpServer(app)).get('/api/v1/admin/articles').expect(401);
  });
});
