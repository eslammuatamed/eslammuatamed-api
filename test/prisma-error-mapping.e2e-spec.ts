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
// No module translates P2002 for itself any more — the global filter owns it everywhere. The
// P2002 evidence below is taken from ARTICLES, and section B2 then runs the SAME path through
// PROJECTS, which used to translate locally: two modules reaching one byte-identical response is
// the actual claim, and one module alone could not carry it.

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
  // Projects created by section B2. Tracked so teardown removes exactly this spec's rows.
  const createdProjectIds: string[] = [];
  // Skills created by section B3, tracked for the same reason.
  const createdSkillIds: string[] = [];

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
    // Section B2's projects. Cascade removes their translations (onDelete: Cascade).
    if (createdProjectIds.length > 0) {
      await prisma.project.deleteMany({
        where: { id: { in: createdProjectIds } },
      });
    }
    // Section B3's skills. Cascade removes their translations; none are linked to a project, so
    // the RESTRICT guard section C exercises does not apply here.
    if (createdSkillIds.length > 0) {
      await prisma.skill.deleteMany({
        where: { id: { in: createdSkillIds } },
      });
    }
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

      // The shape the fix is built on, pinned so a future Prisma change is loud.
      //
      // Prisma 6 (Rust engine) put the conflicting fields in `meta.target`. Prisma 7 + PrismaPg
      // does NOT populate `meta.target` at all: the information lives at
      // `meta.driverAdapterError.cause.constraint.fields`, and the values there are DATABASE
      // COLUMN names (`category_id`) rather than API field names (`categoryId`).
      //
      // `uniqueConstraintFields` reads exactly this and normalizes it. If a future version moves
      // or renames it again, this assertion fails and names the new location — rather than the
      // API silently losing its field paths, which is precisely how the original defect shipped.
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
      // The regression test, asserted by VALUE.
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
      // The load-bearing regression test.
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

  // ── B2. The SAME path through PROJECTS, which used to translate P2002 itself ────────────────
  //
  // `ProjectsService` once caught P2002 and threw a bare
  // `UnprocessableEntityException('A project translation slug or relation value already exists.')`.
  // That took the `fromHttpException` branch: still a 422, but `title: 'Unprocessable Entity'`,
  // a project-specific `detail`, and NO `errors[]` — a different contract from Articles above for
  // the identical failure. The local translation is gone; these tests pin the resulting PUBLIC
  // behaviour, and they are written as VALUE assertions against the Articles wording precisely so
  // that "the two modules now answer the same way" is what is being checked.
  describe('a project unique violation takes the same global path as an article one', () => {
    const projectBody = (suffix: string, slugSuffix = suffix) => ({
      featured: false,
      isPublished: false,
      order: 0,
      technologyIds: [],
      gallery: [],
      translations: [
        {
          locale: 'en',
          title: `Prisma Error Project ${unique} ${suffix}`,
          slug: `e2e-prisma-error-project-${slugSuffix}-${unique}`,
          summary: 'Fixture for the project P2002 mapping.',
          overview: '## Overview\n\nFixture overview.',
          businessProblem: '## Problem\n\nFixture problem.',
          solution: '## Solution\n\nFixture solution.',
          role: '## Role\n\nFixture role.',
          architecture: '## Architecture\n\nFixture architecture.',
          challenges: '## Challenges\n\nFixture challenges.',
          features: '## Features\n\nFixture features.',
          lessonsLearned: '## Lessons\n\nFixture lessons.',
        },
      ],
    });

    it('answers a per-locale slug collision with the GLOBAL 422 shape, errors[] included', async () => {
      const created = await request(httpServer(app))
        .post('/api/v1/admin/projects')
        .set(auth())
        .send(projectBody('a'))
        .expect(201);
      createdProjectIds.push(envelopeData<{ id: string }>(created).id);

      const conflict = await request(httpServer(app))
        .post('/api/v1/admin/projects')
        .set(auth())
        .send(projectBody('a'))
        .expect(422);

      expect(conflict).toSatisfyApiSpec();
      expect(conflict.headers['content-type']).toContain(
        'application/problem+json',
      );
      expect(conflict.body.status).toBe(422);
      // Was 'Unprocessable Entity' under the local translation — the title IS part of the change.
      expect(conflict.body.title).toBe('Validation failed');
      // Was 'A project translation slug or relation value already exists.'
      expect(conflict.body.detail).toBe(
        'A record with these values already exists.',
      );
      // Was ABSENT entirely — the local path never attached field paths. @@unique([locale, slug]).
      expect(conflict.body.errors).toEqual([
        { field: 'locale', message: 'This value is already in use.' },
        { field: 'slug', message: 'This value is already in use.' },
      ]);
      expectNoInternalsLeaked(conflict.body);
    });

    it('reports the MAPPED project_id column under its API name', async () => {
      // `project_translations` maps `projectId` → `project_id`, so this is the discriminating
      // half: only a working normalization turns the driver's `project_id` into `projectId`.
      // Provoked the same way as the article case — one create with TWO English translations,
      // which violates @@unique([projectId, locale]) inside Prisma's own nested write.
      const body = projectBody('dup');
      const conflict = await request(httpServer(app))
        .post('/api/v1/admin/projects')
        .set(auth())
        .send({
          ...body,
          translations: [
            body.translations[0],
            {
              ...body.translations[0],
              slug: `${body.translations[0]?.slug ?? ''}-second`,
              title: `${body.translations[0]?.title ?? ''} second`,
            },
          ],
        })
        .expect(422);

      expect(conflict).toSatisfyApiSpec();
      expect(conflict.body.errors).toEqual([
        { field: 'projectId', message: 'This value is already in use.' },
        { field: 'locale', message: 'This value is already in use.' },
      ]);
      expect(JSON.stringify(conflict.body)).not.toContain('project_id');
      expectNoInternalsLeaked(conflict.body);
    });

    // The architecture assertion, not just the shape one: projects and articles must now be
    // byte-identical on everything except `instance`. This is what centralizing actually bought, and it
    // fails the moment either module reacquires a local translation.
    it('returns a body identical to the article collision apart from `instance`', async () => {
      const articleSlug = `e2e-parity-article-${unique}`;
      const articleBody = {
        categoryId,
        translations: [
          {
            locale: 'en',
            title: `Parity Article ${unique}`,
            slug: articleSlug,
            excerpt: 'Fixture for the cross-module parity check.',
            body: '# Heading\n\nBody content long enough for reading-time to compute.',
          },
        ],
      };
      await request(httpServer(app))
        .post('/api/v1/admin/articles')
        .set(auth())
        .send(articleBody)
        .expect(201);
      const articleConflict = await request(httpServer(app))
        .post('/api/v1/admin/articles')
        .set(auth())
        .send(articleBody)
        .expect(422);

      const created = await request(httpServer(app))
        .post('/api/v1/admin/projects')
        .set(auth())
        .send(projectBody('parity'))
        .expect(201);
      createdProjectIds.push(envelopeData<{ id: string }>(created).id);
      const projectConflict = await request(httpServer(app))
        .post('/api/v1/admin/projects')
        .set(auth())
        .send(projectBody('parity'))
        .expect(422);

      const withoutInstance = (body: Record<string, unknown>) => {
        const { instance: _instance, ...rest } = body;
        return rest;
      };
      expect(withoutInstance(projectConflict.body)).toEqual(
        withoutInstance(articleConflict.body),
      );
      // Guards the guard: `instance` must genuinely differ, or the comparison above is trivial.
      expect(projectConflict.body.instance).not.toBe(
        articleConflict.body.instance,
      );
    });
  });

  // ── B3. The SAME path through SKILLS, the last module that translated P2002 itself ─────────
  //
  // `SkillsService.create` once caught P2002 and threw
  // `ConflictException('Skill slug "…" is already taken.')` — a **409**. That was not merely an
  // contract inconsistency: `POST /api/v1/admin/skills` declares `201/401/403/422/429` and no
  // 409 at all, so the runtime answered a status its own published contract did not admit, on a
  // trivially reachable path. Every peer admin create (categories, tags, articles, roles, users,
  // experiences, testimonials, projects) declares 422 and returns it. The local arm is gone; the
  // contract is unchanged; these tests pin the resulting PUBLIC behaviour by value.
  describe('a skill unique violation takes the same global path as an article one', () => {
    const skillBody = (suffix: string) => ({
      slug: `e2e-prisma-error-skill-${suffix}-${unique}`,
      group: 'FRONTEND',
      order: 9100,
      translations: [{ locale: 'en', label: `Prisma Error Skill ${suffix}` }],
    });

    it('answers a duplicate slug with 422, not the undeclared 409 it used to return', async () => {
      const created = await request(httpServer(app))
        .post('/api/v1/admin/skills')
        .set(auth())
        .send(skillBody('a'))
        .expect(201);
      createdSkillIds.push(envelopeData<{ id: string }>(created).id);

      const conflict = await request(httpServer(app))
        .post('/api/v1/admin/skills')
        .set(auth())
        .send(skillBody('a'))
        .expect(422);

      // The contract assertion is the load-bearing one here: under the old 409 this line failed,
      // because 409 is not among the declared responses for this operation.
      expect(conflict).toSatisfyApiSpec();
      expect(conflict.headers['content-type']).toContain(
        'application/problem+json',
      );
      expect(conflict.body.status).toBe(422);
      // Was 'Conflict' / 409 under the local translation — the status AND title both change.
      expect(conflict.body.title).toBe('Validation failed');
      // Was `Skill slug "…" is already taken.`
      expect(conflict.body.detail).toBe(
        'A record with these values already exists.',
      );
      // Was ABSENT entirely — the local path never attached field paths. `Skill.slug` is a
      // single-column base-model unique carrying no `@map`, so the API name is the column name.
      expect(conflict.body.errors).toEqual([
        { field: 'slug', message: 'This value is already in use.' },
      ]);
      expectNoInternalsLeaked(conflict.body);
    });

    // The architecture assertion. `errors` legitimately differs (different unique constraint), so
    // the comparison is over the four members that encode WHICH arm of the filter answered —
    // those are what a re-added local translation would change.
    it('returns the same problem shape as the article collision, from the same filter arm', async () => {
      const articleSlug = `e2e-parity-skill-article-${unique}`;
      const articleBody = {
        categoryId,
        translations: [
          {
            locale: 'en',
            title: `Parity Skill Article ${unique}`,
            slug: articleSlug,
            excerpt: 'Fixture for the skills cross-module parity check.',
            body: '# Heading\n\nBody content long enough for reading-time to compute.',
          },
        ],
      };
      await request(httpServer(app))
        .post('/api/v1/admin/articles')
        .set(auth())
        .send(articleBody)
        .expect(201);
      const articleConflict = await request(httpServer(app))
        .post('/api/v1/admin/articles')
        .set(auth())
        .send(articleBody)
        .expect(422);

      const created = await request(httpServer(app))
        .post('/api/v1/admin/skills')
        .set(auth())
        .send(skillBody('parity'))
        .expect(201);
      createdSkillIds.push(envelopeData<{ id: string }>(created).id);
      const skillConflict = await request(httpServer(app))
        .post('/api/v1/admin/skills')
        .set(auth())
        .send(skillBody('parity'))
        .expect(422);

      const arm = (body: Record<string, unknown>) => ({
        type: body.type,
        title: body.title,
        status: body.status,
        detail: body.detail,
      });
      expect(arm(skillConflict.body)).toEqual(arm(articleConflict.body));
      // Guards the guard: `instance` must genuinely differ, or the comparison above could be
      // reading one response twice.
      expect(skillConflict.body.instance).not.toBe(
        articleConflict.body.instance,
      );
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
