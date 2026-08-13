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

// Proves the BATCH `$transaction([...])` form is still atomic against real PostgreSQL under
// Prisma 7.9.1 + PrismaPg (9C-7).
//
// The interactive form — `$transaction(async tx => ...)` — is proven elsewhere and deliberately
// not duplicated here:
//   - `refresh-token.service.ts:66`  → `refresh-token-rotation.e2e-spec.ts` (the CAS claim rolls
//     back when the conditional update matches nothing)
//   - `prisma/sync/apply-plan.ts:228` → `content-sync.e2e-spec.ts` ("a failed apply rolls the
//     whole run back", "fires and ROLLS BACK when the work deletes a protected row")
//
// The batch form had no equivalent real-database rollback proof. Every service that writes
// translations builds one operations array — a row update followed by one upsert per locale — and
// pushes it through a single `$transaction`. The domain invariant is that a multi-locale edit is
// all-or-nothing: a collision on the SECOND locale must not leave the FIRST locale's new text, nor
// the parent row's new category, committed. `articles.service.ts:424` is the representative site;
// it is real production code, not a transaction manufactured for this test.

describe('Batch $transaction atomicity against real PostgreSQL (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let ownerToken: string;
  let originalCategoryId: string;
  let otherCategoryId: string;
  const unique = Date.now();

  const auth = (): Record<string, string> => ({
    Authorization: `Bearer ${ownerToken}`,
  });

  const body =
    '# Heading\n\nBody long enough for the reading-time computation.';

  const createArticle = async (
    categoryId: string,
    key: string,
  ): Promise<string> => {
    const res = await request(httpServer(app))
      .post('/api/v1/admin/articles')
      .set(auth())
      .send({
        categoryId,
        translations: [
          {
            locale: 'en',
            title: `Tx ${key} EN ${unique}`,
            slug: `tx-${key}-en-${unique}`,
            excerpt: 'English fixture.',
            body,
          },
          {
            locale: 'ar',
            title: `Tx ${key} AR ${unique}`,
            slug: `tx-${key}-ar-${unique}`,
            excerpt: 'Arabic fixture.',
            body,
          },
        ],
      })
      .expect(201);
    return envelopeData<{ id: string }>(res).id;
  };

  beforeAll(async () => {
    app = await createE2eApp();
    prisma = createPrismaClient();

    const login = await request(httpServer(app))
      .post('/api/v1/auth/login')
      .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
    ownerToken = envelopeData<{ accessToken: string }>(login).accessToken;

    const categories = await request(httpServer(app))
      .get('/api/v1/admin/categories')
      .set(auth());
    originalCategoryId =
      envelopeData<{ id: string }[]>(categories)[0]?.id ?? '';

    const other = await request(httpServer(app))
      .post('/api/v1/admin/categories')
      .set(auth())
      .send({
        translations: [
          {
            locale: 'en',
            name: `Tx Other ${unique}`,
            slug: `tx-other-${unique}`,
          },
        ],
      })
      .expect(201);
    otherCategoryId = envelopeData<{ id: string }>(other).id;

    expect(originalCategoryId).not.toBe('');
    expect(otherCategoryId).not.toBe(originalCategoryId);
  });

  afterAll(async () => {
    // Same reason as prisma-error-mapping: --runInBand shares one scratch database across the
    // whole suite, and these fixtures would otherwise inflate later list assertions. Articles
    // before categories — the FK guard is RESTRICT.
    await prisma.articleTranslation.deleteMany({
      where: { slug: { contains: `-${unique}` } },
    });
    await prisma.article.deleteMany({ where: { translations: { none: {} } } });
    await prisma.categoryTranslation.deleteMany({
      where: { slug: { contains: `-${unique}` } },
    });
    await prisma.category.deleteMany({ where: { translations: { none: {} } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('rolls the parent update and the first locale back when the second locale collides', async () => {
    const subject = await createArticle(originalCategoryId, 'subject');
    const blocker = await createArticle(originalCategoryId, 'blocker');

    const blockerArabic = await prisma.articleTranslation.findFirstOrThrow({
      where: { articleId: blocker, locale: 'ar' },
    });

    const before = await prisma.article.findUniqueOrThrow({
      where: { id: subject },
      include: { translations: { orderBy: { locale: 'asc' } } },
    });
    const englishBefore = before.translations.find((t) => t.locale === 'en');
    expect(englishBefore).toBeDefined();

    // One PATCH producing THREE operations in one array:
    //   [0] article.update            → moves the article to another category
    //   [1] articleTranslation.upsert → rewrites the English title (succeeds in isolation)
    //   [2] articleTranslation.upsert → takes the blocker's Arabic slug (violates
    //                                   @@unique([locale, slug]) → P2002)
    // Operation order matters: [0] and [1] are already applied inside the transaction when [2]
    // fails, so anything surviving afterwards is a genuine atomicity breach, not a no-op.
    const rejected = await request(httpServer(app))
      .patch(`/api/v1/admin/articles/${subject}`)
      .set(auth())
      .send({
        categoryId: otherCategoryId,
        translations: [
          {
            locale: 'en',
            title: `REWRITTEN ${unique}`,
            slug: `tx-subject-en-rewritten-${unique}`,
            excerpt: 'Rewritten English fixture.',
            body,
          },
          {
            locale: 'ar',
            title: `Collides ${unique}`,
            slug: blockerArabic.slug,
            excerpt: 'Arabic fixture that collides.',
            body,
          },
        ],
      })
      .expect(422);

    expect(rejected.headers['content-type']).toContain(
      'application/problem+json',
    );

    const after = await prisma.article.findUniqueOrThrow({
      where: { id: subject },
      include: { translations: { orderBy: { locale: 'asc' } } },
    });
    const englishAfter = after.translations.find((t) => t.locale === 'en');

    // Operation [0] rolled back.
    expect(after.categoryId).toBe(originalCategoryId);
    // Operation [1] rolled back — asserted on the actual stored values, not on absence.
    expect(englishAfter?.title).toBe(englishBefore?.title);
    expect(englishAfter?.slug).toBe(englishBefore?.slug);
    // And no partial third row appeared: still exactly the two original locales.
    expect(after.translations.map((t) => t.locale)).toEqual(['ar', 'en']);
    // The blocker keeps sole ownership of the contested slug.
    expect(
      await prisma.articleTranslation.count({
        where: { locale: 'ar', slug: blockerArabic.slug },
      }),
    ).toBe(1);
  });

  it('commits every operation in the array when none of them fails', async () => {
    // The paired positive case: without it, a service that silently wrote nothing at all would
    // also satisfy the rollback assertions above.
    const subject = await createArticle(originalCategoryId, `ok-${unique}`);

    await request(httpServer(app))
      .patch(`/api/v1/admin/articles/${subject}`)
      .set(auth())
      .send({
        categoryId: otherCategoryId,
        translations: [
          {
            locale: 'en',
            title: `Committed EN ${unique}`,
            slug: `tx-committed-en-${unique}`,
            excerpt: 'English fixture.',
            body,
          },
          {
            locale: 'ar',
            title: `Committed AR ${unique}`,
            slug: `tx-committed-ar-${unique}`,
            excerpt: 'Arabic fixture.',
            body,
          },
        ],
      })
      .expect(200);

    const after = await prisma.article.findUniqueOrThrow({
      where: { id: subject },
      include: { translations: true },
    });

    expect(after.categoryId).toBe(otherCategoryId);
    expect(after.translations.find((t) => t.locale === 'en')?.title).toBe(
      `Committed EN ${unique}`,
    );
    expect(after.translations.find((t) => t.locale === 'ar')?.title).toBe(
      `Committed AR ${unique}`,
    );
  });
});
