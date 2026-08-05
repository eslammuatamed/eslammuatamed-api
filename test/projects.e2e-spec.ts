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

interface ProjectListItem {
  id: string;
  slug: string;
}

interface ProjectDetail extends ProjectListItem {
  overview: string;
  businessProblem: string;
  solution: string;
  role: string;
  architecture: string;
  challenges: string;
  features: string;
  lessonsLearned: string;
  availableLocales: string[];
  slugs: Record<string, string>;
}

describe('Projects (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let projectId: string | undefined;
  const unique = Date.now();
  const slug = `e2e-project-${unique}`;
  const arSlug = `e2e-project-ar-${unique}`;
  const sections = {
    overview: `## Overview\n\nE2E overview ${unique}.`,
    businessProblem: `## Problem\n\nE2E problem ${unique}.`,
    solution: `## Solution\n\nE2E solution ${unique}.`,
    role: `## Role\n\nE2E role ${unique}.`,
    architecture: `## Architecture\n\nE2E architecture ${unique}.`,
    challenges: `## Challenges\n\nE2E challenges ${unique}.`,
    features: `## Features\n\nE2E features ${unique}.`,
    lessonsLearned: `## Lessons\n\nE2E lessons ${unique}.`,
  };

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
  });

  afterAll(async () => {
    if (projectId) {
      const removed = await request(httpServer(app))
        .delete(`/api/v1/admin/projects/${projectId}`)
        .set(auth())
        .expect(204);
      expect(removed).toSatisfyApiSpec();
    }
    await app.close();
  });

  const project = () => ({
    featured: true,
    isPublished: false,
    order: 0,
    liveUrl: 'https://example.com/e2e-project',
    repoUrl: 'https://github.com/example/e2e-project',
    year: 2030,
    technologyIds: [],
    gallery: [],
    translations: [
      {
        locale: 'en',
        title: `E2E Project ${unique}`,
        slug,
        summary: `E2E project summary ${unique}.`,
        ...sections,
        metaTitle: `E2E Project ${unique}`,
        metaDescription: `E2E project case study ${unique}.`,
        canonicalUrl: `https://example.com/projects/${slug}`,
      },
      {
        locale: 'ar',
        title: `مشروع ${unique}`,
        slug: arSlug,
        summary: `ملخص المشروع ${unique}.`,
        ...sections,
      },
    ],
  });

  it('keeps an unpublished project private, including direct slug, then reveals the full case study once published', async () => {
    const created = await request(httpServer(app))
      .post('/api/v1/admin/projects')
      .set(auth())
      .send(project())
      .expect(201);
    projectId = envelopeData<{ id: string }>(created).id;
    expect(created).toSatisfyApiSpec();

    const adminList = await request(httpServer(app))
      .get('/api/v1/admin/projects?perPage=50')
      .set(auth())
      .expect(200);
    expect(adminList).toSatisfyApiSpec();
    expect(
      envelopeData<{ id: string; isPublished: boolean }[]>(adminList),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: projectId, isPublished: false }),
      ]),
    );

    const unpublishedList = await request(httpServer(app))
      .get('/api/v1/projects?locale=en&perPage=50')
      .expect(200);
    expect(unpublishedList).toSatisfyApiSpec();
    expect(
      envelopeData<ProjectListItem[]>(unpublishedList).some(
        (item) => item.id === projectId,
      ),
    ).toBe(false);

    const unpublishedLookup = await request(httpServer(app))
      .get(`/api/v1/projects/${slug}?locale=en`)
      .expect(404);
    expect(unpublishedLookup).toSatisfyApiSpec();

    const publishedUpdate = await request(httpServer(app))
      .patch(`/api/v1/admin/projects/${projectId}`)
      .set(auth())
      .send({ isPublished: true })
      .expect(200);
    expect(publishedUpdate).toSatisfyApiSpec();

    const publishedList = await request(httpServer(app))
      .get('/api/v1/projects?locale=en&perPage=50')
      .expect(200);
    expect(publishedList).toSatisfyApiSpec();
    expect(envelopeData<ProjectListItem[]>(publishedList)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: projectId, slug }),
      ]),
    );

    const publishedLookup = await request(httpServer(app))
      .get(`/api/v1/projects/${slug}?locale=en`)
      .expect(200);
    expect(publishedLookup).toSatisfyApiSpec();
    const detail = envelopeData<ProjectDetail>(publishedLookup);
    expect(detail).toMatchObject({ id: projectId, slug, ...sections });

    // F-P5 / doc 10 §6: the public detail carries availableLocales and a locale->slug map
    // covering EXACTLY those locales, so the frontend can switch locale on a slugged route.
    expect([...detail.availableLocales].sort()).toEqual(['ar', 'en']);
    expect(Object.keys(detail.slugs).sort()).toEqual(
      [...detail.availableLocales].sort(),
    );
    expect(detail.slugs).toEqual({ en: slug, ar: arSlug });

    // The counterpart slug resolves in the other locale (locale-switch round-trip).
    const arLookup = await request(httpServer(app))
      .get(`/api/v1/projects/${arSlug}?locale=ar`)
      .expect(200);
    expect(arLookup).toSatisfyApiSpec();
    expect(envelopeData<ProjectDetail>(arLookup).slugs).toEqual({
      en: slug,
      ar: arSlug,
    });
  });

  it('rejects a slug collision in the same locale with a contract-valid 422', async () => {
    const collision = await request(httpServer(app))
      .post('/api/v1/admin/projects')
      .set(auth())
      .send(project())
      .expect(422);

    expect(collision).toSatisfyApiSpec();
  });

  // The public technology filter, end to end over HTTP. Self-contained: it builds its own Skill and
  // published Project so it never depends on the dev/demo seed layer, and removes both afterwards.
  describe('technology filtering by Skill slug', () => {
    const techSlug = `e2e-tech-${unique}`;
    const filterSlug = `e2e-filtered-${unique}`;
    let skillId: string;
    let filteredProjectId: string;

    beforeAll(async () => {
      const skill = await request(httpServer(app))
        .post('/api/v1/admin/skills')
        .set(auth())
        .send({
          slug: techSlug,
          group: 'BACKEND',
          order: 50,
          translations: [
            { locale: 'en', label: `E2E Tech ${unique}` },
            { locale: 'ar', label: `تقنية ${unique}` },
          ],
        })
        .expect(201);
      skillId = envelopeData<{ id: string }>(skill).id;

      const created = await request(httpServer(app))
        .post('/api/v1/admin/projects')
        .set(auth())
        .send({
          ...project(),
          isPublished: true,
          technologyIds: [skillId],
          translations: [
            {
              locale: 'en',
              title: `E2E Filtered ${unique}`,
              slug: filterSlug,
              summary: `E2E filtered summary ${unique}.`,
              ...sections,
            },
          ],
        })
        .expect(201);
      filteredProjectId = envelopeData<{ id: string }>(created).id;
    });

    afterAll(async () => {
      // Project first: the Skill relation is `onDelete: Restrict`, so the skill cannot go while a
      // project still points at it.
      await request(httpServer(app))
        .delete(`/api/v1/admin/projects/${filteredProjectId}`)
        .set(auth())
        .expect(204);
      await request(httpServer(app))
        .delete(`/api/v1/admin/skills/${skillId}`)
        .set(auth())
        .expect(204);
    });

    it('returns the project when filtered by the technology slug', async () => {
      const res = await request(httpServer(app))
        .get(`/api/v1/projects?locale=en&technology=${techSlug}`)
        .expect(200);

      expect(res).toSatisfyApiSpec();
      const items = envelopeData<ProjectListItem[]>(res);
      expect(items.map((item) => item.slug)).toContain(filterSlug);
    });

    // Links published before `Skill.slug` existed carry the uuid. They must keep resolving to the
    // same projects, otherwise the migration silently breaks every shared filter URL.
    it('still resolves a legacy Skill uuid filter to the same project', async () => {
      const res = await request(httpServer(app))
        .get(`/api/v1/projects?locale=en&technology=${skillId}`)
        .expect(200);

      expect(res).toSatisfyApiSpec();
      const items = envelopeData<ProjectListItem[]>(res);
      expect(items.map((item) => item.slug)).toContain(filterSlug);
    });

    it('carries the slug on each listed technology so a client can build the filter URL', async () => {
      const res = await request(httpServer(app))
        .get(`/api/v1/projects/${filterSlug}?locale=en`)
        .expect(200);

      expect(res).toSatisfyApiSpec();
      const detail = envelopeData<{
        technologies: { id: string; slug: string; label: string }[];
      }>(res);
      expect(detail.technologies).toContainEqual(
        expect.objectContaining({ id: skillId, slug: techSlug }),
      );
    });

    // An unknown technology is a valid, empty page — not a 404 and not a 422. The value is a query
    // parameter a visitor can edit or that can outlive a retired skill.
    it('returns an empty but valid paginated collection for an unknown slug', async () => {
      const res = await request(httpServer(app))
        .get('/api/v1/projects?locale=en&technology=no-such-technology')
        .expect(200);

      expect(res).toSatisfyApiSpec();
      expect(envelopeData<ProjectListItem[]>(res)).toEqual([]);
      expect(res.body).toHaveProperty('meta.total', 0);
    });

    it('rejects a malformed technology value with a contract-valid 422', async () => {
      const res = await request(httpServer(app))
        .get('/api/v1/projects?locale=en&technology=Node.js')
        .expect(422);

      expect(res).toSatisfyApiSpec();
    });
  });
});
