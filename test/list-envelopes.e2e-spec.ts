import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createE2eApp, envelopeData, httpServer } from './utils/e2e-app';
import { loadApiSpec } from './utils/contract';

// Issue #2: the non-paginated public list endpoints return `{ data: <Entity>[] }`. The OpenAPI
// must describe `data` as an array — the contract oracle (toSatisfyApiSpec) fails if it is
// documented as a single object (the pre-existing envelope inaccuracy this fix corrects).
describe('Non-paginated list envelopes (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    loadApiSpec();
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['locales', '/api/v1/locales'],
    ['categories', '/api/v1/categories?locale=en'],
    ['tags', '/api/v1/tags?locale=en'],
  ])('GET %s returns a contract-valid array envelope', async (_name, path) => {
    const res = await request(httpServer(app)).get(path).expect(200);
    expect(res).toSatisfyApiSpec();
    expect(Array.isArray(envelopeData(res))).toBe(true);
  });
});
