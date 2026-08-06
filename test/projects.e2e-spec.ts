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

  // Technology facets (D10-19) — the live defect this fixes: the filter was built from the GLOBAL
  // Skills registry, so it offered options no published project uses and options that are not
  // technologies at all.
  //
  // Every fixture below exists to isolate ONE exclusion rule, so a passing suite says which rule
  // works rather than only that the total came out right. In particular the ORPHAN skill is
  // FRONTEND/BACKEND and public and simply has no published project: without it, "PHP is absent"
  // would be proven by the group filter alone and the zero-project rule would ship untested.
  describe('technology facets', () => {
    interface Facet {
      slug: string;
      label: string;
      group: 'frontend' | 'backend';
      count: number;
    }
    interface FacetMeta {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
      facets: Facet[];
    }

    const fx = `fct${unique}`;
    const slugs = {
      frontend: `${fx}-frontend`,
      backend: `${fx}-backend`,
      orphan: `${fx}-orphan`,
      draftOnly: `${fx}-draft-only`,
      delivery: `${fx}-delivery`,
      language: `${fx}-language`,
      hidden: `${fx}-hidden`,
      enOnly: `${fx}-en-only`,
    };
    // Keyed by the fixture names above so each id is a `string`, not `string | undefined`.
    const skillIds = {} as Record<keyof typeof slugs, string>;
    const projectIds: string[] = [];

    const makeSkill = async (
      key: keyof typeof slugs,
      group: string,
      opts: { isPublic?: boolean; enOnly?: boolean } = {},
    ): Promise<void> => {
      const res = await request(httpServer(app))
        .post('/api/v1/admin/skills')
        .set(auth())
        .send({
          slug: slugs[key],
          group,
          order: 60,
          ...(opts.isPublic === false ? { isPublic: false } : {}),
          translations: opts.enOnly
            ? [{ locale: 'en', label: `EN only ${fx}` }]
            : [
                { locale: 'en', label: `Facet ${key} ${fx}` },
                { locale: 'ar', label: `سمة ${key} ${fx}` },
              ],
        })
        .expect(201);
      skillIds[key] = envelopeData<{ id: string }>(res).id;
    };

    const makeProject = async (
      name: string,
      technologyIds: string[],
      isPublished: boolean,
    ): Promise<void> => {
      const res = await request(httpServer(app))
        .post('/api/v1/admin/projects')
        .set(auth())
        .send({
          ...project(),
          isPublished,
          technologyIds,
          translations: [
            {
              locale: 'en',
              title: `Facet ${name} ${fx}`,
              slug: `${fx}-${name}`,
              summary: `Facet project ${name} ${fx}.`,
              ...sections,
            },
            {
              locale: 'ar',
              title: `مشروع ${name} ${fx}`,
              slug: `${fx}-${name}-ar`,
              summary: `مشروع سمات ${name} ${fx}.`,
              ...sections,
            },
          ],
        })
        .expect(201);
      projectIds.push(envelopeData<{ id: string }>(res).id);
    };

    const facetsFor = async (qs: string): Promise<Facet[]> => {
      const res = await request(httpServer(app))
        .get(`/api/v1/projects?${qs}`)
        .expect(200);
      expect(res).toSatisfyApiSpec();
      return (res.body as { meta: FacetMeta }).meta.facets;
    };
    // Only this suite's own fixtures — the database also holds seed skills, and asserting on the
    // whole list would make these tests fail for reasons that have nothing to do with them.
    const mine = (facets: Facet[]): Facet[] =>
      facets.filter((facet) => facet.slug.startsWith(fx));

    beforeAll(async () => {
      await makeSkill('frontend', 'FRONTEND');
      await makeSkill('backend', 'BACKEND');
      await makeSkill('orphan', 'BACKEND');
      await makeSkill('draftOnly', 'FRONTEND');
      await makeSkill('delivery', 'DELIVERY');
      await makeSkill('language', 'LANGUAGE');
      await makeSkill('hidden', 'FRONTEND', { isPublic: false });
      await makeSkill('enOnly', 'FRONTEND', { enOnly: true });

      // Two published projects on the frontend skill, one on the backend skill — so a wrong count
      // (e.g. counting rows instead of distinct projects) is visible, and the two groups differ.
      await makeProject('one', [skillIds.frontend, skillIds.backend], true);
      await makeProject(
        'two',
        [
          skillIds.frontend,
          skillIds.delivery,
          skillIds.language,
          skillIds.hidden,
          skillIds.enOnly,
        ],
        true,
      );
      // Unpublished: its technology must NOT become a facet.
      await makeProject('draft', [skillIds.draftOnly], false);
      // `orphan` deliberately gets no project at all.
    });

    afterAll(async () => {
      for (const id of projectIds) {
        await request(httpServer(app))
          .delete(`/api/v1/admin/projects/${id}`)
          .set(auth());
      }
      for (const id of Object.values(skillIds)) {
        await request(httpServer(app))
          .delete(`/api/v1/admin/skills/${id}`)
          .set(auth());
      }
    });

    it('offers a used frontend and a used backend technology, with correct counts', async () => {
      const facets = mine(await facetsFor('locale=en'));
      expect(facets).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            slug: slugs.frontend,
            group: 'frontend',
            count: 2,
          }),
          expect.objectContaining({
            slug: slugs.backend,
            group: 'backend',
            count: 1,
          }),
        ]),
      );
    });

    // THE zero-project rule. `orphan` is BACKEND and public — the group filter cannot explain its
    // absence, so only the published-project requirement can.
    it('excludes an eligible-group technology that no published project uses', async () => {
      const found = mine(await facetsFor('locale=en')).map((f) => f.slug);
      expect(found).not.toContain(slugs.orphan);
    });

    it('excludes a technology used only by an unpublished project', async () => {
      const found = mine(await facetsFor('locale=en')).map((f) => f.slug);
      expect(found).not.toContain(slugs.draftOnly);
    });

    // Delivery & Quality entries are ways of working, not things a project is built with — and this
    // one IS used by a published project, so only the group rule can exclude it.
    it('excludes a Delivery & Quality skill even when a published project uses it', async () => {
      const found = mine(await facetsFor('locale=en')).map((f) => f.slug);
      expect(found).not.toContain(slugs.delivery);
    });

    // LANGUAGE is excluded BY DESIGN, and this test exists so that stays a decision rather than a
    // side effect nobody remembers making.
    //
    // The live case is `typescript`: it sits on 4 of 4 published projects — the most-used technology
    // on the site — and the owner confirmed (2026-08-06) it is still excluded, because the approved
    // facet rule is strictly Frontend Engineering + Backend Engineering. No one-off exception is
    // granted for a language merely because every project uses it; admitting Languages to the filter
    // is a separate, explicit taxonomy and UX decision.
    //
    // The fixture mirrors that exactly: a LANGUAGE skill, public, translated, and used by a
    // published project. Every other rule would admit it, so only the group policy can exclude it —
    // which is what makes this a test of the decision rather than of the plumbing.
    it('excludes a LANGUAGE skill even when a published project uses it (owner-confirmed: `typescript`)', async () => {
      const found = mine(await facetsFor('locale=en')).map((f) => f.slug);
      expect(found).not.toContain(slugs.language);
    });

    // Visibility is a flag, not a deletion: the rows stay, the filter option must not.
    it('excludes a skill hidden from the public taxonomy', async () => {
      const found = mine(await facetsFor('locale=en')).map((f) => f.slug);
      expect(found).not.toContain(slugs.hidden);
    });

    // D10-6 — no cross-locale fallback. An English-only label must not surface on the Arabic page.
    it('omits a facet with no translation in the requested locale', async () => {
      expect(mine(await facetsFor('locale=en')).map((f) => f.slug)).toContain(
        slugs.enOnly,
      );
      expect(
        mine(await facetsFor('locale=ar')).map((f) => f.slug),
      ).not.toContain(slugs.enOnly);
    });

    it('labels facets in the requested locale', async () => {
      const en = mine(await facetsFor('locale=en')).find(
        (f) => f.slug === slugs.frontend,
      );
      const ar = mine(await facetsFor('locale=ar')).find(
        (f) => f.slug === slugs.frontend,
      );
      expect(en?.label).toBe(`Facet frontend ${fx}`);
      expect(ar?.label).toBe(`سمة frontend ${fx}`);
    });

    // Counts describe the whole published set. A per-page count would make the same chip claim a
    // different number on page 2, which is what the old global-skills filter could never get right.
    it('computes counts over the whole published set, not the current page', async () => {
      const page1 = mine(await facetsFor('locale=en&perPage=1&page=1'));
      const page2 = mine(await facetsFor('locale=en&perPage=1&page=2'));
      const unpaged = mine(await facetsFor('locale=en&perPage=50'));
      expect(page1).toEqual(unpaged);
      expect(page2).toEqual(unpaged);
    });

    // Load-bearing: narrowing facets by the active filter would collapse the list to the selected
    // chip, and there would be no way back to any other filter.
    it('does not narrow the facet list to the active technology filter', async () => {
      const unfiltered = mine(await facetsFor('locale=en'));
      const filtered = mine(
        await facetsFor(`locale=en&technology=${slugs.backend}`),
      );
      expect(filtered).toEqual(unfiltered);
    });

    // The property that makes the filter trustworthy: no chip can be a dead end.
    it('returns at least one published project for EVERY offered facet', async () => {
      for (const locale of ['en', 'ar']) {
        const facets = mine(await facetsFor(`locale=${locale}`));
        expect(facets.length).toBeGreaterThan(0);
        for (const facet of facets) {
          const res = await request(httpServer(app))
            .get(
              `/api/v1/projects?locale=${locale}&technology=${facet.slug}&perPage=50`,
            )
            .expect(200);
          const body = res.body as { data: unknown[]; meta: FacetMeta };
          expect(body.data.length).toBeGreaterThan(0);
          // …and the advertised count is the truth, not an estimate.
          expect(body.meta.total).toBe(facet.count);
        }
      }
    });
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
