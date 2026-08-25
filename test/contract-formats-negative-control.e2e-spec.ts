import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createE2eApp, httpServer } from './utils/e2e-app';
import { loadApiSpec } from './utils/contract';

// TEMPORARY CI NEGATIVE CONTROL — do not merge. Asserts a response fixture that violates
// `format: uuid` against the real committed contract; the enforced matcher must fail CI
// with "must match format \"uuid\"". Reverted before merge.
describe('NEGATIVE CONTROL: uuid fixture must be rejected (temporary)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    loadApiSpec();
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects portraitAssetId="not-a-uuid" in the settings/site envelope', async () => {
    const res = await request(httpServer(app))
      .get('/api/v1/settings/site')
      .expect(200);
    const corrupted = structuredClone(
      res.body as { data: Record<string, unknown>; meta?: unknown },
    );
    corrupted.data.portraitAssetId = 'not-a-uuid';
    expect(
      expect({
        status: 200,
        body: corrupted,
        text: JSON.stringify(corrupted),
        req: { method: 'GET', path: '/api/v1/settings/site' },
      }).toSatisfyApiSpec(),
    ).toBeUndefined();
  });
});
