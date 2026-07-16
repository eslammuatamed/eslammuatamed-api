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

describe('Related articles (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let categoryId: string;
  const createdArticleIds: string[] = [];
  const unique = Date.now();
  const sourceSlug = `e2e-related-source-${unique}`;
  const relatedSlug = `e2e-related-target-${unique}`;

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

    const categories = await request(httpServer(app))
      .get('/api/v1/admin/categories')
      .set(auth());
    categoryId = envelopeData<{ id: string }[]>(categories)[0]?.id ?? '';
  });

  afterAll(async () => {
    for (const id of createdArticleIds) {
      const removed = await request(httpServer(app))
        .delete(`/api/v1/admin/articles/${id}`)
        .set(auth())
        .expect(204);
      expect(removed).toSatisfyApiSpec();
    }
    await app.close();
  });

  const article = (tag: string, slug: string) => ({
    categoryId,
    status: 'PUBLISHED',
    translations: [
      {
        locale: 'en',
        title: `E2E Related ${tag} ${unique}`,
        slug,
        excerpt: `E2E related ${tag} excerpt.`,
        body: `# ${tag}\n\nE2E related article body.`,
      },
    ],
  });

  it('returns published related items from the same category and excludes the source', async () => {
    const source = await request(httpServer(app))
      .post('/api/v1/admin/articles')
      .set(auth())
      .send(article('Source', sourceSlug))
      .expect(201);
    createdArticleIds.push(envelopeData<{ id: string }>(source).id);
    expect(source).toSatisfyApiSpec();

    const related = await request(httpServer(app))
      .post('/api/v1/admin/articles')
      .set(auth())
      .send(article('Target', relatedSlug))
      .expect(201);
    createdArticleIds.push(envelopeData<{ id: string }>(related).id);
    expect(related).toSatisfyApiSpec();

    const res = await request(httpServer(app))
      .get(`/api/v1/articles/${sourceSlug}/related?locale=en`)
      .expect(200);
    expect(res).toSatisfyApiSpec();

    const slugs = envelopeData<{ slug: string }[]>(res).map(
      (item) => item.slug,
    );
    expect(slugs).toContain(relatedSlug);
    expect(slugs).not.toContain(sourceSlug);
  });

  it('returns a contract-valid 404 for an unknown source slug', async () => {
    const res = await request(httpServer(app))
      .get(`/api/v1/articles/missing-related-${unique}/related?locale=en`)
      .expect(404);

    expect(res).toSatisfyApiSpec();
  });
});
