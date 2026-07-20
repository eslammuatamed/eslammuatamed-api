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

// Preview-token mint + consume (doc 18 §2, D10-8/D10-11/D19-7, FR-PUB-046). Requires a migrated +
// seeded eslammuatamed_test database. The token is the sole visibility gate: any invalid/expired/
// tampered/absent/wrong-type token yields 404 (never 401/403/500), so a draft is indistinguishable
// from an absent one.
interface MintedToken {
  readonly token: string;
  readonly url: string;
  readonly expiresAt: string;
}

describe('Preview (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let categoryId: string;
  let articleId: string;
  let draftSlug: string;
  let validToken: string;
  let consumeUrl: string;
  const unique = Date.now();

  const auth = (): Record<string, string> => ({
    Authorization: `Bearer ${ownerToken}`,
  });

  const mintArticleToken = (): request.Test =>
    request(httpServer(app))
      .post(`/api/v1/admin/articles/${articleId}/preview-token`)
      .set(auth());

  beforeAll(async () => {
    loadApiSpec();
    app = await createE2eApp();

    const login = await request(httpServer(app))
      .post('/api/v1/auth/login')
      .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
    ownerToken = envelopeData<{ accessToken: string }>(login).accessToken;

    const categories = await request(httpServer(app))
      .get('/api/v1/admin/categories')
      .set(auth());
    categoryId = envelopeData<{ id: string }[]>(categories)[0]?.id ?? '';

    draftSlug = `e2e-preview-draft-${unique}`;
    const created = await request(httpServer(app))
      .post('/api/v1/admin/articles')
      .set(auth())
      .send({
        categoryId,
        status: 'DRAFT',
        translations: [
          {
            locale: 'en',
            title: `E2E preview draft ${unique}`,
            slug: draftSlug,
            excerpt: 'Preview fixture draft.',
            body: '# Draft\n\nOpaque markdown body for the preview fixture.',
          },
        ],
      })
      .expect(201);
    articleId = envelopeData<{ id: string }>(created).id;

    const minted = await mintArticleToken().expect(200);
    const body = envelopeData<MintedToken>(minted);
    validToken = body.token;
    consumeUrl = body.url;
  });

  afterAll(async () => {
    await app.close();
  });

  it('mints a preview token (200 {token,url,expiresAt}) with no-store for an articles.update holder', async () => {
    const res = await mintArticleToken().expect(200);
    expect(res).toSatisfyApiSpec();
    const body = envelopeData<MintedToken>(res);
    expect(body.token).toEqual(expect.any(String));
    expect(body.url).toBe(
      `/api/v1/preview/articles/${articleId}?token=${body.token}`,
    );
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    // A credential must never land in a shared cache.
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('rejects an unauthenticated mint with a contract-valid 401', async () => {
    const res = await request(httpServer(app))
      .post(`/api/v1/admin/articles/${articleId}/preview-token`)
      .expect(401);
    expect(res).toSatisfyApiSpec();
  });

  it('returns the draft entity with no-store for a valid token', async () => {
    const res = await request(httpServer(app))
      .get(`${consumeUrl}&locale=en`)
      .expect(200);
    expect(res).toSatisfyApiSpec();
    const detail = envelopeData<{ id: string; slug: string }>(res);
    expect(detail.id).toBe(articleId);
    expect(detail.slug).toBe(draftSlug);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('returns 404 for a tampered token (MAC no longer authentic)', async () => {
    const last = validToken.slice(-1);
    const tampered = `${validToken.slice(0, -1)}${last === 'A' ? 'B' : 'A'}`;
    const res = await request(httpServer(app))
      .get(`/api/v1/preview/articles/${articleId}?token=${tampered}&locale=en`)
      .expect(404);
    expect(res).toSatisfyApiSpec();
  });

  it('returns 404 for a cross-type token (article token on the projects route)', async () => {
    // The article's own token, presented on the projects route for the same id: verify('project',…)
    // recomputes the MAC over a different entityType and fails before any DB access → 404.
    const res = await request(httpServer(app))
      .get(
        `/api/v1/preview/projects/${articleId}?token=${validToken}&locale=en`,
      )
      .expect(404);
    expect(res).toSatisfyApiSpec();
  });

  it('returns 404 (never 500) for an absent token', async () => {
    const res = await request(httpServer(app))
      .get(`/api/v1/preview/articles/${articleId}?locale=en`)
      .expect(404);
    expect(res).toSatisfyApiSpec();
  });

  it('returns 404 (never 500) for a garbage token', async () => {
    const res = await request(httpServer(app))
      .get(
        `/api/v1/preview/articles/${articleId}?token=not-a-real-token&locale=en`,
      )
      .expect(404);
    expect(res).toSatisfyApiSpec();
  });

  it('keeps the draft 404 on the normal public slug route regardless of any token', async () => {
    const res = await request(httpServer(app))
      .get(`/api/v1/articles/${draftSlug}?locale=en`)
      .expect(404);
    expect(res).toSatisfyApiSpec();
  });

  it('forbids minting for a token lacking articles.update with a contract-valid 403', async () => {
    const roleRes = await request(httpServer(app))
      .post('/api/v1/admin/roles')
      .set(auth())
      .send({ name: `PreviewReader ${unique}`, permissions: ['articles.read'] })
      .expect(201);
    const roleId = envelopeData<{ id: string }>(roleRes).id;

    const email = `preview-reader-${unique}@example.com`;
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
    const token = envelopeData<{ accessToken: string }>(login).accessToken;

    const res = await request(httpServer(app))
      .post(`/api/v1/admin/articles/${articleId}/preview-token`)
      .set({ Authorization: `Bearer ${token}` })
      .expect(403);
    expect(res).toSatisfyApiSpec();
    expect(res.headers['content-type']).toContain('application/problem+json');
  });
});
