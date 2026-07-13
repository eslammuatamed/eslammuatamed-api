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

// Content visibility and CRUD (doc 18 §2): the FR-PUB-046 drafts-404 assertion is the
// security-critical case. Requires a seeded database (categories from the seed).
describe('Articles (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let categoryId: string;
  const unique = Date.now();
  const slug = `e2e-article-${unique}`;

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
    await app.close();
  });

  const translation = () => ({
    locale: 'en',
    title: `E2E Article ${unique}`,
    slug,
    excerpt: 'An end-to-end fixture article.',
    body: '# Heading\n\nSome opaque markdown body content for the reading-time computation.',
  });

  it('lists published articles for a locale (contract-valid)', async () => {
    const res = await request(httpServer(app))
      .get('/api/v1/articles?locale=en')
      .expect(200);
    expect(res).toSatisfyApiSpec();
    expect(Array.isArray(envelopeData<unknown[]>(res))).toBe(true);
    expect(res.body).toHaveProperty('meta.totalPages');
  });

  it('keeps a draft invisible by direct slug (FR-PUB-046) then reveals it once published', async () => {
    const created = await request(httpServer(app))
      .post('/api/v1/admin/articles')
      .set(auth())
      .send({ categoryId, status: 'DRAFT', translations: [translation()] })
      .expect(201);
    expect(created).toSatisfyApiSpec();
    const id = envelopeData<{ id: string }>(created).id;

    // Draft: a direct slug lookup 404s exactly like an unknown slug — and that
    // problem+json 404 must satisfy the documented error contract.
    const draftLookup = await request(httpServer(app))
      .get(`/api/v1/articles/${slug}?locale=en`)
      .expect(404);
    expect(draftLookup).toSatisfyApiSpec();

    await request(httpServer(app))
      .patch(`/api/v1/admin/articles/${id}`)
      .set(auth())
      .send({ status: 'PUBLISHED' })
      .expect(200);

    const published = await request(httpServer(app))
      .get(`/api/v1/articles/${slug}?locale=en`)
      .expect(200);
    expect(published).toSatisfyApiSpec();
    const detail = envelopeData<{ slug: string; readingTimeMin: number }>(
      published,
    );
    expect(detail.slug).toBe(slug);
    expect(detail.readingTimeMin).toBeGreaterThanOrEqual(1);
  });

  it('rejects a duplicate slug in the same locale with a contract-valid 422', async () => {
    const conflict = await request(httpServer(app))
      .post('/api/v1/admin/articles')
      .set(auth())
      .send({ categoryId, translations: [translation()] })
      .expect(422);
    expect(conflict).toSatisfyApiSpec();
    expect(conflict.headers['content-type']).toContain(
      'application/problem+json',
    );
  });

  it('rejects a SCHEDULED article with a past publishAt (422)', async () => {
    await request(httpServer(app))
      .post('/api/v1/admin/articles')
      .set(auth())
      .send({
        categoryId,
        status: 'SCHEDULED',
        publishAt: '2000-01-01T00:00:00.000Z',
        translations: [{ ...translation(), slug: `${slug}-scheduled` }],
      })
      .expect(422);
  });

  it('full-text search returns matching articles, densest match ranked first (D09-6)', async () => {
    const term = 'searchword';
    const publish = (
      tag: string,
      title: string,
      excerpt: string,
    ): request.Test =>
      request(httpServer(app))
        .post('/api/v1/admin/articles')
        .set(auth())
        .send({
          categoryId,
          status: 'PUBLISHED',
          translations: [
            {
              locale: 'en',
              title,
              slug: `fts-${tag}-${unique}`,
              excerpt,
              body: 'Body content.',
            },
          ],
        })
        .expect(201);

    // Dense: term in the title and twice in the excerpt. Sparse: term once in the excerpt only.
    await publish(
      'dense',
      `${term} in the title ${unique}`,
      `${term} again and ${term} once more`,
    );
    await publish(
      'sparse',
      `Unrelated title ${unique}`,
      `mentions ${term} a single time`,
    );

    const res = await request(httpServer(app))
      .get(`/api/v1/articles?locale=en&q=${term}&perPage=50`)
      .expect(200);
    expect(res).toSatisfyApiSpec();

    const slugs = envelopeData<{ slug: string }[]>(res).map(
      (article) => article.slug,
    );
    const denseIdx = slugs.indexOf(`fts-dense-${unique}`);
    const sparseIdx = slugs.indexOf(`fts-sparse-${unique}`);
    expect(denseIdx).toBeGreaterThanOrEqual(0);
    expect(sparseIdx).toBeGreaterThanOrEqual(0);
    // ts_rank ranks the denser document ahead of the sparser one.
    expect(denseIdx).toBeLessThan(sparseIdx);
  });

  it('exposes a per-locale slug map on the detail response for locale switching (doc 10 §6)', async () => {
    const enSlug = `bilingual-en-${unique}`;
    const arSlug = `bilingual-ar-${unique}`;
    await request(httpServer(app))
      .post('/api/v1/admin/articles')
      .set(auth())
      .send({
        categoryId,
        status: 'PUBLISHED',
        translations: [
          {
            locale: 'en',
            title: `Bilingual ${unique}`,
            slug: enSlug,
            excerpt: 'EN excerpt.',
            body: 'EN body.',
          },
          {
            locale: 'ar',
            title: `ثنائي اللغة ${unique}`,
            slug: arSlug,
            excerpt: 'مقتطف عربي.',
            body: 'محتوى عربي.',
          },
        ],
      })
      .expect(201);

    const res = await request(httpServer(app))
      .get(`/api/v1/articles/${enSlug}?locale=en`)
      .expect(200);
    expect(res).toSatisfyApiSpec();

    const detail = envelopeData<{
      slugs: Record<string, string>;
      availableLocales: string[];
    }>(res);
    expect(detail.slugs).toEqual({ en: enSlug, ar: arSlug });
    // The map covers exactly the available locales — the frontend can switch to any of them.
    expect(Object.keys(detail.slugs).sort()).toEqual(
      [...detail.availableLocales].sort(),
    );
  });
});
