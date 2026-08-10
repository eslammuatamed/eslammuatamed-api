import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';
import { createPrismaClient } from '../src/prisma/standalone-client';
import {
  createE2eApp,
  envelopeData,
  httpServer,
  OWNER_EMAIL,
  OWNER_PASSWORD,
} from './utils/e2e-app';
import { loadApiSpec } from './utils/contract';

// Proves the Prisma 7 + PrismaPg runtime still produces error objects that `AllExceptionsFilter`
// recognizes, using REAL PostgreSQL failures rather than a mocked
// `Prisma.PrismaClientKnownRequestError` (9C-8).
//
// WHY this is worth a dedicated spec: the filter dispatches on `exception instanceof
// Prisma.PrismaClientKnownRequestError`, where `Prisma` is imported from the GENERATED client. A
// major-version bump that changed the generated error class — or made the driver adapter wrap
// errors in a different type — would silently take the `instanceof` branch away. Every constraint
// violation would then fall through to the sanitized 500 arm. Nothing in lint, typecheck or build
// catches that: it is a pure runtime identity question, so only a real database can answer it.
//
// Phase 10 B-2 will delete the Project-local P2002 translation and rely on this global filter, so
// the P2002 evidence below is deliberately taken from ARTICLES — a path that has no service-local
// translation today and therefore already exercises the target architecture.

// A syntactically valid uuid(7) that the seed cannot have issued.
const ABSENT_ID = '00000000-0000-7000-8000-000000000000';

// Anything that would betray the ORM or the query to a client. The filter's contract is that a
// public problem+json body carries none of it (doc 19).
const INTERNALS = [
  'prisma',
  'P2002',
  'P2003',
  'P2025',
  'Invalid `',
  'invocation',
  'constraint',
  'at Object.',
];

function expectNoInternalsLeaked(body: unknown): void {
  const serialized = JSON.stringify(body);
  for (const needle of INTERNALS) {
    expect(serialized.toLowerCase()).not.toContain(needle.toLowerCase());
  }
}

describe('Prisma 7 runtime errors through AllExceptionsFilter (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let ownerToken: string;
  let categoryId: string;
  const unique = Date.now();

  const auth = (): Record<string, string> => ({
    Authorization: `Bearer ${ownerToken}`,
  });

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
    expect(categoryId).not.toBe('');
  });

  afterAll(async () => {
    // The full suite runs --runInBand against ONE shared scratch database, so fixtures left here
    // become extra rows in every later spec's list assertions. Articles go first: the categories
    // below are RESTRICT-guarded by exactly the reference section C proves.
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

  // ── A. The error objects themselves ────────────────────────────────────────────────────────
  //
  // No HTTP here on purpose: this isolates the runtime CLASS IDENTITY question from any question
  // about routing or service-level pre-checks. If these fail, every mapping below is meaningless.
  describe('the real runtime error class is still the one the filter tests for', () => {
    async function captureError(run: () => Promise<unknown>): Promise<unknown> {
      try {
        await run();
      } catch (error) {
        return error;
      }
      throw new Error('Expected the operation to reject, but it resolved.');
    }

    it('raises a known-request error with code P2002 on a unique violation', async () => {
      const existing = await prisma.categoryTranslation.findFirstOrThrow({
        where: { categoryId },
      });

      const error = await captureError(() =>
        prisma.categoryTranslation.create({
          data: {
            categoryId: existing.categoryId,
            locale: existing.locale,
            name: 'duplicate',
            slug: `dup-${unique}`,
          },
        }),
      );

      expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      const known = error as Prisma.PrismaClientKnownRequestError;
      expect(known.code).toBe('P2002');
      expect(known.constructor.name).toBe('PrismaClientKnownRequestError');

      // F9-9 — the shape the fix is built on, pinned so a future Prisma change is loud.
      //
      // Prisma 6 (Rust engine) put the conflicting fields in `meta.target`. Prisma 7 + PrismaPg
      // does NOT populate `meta.target` at all: the information lives at
      // `meta.driverAdapterError.cause.constraint.fields`, and the values there are DATABASE
      // COLUMN names (`category_id`) rather than API field names (`categoryId`).
      //
      // `uniqueConstraintFields` reads exactly this and normalizes it. If a future version moves
      // or renames it again, this assertion fails and names the new location — rather than the
      // API silently losing its field paths, which is precisely how F9-9 shipped.
      expect(known.meta?.target).toBeUndefined();
      const adapterError = (
        known.meta as {
          driverAdapterError?: {
            cause?: { constraint?: { fields?: string[] } };
          };
        }
      )?.driverAdapterError;
      expect(adapterError?.cause?.constraint?.fields).toEqual([
        'category_id',
        'locale',
      ]);
    });

    it('raises a known-request error with code P2003 on a foreign-key violation', async () => {
      const error = await captureError(() =>
        prisma.categoryTranslation.create({
          data: {
            categoryId: ABSENT_ID,
            locale: 'en',
            name: 'orphan',
            slug: `orphan-${unique}`,
          },
        }),
      );

      expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect((error as Prisma.PrismaClientKnownRequestError).code).toBe(
        'P2003',
      );
    });

    it('raises a known-request error with code P2025 when a required row is absent', async () => {
      const error = await captureError(() =>
        prisma.category.delete({ where: { id: ABSENT_ID } }),
      );

      expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect((error as Prisma.PrismaClientKnownRequestError).code).toBe(
        'P2025',
      );
    });
  });

  // ── B. P2002 → 422, through a path with NO service-local translation ───────────────────────
  describe('a real unique violation becomes a 422 validation problem', () => {
    const slug = `e2e-prisma-error-${unique}`;
    const translation = () => ({
      locale: 'en',
      title: `Prisma Error Fixture ${unique}`,
      slug,
      excerpt: 'Fixture for the P2002 mapping.',
      body: '# Heading\n\nBody content long enough for the reading-time computation to run.',
    });

    it('maps the collision to problem+json without leaking Prisma internals', async () => {
      await request(httpServer(app))
        .post('/api/v1/admin/articles')
        .set(auth())
        .send({ categoryId, translations: [translation()] })
        .expect(201);

      const conflict = await request(httpServer(app))
        .post('/api/v1/admin/articles')
        .set(auth())
        .send({ categoryId, translations: [translation()] })
        .expect(422);

      expect(conflict).toSatisfyApiSpec();
      expect(conflict.headers['content-type']).toContain(
        'application/problem+json',
      );
      expect(conflict.body.status).toBe(422);
      expect(conflict.body.title).toBe('Validation failed');
      expect(conflict.body.detail).toBe(
        'A record with these values already exists.',
      );
      // The P2002 arm is the only one that attaches `errors`; its presence proves the response
      // came from `fromPrisma`, not from the DTO ValidationPipe or the generic 500 arm.
      expect(Array.isArray(conflict.body.errors)).toBe(true);
      // The F9-9 regression test, asserted by VALUE.
      //
      // `article_translations` maps `locale` and `slug` with no @map, so this pair alone could
      // pass without any normalization at all. The mapped snake_case case is covered by the
      // dedicated test below — the two together are what make this discriminating.
      expect(conflict.body.errors).toEqual([
        { field: 'locale', message: 'This value is already in use.' },
        { field: 'slug', message: 'This value is already in use.' },
      ]);
      expectNoInternalsLeaked(conflict.body);
    });

    it('reports a MAPPED column under its API name, never its database name', async () => {
      // The load-bearing F9-9 regression test.
      //
      // `locale` and `slug` above carry no `@map`, so that case would pass even with normalization
      // deleted. This one cannot: `article_translations` maps `articleId` to the column
      // `article_id`, so the driver reports `article_id` and only a working translation can turn
      // it into `articleId`.
      //
      // Provoked by creating one article with TWO English translations — `article.create` nests
      // `translations: { create: [...] }` and does not dedupe locales, so the pair violates
      // @@unique([articleId, locale]) inside Prisma's own nested write.
      const duplicated = (suffix: string) => ({
        locale: 'en',
        title: `Mapped Column Fixture ${unique} ${suffix}`,
        slug: `mapped-column-${suffix}-${unique}`,
        excerpt: 'Fixture for the mapped-column field path.',
        body: '# Heading\n\nBody content long enough for the reading-time computation.',
      });

      const conflict = await request(httpServer(app))
        .post('/api/v1/admin/articles')
        .set(auth())
        .send({
          categoryId,
          translations: [duplicated('a'), duplicated('b')],
        })
        .expect(422);

      expect(conflict).toSatisfyApiSpec();
      expect(conflict.body.errors).toEqual([
        { field: 'articleId', message: 'This value is already in use.' },
        { field: 'locale', message: 'This value is already in use.' },
      ]);
      // Stated as its own assertion so the failure message names the actual defect.
      expect(JSON.stringify(conflict.body)).not.toContain('article_id');
      expectNoInternalsLeaked(conflict.body);
    });
  });

  // ── C. P2003 → 409, through the RESTRICT-guarded category delete ───────────────────────────
  describe('a real foreign-key violation becomes a 409 conflict', () => {
    it('refuses to delete a category that still has articles', async () => {
      const created = await request(httpServer(app))
        .post('/api/v1/admin/categories')
        .set(auth())
        .send({
          translations: [
            {
              locale: 'en',
              name: `FK Fixture ${unique}`,
              slug: `fk-fixture-${unique}`,
            },
          ],
        })
        .expect(201);
      const doomedCategoryId = envelopeData<{ id: string }>(created).id;

      await request(httpServer(app))
        .post('/api/v1/admin/articles')
        .set(auth())
        .send({
          categoryId: doomedCategoryId,
          translations: [
            {
              locale: 'en',
              title: `FK Guard Article ${unique}`,
              slug: `fk-guard-article-${unique}`,
              excerpt: 'Holds a reference so the category cannot be deleted.',
              body: '# Heading\n\nBody content long enough for reading-time computation.',
            },
          ],
        })
        .expect(201);

      const conflict = await request(httpServer(app))
        .delete(`/api/v1/admin/categories/${doomedCategoryId}`)
        .set(auth())
        .expect(409);

      expect(conflict.headers['content-type']).toContain(
        'application/problem+json',
      );
      expect(conflict.body.status).toBe(409);
      expect(conflict.body.title).toBe('Conflict');
      expect(conflict.body.detail).toBe(
        'The resource is referenced by other records and cannot be modified.',
      );
      expectNoInternalsLeaked(conflict.body);

      // The guard must have PREVENTED the delete, not merely reported it.
      expect(
        await prisma.category.count({ where: { id: doomedCategoryId } }),
      ).toBe(1);
    });
  });

  // ── D. P2025 reachability ──────────────────────────────────────────────────────────────────
  describe('P2025 is pre-empted by service-level existence checks', () => {
    // Recorded rather than asserted-away: the filter HAS a P2025 arm (verified against a real
    // P2025 in section A and unit-tested in all-exceptions.filter.spec.ts), but every admin
    // mutation loads the row first and throws NotFoundException, so no HTTP path reaches it.
    // This bounds the 9C-8 claim honestly instead of inventing an endpoint to reach the arm.
    it('answers an absent article with a 404 from the service, not the Prisma arm', async () => {
      const missing = await request(httpServer(app))
        .delete(`/api/v1/admin/articles/${ABSENT_ID}`)
        .set(auth())
        .expect(404);

      expect(missing.headers['content-type']).toContain(
        'application/problem+json',
      );
      expect(missing.body.status).toBe(404);
      expectNoInternalsLeaked(missing.body);
    });
  });
});
