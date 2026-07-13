import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createE2eApp, envelopeData, httpServer } from './utils/e2e-app';
import { loadApiSpec } from './utils/contract';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    loadApiSpec();
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports liveness in the standard envelope', async () => {
    const res = await request(httpServer(app))
      .get('/api/v1/health')
      .expect(200);
    expect(res).toSatisfyApiSpec();
    expect(envelopeData<{ status: string }>(res).status).toBe('ok');
  });

  it('reports database readiness once Postgres is up', async () => {
    const res = await request(httpServer(app))
      .get('/api/v1/health/ready')
      .expect(200);
    expect(envelopeData<{ database: string }>(res).database).toBe('up');
  });
});
