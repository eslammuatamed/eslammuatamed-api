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

// Redirect resolve + auto-on-published-rename (doc 18 §2, D04-6, D10-7). Requires a migrated +
// seeded eslammuatamed_test database (categories come from the seed).
//
// Slugs are run-unique (Date.now()): buildRedirectOps' final step creates SlugRedirect(fromSlug=old)
// under @@unique([locale, entityType, fromSlug]); hardcoded slugs would collide on a re-run against
// the never-reset test DB and fail the rename transaction.
describe('Redirects (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let categoryId: string;
  const unique = Date.now();

  const publishedFrom = `redirect-pub-a-${unique}`;
  const publishedTo = `redirect-pub-b-${unique}`;
  const missSlug = `redirect-absent-${unique}`;
  const draftFrom = `redirect-draft-c-${unique}`;
  const draftTo = `redirect-draft-d-${unique}`;
  const reuseA = `redirect-reuse-a-${unique}`;
  const reuseB = `redirect-reuse-b-${unique}`;
  const reuseC = `redirect-reuse-c-${unique}`;

  const auth = (): Record<string, string> => ({
    Authorization: `Bearer ${ownerToken}`,
  });

  const resolveUrl = (locale: string, path: string): string =>
    `/api/v1/redirects/resolve?locale=${locale}&path=${encodeURIComponent(path)}`;

  const articleBody = (
    slug: string,
    status: 'DRAFT' | 'PUBLISHED',
  ): Record<string, unknown> => ({
    categoryId,
    status,
    translations: [
      {
        locale: 'en',
        title: `E2E redirect ${slug}`,
        slug,
        excerpt: 'Redirect fixture article.',
        body: '# Heading\n\nOpaque markdown body for the redirect fixture.',
      },
    ],
  });

  const renameBody = (newSlug: string): Record<string, unknown> => ({
    translations: [
      {
        locale: 'en',
        title: `E2E redirect ${newSlug}`,
        slug: newSlug,
        excerpt: 'Redirect fixture article.',
        body: '# Heading\n\nOpaque markdown body for the redirect fixture.',
      },
    ],
  });

  const createArticle = async (
    slug: string,
    status: 'DRAFT' | 'PUBLISHED',
  ): Promise<string> => {
    const created = await request(httpServer(app))
      .post('/api/v1/admin/articles')
      .set(auth())
      .send(articleBody(slug, status))
      .expect(201);
    expect(created).toSatisfyApiSpec();
    return envelopeData<{ id: string }>(created).id;
  };

  const renameSlug = async (id: string, newSlug: string): Promise<void> => {
    await request(httpServer(app))
      .patch(`/api/v1/admin/articles/${id}`)
      .set(auth())
      .send(renameBody(newSlug))
      .expect(200);
  };

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

  it('resolves the old slug to the new one after a published rename, with no-store', async () => {
    const id = await createArticle(publishedFrom, 'PUBLISHED');
    await renameSlug(id, publishedTo);

    const res = await request(httpServer(app))
      .get(resolveUrl('en', `/blog/${publishedFrom}`))
      .expect(200);
    expect(res).toSatisfyApiSpec();
    expect(envelopeData<{ toPath: string }>(res)).toEqual({
      toPath: `/blog/${publishedTo}`,
    });
    // no-store overrides the doc 10 §5 public-GET cache (D10-7): a cached hit could serve a stale
    // target after a later rename.
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('returns a contract-valid 404 with no-store when no redirect matches', async () => {
    const res = await request(httpServer(app))
      .get(resolveUrl('en', `/blog/${missSlug}`))
      .expect(404);
    expect(res).toSatisfyApiSpec();
    expect(res.headers['content-type']).toContain('application/problem+json');
    // A cached 404 miss would mask a redirect created moments later (D04-6) — so no-store here too.
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('rejects a disabled locale with a contract-valid 400', async () => {
    // `de` is a valid two-letter format (clears the DTO @Matches) but is not an enabled locale, so
    // LocalesService.assertEnabled throws 400 — never a silent cross-locale fallback (D10-6).
    const res = await request(httpServer(app))
      .get(resolveUrl('de', `/blog/${publishedFrom}`))
      .expect(400);
    expect(res).toSatisfyApiSpec();
  });

  it('creates no redirect when a draft article is renamed', async () => {
    const id = await createArticle(draftFrom, 'DRAFT');
    await renameSlug(id, draftTo);

    // The old slug was never publicly live, so no SlugRedirect exists — resolve 404s.
    const res = await request(httpServer(app))
      .get(resolveUrl('en', `/blog/${draftFrom}`))
      .expect(404);
    expect(res).toSatisfyApiSpec();
  });

  it('handles cross-entity slug reuse without a spurious 422 (upsert, not create)', async () => {
    // E1 published at reuseA, renamed reuseA→reuseB → leaves a SlugRedirect(reuseA→reuseB); E1 now reuseB.
    const e1 = await createArticle(reuseA, 'PUBLISHED');
    await renameSlug(e1, reuseB);

    // E2 reuses the now-freed slug reuseA (translation slugs are unique only per-locale, so a vacated
    // slug is reusable by a different entity). The stale (reuseA→reuseB) redirect row survives this.
    const e2 = await createArticle(reuseA, 'PUBLISHED');

    // E2 renamed reuseA→reuseC. A plain `create` in buildRedirectOps would hit P2002 against the
    // surviving (reuseA→reuseB) row (unique on locale+entityType+fromSlug) and abort the whole rename
    // with a misleading 422; the `upsert` fix overwrites it instead. renameSlug asserts 200.
    await renameSlug(e2, reuseC);

    // reuseA now redirects to reuseC (E2's latest home), overwriting the stale reuseB target.
    const res = await request(httpServer(app))
      .get(resolveUrl('en', `/blog/${reuseA}`))
      .expect(200);
    expect(res).toSatisfyApiSpec();
    expect(envelopeData<{ toPath: string }>(res)).toEqual({
      toPath: `/blog/${reuseC}`,
    });
  });
});
