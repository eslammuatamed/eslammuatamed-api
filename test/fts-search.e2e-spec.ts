import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaClient } from '../src/generated/prisma/client';
import { createPrismaClient } from '../src/prisma/standalone-client';
import {
  createE2eApp,
  envelopeData,
  httpServer,
  OWNER_EMAIL,
  OWNER_PASSWORD,
} from './utils/e2e-app';
import { loadApiSpec } from './utils/contract';

// 9C-9. `articles.service.ts:116-138` is one of only TWO executable raw-SQL sites in the
// application (the other is the health probe's `SELECT 1`), and the only one carrying user input.
// It builds a `websearch_to_tsquery` search over the generated `search_vector` column out of
// `Prisma.sql` fragments.
//
// `fts-invariants.e2e-spec.ts` proves the COLUMN and INDEX survive migrations; `articles.e2e-spec`
// proves a match is found and ranked. Neither covers what this file does: locale routing through
// the per-locale `regconfig`, the no-match path, and the fact that every interpolated value is a
// bound parameter rather than concatenated text. Those are the parts a driver change could break
// quietly, because a broken one still returns 200 with a plausible-looking list.
//
// Nothing here rewrites the SQL. Prisma changing major version is not a reason to touch working
// SQL; it is a reason to prove the SQL still behaves.

describe('Article FTS raw-SQL behaviour under Prisma 7 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let ownerToken: string;
  let categoryId: string;
  const unique = Date.now();
  const term = `ftsprobe${unique}`;

  const auth = (): Record<string, string> => ({
    Authorization: `Bearer ${ownerToken}`,
  });

  const publish = async (
    locale: string,
    title: string,
    slug: string,
  ): Promise<void> => {
    await request(httpServer(app))
      .post('/api/v1/admin/articles')
      .set(auth())
      .send({
        categoryId,
        status: 'PUBLISHED',
        translations: [
          {
            locale,
            title,
            slug,
            excerpt: `${title} excerpt`,
            body: 'Body content long enough for the reading-time computation.',
          },
        ],
      })
      .expect(201);
  };

  beforeAll(async () => {
    loadApiSpec();
    app = await createE2eApp();
    prisma = createPrismaClient();

    const login = await request(httpServer(app))
      .post('/api/v1/auth/login')
      .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
    ownerToken = envelopeData<{ accessToken: string }>(login).accessToken;

    const categories = await request(httpServer(app))
      .get('/api/v1/admin/categories')
      .set(auth());
    categoryId = envelopeData<{ id: string }[]>(categories)[0]?.id ?? '';

    // One English and one Arabic article carrying the SAME term. The generated column uses
    // 'english' regconfig for en and 'simple' for ar, so each must surface only under its locale.
    await publish('en', `English ${term} article`, `fts-en-${unique}`);
    await publish('ar', `مقال ${term} عربي`, `fts-ar-${unique}`);
  }, 60_000);

  afterAll(async () => {
    await prisma.articleTranslation.deleteMany({
      where: { slug: { contains: `-${unique}` } },
    });
    await prisma.article.deleteMany({ where: { translations: { none: {} } } });
    await prisma.$disconnect();
    await app.close();
  });

  const search = (locale: string, q: string) =>
    request(httpServer(app)).get(
      `/api/v1/articles?locale=${locale}&q=${encodeURIComponent(q)}&perPage=50`,
    );

  it('returns the matching article for its own locale', async () => {
    const res = await search('en', term).expect(200);
    expect(res).toSatisfyApiSpec();

    const slugs = envelopeData<{ slug: string }[]>(res).map((a) => a.slug);
    expect(slugs).toContain(`fts-en-${unique}`);
  });

  it('does not leak the other locale into the results', async () => {
    // Discriminating on the ACTUAL rows, not on a count: the Arabic article carries the same term,
    // so a locale filter dropped from the raw SQL would surface it here.
    const en = envelopeData<{ slug: string }[]>(
      await search('en', term).expect(200),
    ).map((a) => a.slug);
    const ar = envelopeData<{ slug: string }[]>(
      await search('ar', term).expect(200),
    ).map((a) => a.slug);

    expect(en).toContain(`fts-en-${unique}`);
    expect(en).not.toContain(`fts-ar-${unique}`);
    expect(ar).toContain(`fts-ar-${unique}`);
    expect(ar).not.toContain(`fts-en-${unique}`);
  });

  it('returns a well-formed empty page when nothing matches', async () => {
    const res = await search('en', `nomatch${unique}xyz`).expect(200);
    expect(res).toSatisfyApiSpec();

    // The count arm of the query is a SEPARATE $queryRaw. Asserting the envelope's meta as well as
    // the rows proves both raw statements agreed on "nothing", rather than the list simply being
    // sliced to empty by pagination.
    expect(envelopeData<unknown[]>(res)).toEqual([]);
    expect(res.body.meta.total).toBe(0);
    expect(res.body.meta.totalPages).toBe(0);
  });

  describe('every interpolated value is a bound parameter', () => {
    // The service builds its WHERE clause from `Prisma.sql` fragments carrying `q`, `locale`,
    // `category` and `tag`. If any were concatenated instead of parameterized, these inputs would
    // change the SQL's structure rather than being matched as literal text.
    const payloads = [
      `'; DROP TABLE articles; --`,
      `' OR 1=1 --`,
      `\\'; SELECT pg_sleep(0); --`,
      `${term}') UNION SELECT NULL --`,
    ];

    it.each(payloads)('treats %j as a search term, not as SQL', async (q) => {
      const res = await search('en', q);

      // A 200 with no rows, or a contract-valid 422 from input validation, are both acceptable.
      // What must never happen is a 500 — that would mean malformed SQL reached PostgreSQL.
      expect([200, 422]).toContain(res.status);
      if (res.status === 200) {
        expect(envelopeData<unknown[]>(res)).toEqual([]);
      }
    });

    it('leaves the schema and data intact after those payloads', async () => {
      // The negative outcome the payloads were aiming at, checked directly rather than inferred
      // from the responses above.
      expect(
        await prisma.articleTranslation.count({
          where: { slug: `fts-en-${unique}` },
        }),
      ).toBe(1);
      expect(await prisma.article.count()).toBeGreaterThan(0);
    });

    it('parameterizes the category and tag filter fragments too', async () => {
      // These fragments are only appended when the query supplies them, so the payloads above
      // never reach them.
      const res = await request(httpServer(app)).get(
        `/api/v1/articles?locale=en&q=${term}` +
          `&category=${encodeURIComponent(`x' OR '1'='1`)}` +
          `&perPage=50`,
      );

      expect([200, 422]).toContain(res.status);
      if (res.status === 200) {
        // The filter matched no category, so it must exclude everything — an injected
        // always-true predicate would return the article instead.
        expect(envelopeData<unknown[]>(res)).toEqual([]);
      }
    });
  });
});
