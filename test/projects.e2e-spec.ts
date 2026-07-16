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
});
