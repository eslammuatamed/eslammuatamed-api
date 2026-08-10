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

  // D10-20 through the real query. The unit tests cover the mapper, but only a real read can
  // prove there is no cross-locale fallback: the EN category name genuinely exists in the
  // database here, and the AR response still must not contain it.
  describe('untranslated taxonomy (D10-20)', () => {
    // EN-only taxonomy plus a bilingual article: the article resolves in AR, its category
    // does not. This is the exact production shape — an editor publishes a translation before
    // the taxonomy label is translated.
    const enOnlyName = `EnOnlyCategory${unique}`;
    const enOnlySlug = `en-only-category-${unique}`;
    const enOnlyTagName = `EnOnlyTag${unique}`;
    const bilingualTagEnName = `BilingualTagEn${unique}`;
    const bilingualTagArName = `وسم-ثنائي-${unique}`;
    const enArticleSlug = `d1020-en-${unique}`;
    const arArticleSlug = `d1020-ar-${unique}`;

    beforeAll(async () => {
      const category = await request(httpServer(app))
        .post('/api/v1/admin/categories')
        .set(auth())
        .send({
          translations: [{ locale: 'en', name: enOnlyName, slug: enOnlySlug }],
        })
        .expect(201);
      const enOnlyCategoryId = envelopeData<{ id: string }>(category).id;

      const enOnlyTag = await request(httpServer(app))
        .post('/api/v1/admin/tags')
        .set(auth())
        .send({
          translations: [
            {
              locale: 'en',
              name: enOnlyTagName,
              slug: `en-only-tag-${unique}`,
            },
          ],
        })
        .expect(201);

      const bilingualTag = await request(httpServer(app))
        .post('/api/v1/admin/tags')
        .set(auth())
        .send({
          translations: [
            {
              locale: 'en',
              name: bilingualTagEnName,
              slug: `bilingual-tag-en-${unique}`,
            },
            {
              locale: 'ar',
              name: bilingualTagArName,
              slug: `bilingual-tag-ar-${unique}`,
            },
          ],
        })
        .expect(201);

      await request(httpServer(app))
        .post('/api/v1/admin/articles')
        .set(auth())
        .send({
          categoryId: enOnlyCategoryId,
          status: 'PUBLISHED',
          tagIds: [
            envelopeData<{ id: string }>(enOnlyTag).id,
            envelopeData<{ id: string }>(bilingualTag).id,
          ],
          translations: [
            {
              locale: 'en',
              title: `D10-20 ${unique}`,
              slug: enArticleSlug,
              excerpt: 'EN excerpt.',
              body: 'EN body.',
            },
            {
              locale: 'ar',
              title: `عشرون ${unique}`,
              slug: arArticleSlug,
              excerpt: 'مقتطف عربي.',
              body: 'محتوى عربي.',
            },
          ],
        })
        .expect(201);
    });

    it('returns the populated category when the requested locale has a translation', async () => {
      const res = await request(httpServer(app))
        .get(`/api/v1/articles/${enArticleSlug}?locale=en`)
        .expect(200);
      expect(res).toSatisfyApiSpec();

      const detail = envelopeData<{
        category: { id: string; name: string; slug: string } | null;
      }>(res);
      expect(detail.category).toMatchObject({
        name: enOnlyName,
        slug: enOnlySlug,
      });
    });

    it('keeps the article visible with category null when its translation is missing', async () => {
      const res = await request(httpServer(app))
        .get(`/api/v1/articles/${arArticleSlug}?locale=ar`)
        .expect(200);
      // The contract itself must admit the null — a stale schema would fail here.
      expect(res).toSatisfyApiSpec();

      const detail = envelopeData<{ title: string; category: unknown }>(res);
      // The article is returned, not hidden.
      expect(detail.title).toContain(`${unique}`);
      // Key present, value null — not an omitted key, not `{ name: '', slug: '' }`.
      expect(detail).toHaveProperty('category', null);
      expect(Object.keys(detail)).toContain('category');
    });

    it('never falls back to the EN category label on an AR read', async () => {
      const res = await request(httpServer(app))
        .get(`/api/v1/articles/${arArticleSlug}?locale=ar`)
        .expect(200);

      // The EN name and slug exist in the database; neither may appear in an AR response.
      expect(JSON.stringify(res.body)).not.toContain(enOnlyName);
      expect(JSON.stringify(res.body)).not.toContain(enOnlySlug);
    });

    it('omits an untranslated tag from the array rather than listing it blank', async () => {
      const res = await request(httpServer(app))
        .get(`/api/v1/articles/${arArticleSlug}?locale=ar`)
        .expect(200);
      expect(res).toSatisfyApiSpec();

      const detail = envelopeData<{
        tags: { name: string; slug: string }[];
      }>(res);
      // Exactly the tag that has an AR translation — the EN-only tag is absent, not blank.
      expect(detail.tags.map((tag) => tag.name)).toEqual([bilingualTagArName]);
      expect(detail.tags.every((tag) => tag.name !== '')).toBe(true);
    });

    it('applies the same rule on the list endpoint, not just the detail', async () => {
      const res = await request(httpServer(app))
        .get(`/api/v1/articles?locale=ar&perPage=50`)
        .expect(200);
      expect(res).toSatisfyApiSpec();

      const item = envelopeData<
        { slug: string; category: unknown; tags: { name: string }[] }[]
      >(res).find((article) => article.slug === arArticleSlug);
      expect(item).toBeDefined();
      expect(item).toHaveProperty('category', null);
      expect(item?.tags.map((tag) => tag.name)).toEqual([bilingualTagArName]);
    });
  });
});
