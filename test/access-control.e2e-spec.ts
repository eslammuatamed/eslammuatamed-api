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

// End-to-end RBAC (doc 18 §2, FR-DSH-090): a custom role's grants are enforced per request,
// the OWNER system role is protected, and the catalog is read-only. Requires a seeded database.
describe('Access control (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  const unique = Date.now();

  const owner = (): Record<string, string> => ({
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
    await app.close();
  });

  it('serves the read-only permission catalog', async () => {
    const res = await request(httpServer(app))
      .get('/api/v1/admin/permissions')
      .set(owner())
      .expect(200);
    expect(res).toSatisfyApiSpec();
    expect(envelopeData<{ permissions: string[] }>(res).permissions).toContain(
      'categories.read',
    );
  });

  it('refuses to edit the OWNER system role (422)', async () => {
    const roles = await request(httpServer(app))
      .get('/api/v1/admin/roles')
      .set(owner())
      .expect(200);
    const ownerRole = envelopeData<
      { id: string; name: string; isSystem: boolean }[]
    >(roles).find((role) => role.isSystem && role.name === 'OWNER');
    expect(ownerRole).toBeDefined();
    await request(httpServer(app))
      .patch(`/api/v1/admin/roles/${ownerRole?.id}`)
      .set(owner())
      .send({ description: 'tampered' })
      .expect(422);
  });

  it('enforces a custom role’s grants per request (allow read, deny create)', async () => {
    // A role that can only read categories.
    const roleRes = await request(httpServer(app))
      .post('/api/v1/admin/roles')
      .set(owner())
      .send({ name: `CatReader ${unique}`, permissions: ['categories.read'] })
      .expect(201);
    const roleId = envelopeData<{ id: string }>(roleRes).id;

    // A user holding it.
    const email = `catreader-${unique}@example.com`;
    const password = 'change-me-minimum-12';
    await request(httpServer(app))
      .post('/api/v1/admin/users')
      .set(owner())
      .send({ email, password, roleId })
      .expect(201);

    const login = await request(httpServer(app))
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const token = envelopeData<{ accessToken: string }>(login).accessToken;
    const auth = { Authorization: `Bearer ${token}` };

    // Granted read succeeds; ungranted create is forbidden with a contract-valid 403.
    await request(httpServer(app))
      .get('/api/v1/admin/categories')
      .set(auth)
      .expect(200);
    const forbidden = await request(httpServer(app))
      .post('/api/v1/admin/categories')
      .set(auth)
      .send({
        translations: [{ locale: 'en', name: 'X', slug: `x-${unique}` }],
      })
      .expect(403);
    expect(forbidden).toSatisfyApiSpec();
    expect(forbidden.headers['content-type']).toContain(
      'application/problem+json',
    );
  });

  it('rejects an unknown permission key when creating a role (422)', async () => {
    await request(httpServer(app))
      .post('/api/v1/admin/roles')
      .set(owner())
      .send({ name: `Bogus ${unique}`, permissions: ['articles.frobnicate'] })
      .expect(422);
  });

  // D09-7, operator-facing half: the removed keys are not merely absent from the catalog
  // listing, they are no longer grantable. Before the removal this request returned 201 and
  // handed back a role that silently conferred nothing.
  it('refuses to grant a capability that authorizes no route (422)', async () => {
    // `seo.update` used to be in this list and is deliberately no longer: the static-page SEO routes
    // shipped (FR-DSH-051, D10-24), so it now authorizes something real and MUST be grantable. It
    // moves to the positive case below rather than just being dropped, so the pair records that the
    // key did not disappear — its status changed. `seo.create`/`seo.delete` take its place here,
    // since the closed page set means no route will ever enforce them.
    for (const removed of [
      'articles.publish',
      'seo.create',
      'seo.delete',
      'users.delete',
    ]) {
      await request(httpServer(app))
        .post('/api/v1/admin/roles')
        .set(owner())
        .send({ name: `Removed ${removed} ${unique}`, permissions: [removed] })
        .expect(422);
    }
  });

  // The other half of D09-7 at the operator boundary: a key whose route exists must be grantable,
  // or the guard on that route is unreachable by any custom role.
  it('grants the static-page SEO capabilities now that routes enforce them (201)', async () => {
    const res = await request(httpServer(app))
      .post('/api/v1/admin/roles')
      .set(owner())
      .send({
        name: `SEO editor ${unique}`,
        permissions: ['seo.read', 'seo.update'],
      })
      .expect(201);
    expect(res).toSatisfyApiSpec();
  });

  // The wildcard is unchanged by D19-8: it is a grant that matches every capability, not a
  // capability a route declares, so it stays grantable while never appearing in the catalog.
  it('still accepts the "*" wildcard grant', async () => {
    const res = await request(httpServer(app))
      .post('/api/v1/admin/roles')
      .set(owner())
      .send({ name: `Wildcard ${unique}`, permissions: ['*'] })
      .expect(201);
    expect(envelopeData<{ permissions: string[] }>(res).permissions).toEqual([
      '*',
    ]);
  });
});
