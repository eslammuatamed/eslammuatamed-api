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

  // D19-11: there is no separate publish permission — articles.update confers publishing. This
  // proves it for a NON-owner role, which is the claim that matters: the removed articles.publish
  // key never gated this transition, so a role designed as "may edit but not publish" would not
  // have existed. Using the OWNER token here would prove nothing (the '*' wildcard matches
  // everything); the role below holds articles.update and nothing else.
  it('lets a role holding only articles.update publish an article (D19-11)', async () => {
    const roleRes = await request(httpServer(app))
      .post('/api/v1/admin/roles')
      .set(auth())
      .send({
        name: `Updater ${unique}`,
        permissions: ['articles.update'],
      })
      .expect(201);
    const roleId = envelopeData<{ id: string }>(roleRes).id;

    const email = `articles-updater-${unique}@example.com`;
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
    const updaterAuth = {
      Authorization: `Bearer ${envelopeData<{ accessToken: string }>(login).accessToken}`,
    };

    // OWNER creates the draft (the role cannot create — it holds update only).
    const created = await request(httpServer(app))
      .post('/api/v1/admin/articles')
      .set(auth())
      .send({
        categoryId,
        status: 'DRAFT',
        translations: [
          {
            locale: 'en',
            title: `Updater Fixture ${unique}`,
            slug: `updater-fixture-${unique}`,
            excerpt: 'Fixture for the D19-11 publishing model.',
            body: '# Heading\n\nBody content for the publishing-permission proof.',
          },
        ],
      })
      .expect(201);
    const id = envelopeData<{ id: string }>(created).id;

    // The status transition to PUBLISHED succeeds on articles.update alone.
    const published = await request(httpServer(app))
      .patch(`/api/v1/admin/articles/${id}`)
      .set(updaterAuth)
      .send({ status: 'PUBLISHED' })
      .expect(200);
    expect(published).toSatisfyApiSpec();
    expect(envelopeData<{ status: string }>(published).status).toBe(
      'PUBLISHED',
    );

    // And the article is now publicly reachable — publishing really happened.
    await request(httpServer(app))
      .get(`/api/v1/articles/updater-fixture-${unique}?locale=en`)
      .expect(200);

    // The same role still cannot delete: update is not a blanket articles grant.
    await request(httpServer(app))
      .delete(`/api/v1/admin/articles/${id}`)
      .set(updaterAuth)
      .expect(403);
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
