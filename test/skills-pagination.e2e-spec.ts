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

type Group = 'LANGUAGE' | 'FRONTEND' | 'BACKEND' | 'DELIVERY';

type Fixture = {
  readonly group: Group;
  readonly name: string;
  readonly isPublic: boolean;
};

const fixtures: Fixture[] = [
  { group: 'LANGUAGE', name: 'Language-one', isPublic: true },
  { group: 'LANGUAGE', name: 'Language-two', isPublic: true },
  { group: 'FRONTEND', name: 'Frontend', isPublic: true },
  { group: 'BACKEND', name: 'Backend', isPublic: true },
  { group: 'DELIVERY', name: 'Delivery-hidden', isPublic: false },
];

describe('Skills admin pagination and group filter (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  const createdIds = new Map<string, string>();
  const unique = Date.now();

  const auth = (): Record<string, string> => ({
    Authorization: `Bearer ${ownerToken}`,
  });

  beforeAll(async () => {
    loadApiSpec();
    app = await createE2eApp();
    const login = await request(httpServer(app))
      .post('/api/v1/auth/login')
      .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD })
      .expect(200);
    ownerToken = envelopeData<{ accessToken: string }>(login).accessToken;

    for (const fixture of fixtures) {
      const created = await request(httpServer(app))
        .post('/api/v1/admin/skills')
        .set(auth())
        .send({
          slug: `skills-page-${fixture.name.toLowerCase()}-${unique}`,
          group: fixture.group,
          order: 0,
          isPublic: fixture.isPublic,
          translations: [
            {
              locale: 'en',
              label: `Skills page ${fixture.name} ${unique}`,
            },
          ],
        })
        .expect(201);
      expect(created).toSatisfyApiSpec();
      createdIds.set(fixture.name, envelopeData<{ id: string }>(created).id);
    }
  });

  afterAll(async () => {
    for (const id of createdIds.values()) {
      await request(httpServer(app))
        .delete(`/api/v1/admin/skills/${id}`)
        .set(auth())
        .expect(204);
    }
    await app.close();
  });

  const id = (name: string): string => {
    const value = createdIds.get(name);
    if (!value) throw new Error(`Missing fixture id for ${name}`);
    return value;
  };

  it('paginates the full admin registry deterministically before slicing', async () => {
    const languageIds = [id('Language-one'), id('Language-two')].sort();
    const page1 = await request(httpServer(app))
      .get('/api/v1/admin/skills?page=1&perPage=1')
      .set(auth())
      .expect(200);
    const page2 = await request(httpServer(app))
      .get('/api/v1/admin/skills?page=2&perPage=1')
      .set(auth())
      .expect(200);
    const page3 = await request(httpServer(app))
      .get('/api/v1/admin/skills?page=3&perPage=1')
      .set(auth())
      .expect(200);
    const page4 = await request(httpServer(app))
      .get('/api/v1/admin/skills?page=4&perPage=1')
      .set(auth())
      .expect(200);
    const page5 = await request(httpServer(app))
      .get('/api/v1/admin/skills?page=5&perPage=1')
      .set(auth())
      .expect(200);
    const defaultPage = await request(httpServer(app))
      .get('/api/v1/admin/skills')
      .set(auth())
      .expect(200);
    const perPageOnly = await request(httpServer(app))
      .get('/api/v1/admin/skills?perPage=2')
      .set(auth())
      .expect(200);
    const pageOnly = await request(httpServer(app))
      .get('/api/v1/admin/skills?page=2')
      .set(auth())
      .expect(200);
    const maxPage = await request(httpServer(app))
      .get('/api/v1/admin/skills?perPage=50')
      .set(auth())
      .expect(200);
    for (const response of [
      page1,
      page2,
      page3,
      page4,
      page5,
      defaultPage,
      perPageOnly,
      pageOnly,
      maxPage,
    ]) {
      expect(response).toSatisfyApiSpec();
    }

    expect(envelopeData<{ id: string }[]>(page1)).toEqual([
      expect.objectContaining({ id: languageIds[0] }),
    ]);
    expect(envelopeData<{ id: string }[]>(page2)).toEqual([
      expect.objectContaining({ id: languageIds[1] }),
    ]);
    expect(envelopeData<{ id: string }[]>(page3)).toEqual([
      expect.objectContaining({ id: id('Frontend') }),
    ]);
    expect(envelopeData<{ id: string }[]>(page4)).toEqual([
      expect.objectContaining({ id: id('Backend') }),
    ]);
    expect(envelopeData<{ id: string }[]>(page5)).toEqual([
      expect.objectContaining({ id: id('Delivery-hidden'), isPublic: false }),
    ]);
    expect(defaultPage.body.meta).toEqual({
      page: 1,
      perPage: 12,
      total: 5,
      totalPages: 1,
    });
    expect(perPageOnly.body.meta).toEqual({
      page: 1,
      perPage: 2,
      total: 5,
      totalPages: 3,
    });
    expect(envelopeData<{ id: string }[]>(perPageOnly)).toEqual([
      expect.objectContaining({ id: languageIds[0] }),
      expect.objectContaining({ id: languageIds[1] }),
    ]);
    expect(envelopeData<unknown[]>(pageOnly)).toEqual([]);
    expect(pageOnly.body.meta).toEqual({
      page: 2,
      perPage: 12,
      total: 5,
      totalPages: 1,
    });
    expect(maxPage.body.meta).toEqual({
      page: 1,
      perPage: 50,
      total: 5,
      totalPages: 1,
    });

    const beyondTotal = await request(httpServer(app))
      .get('/api/v1/admin/skills?page=6&perPage=1')
      .set(auth())
      .expect(200);
    expect(beyondTotal).toSatisfyApiSpec();
    expect(envelopeData<unknown[]>(beyondTotal)).toEqual([]);
    expect(beyondTotal.body.meta).toEqual({
      page: 6,
      perPage: 1,
      total: 5,
      totalPages: 5,
    });
  });

  it('filters each SkillGroup before pagination and returns filtered metadata', async () => {
    const expectedCounts: Record<Group, number> = {
      LANGUAGE: 2,
      FRONTEND: 1,
      BACKEND: 1,
      DELIVERY: 1,
    };
    for (const group of Object.keys(expectedCounts) as Group[]) {
      const response = await request(httpServer(app))
        .get(`/api/v1/admin/skills?group=${group}`)
        .set(auth())
        .expect(200);
      expect(response).toSatisfyApiSpec();
      expect(
        envelopeData<{ group: Group }[]>(response).every(
          (skill) => skill.group === group,
        ),
      ).toBe(true);
      expect(response.body.meta).toEqual({
        page: 1,
        perPage: 12,
        total: expectedCounts[group],
        totalPages: 1,
      });
    }

    const frontendFirst = await request(httpServer(app))
      .get('/api/v1/admin/skills?group=FRONTEND&perPage=1')
      .set(auth())
      .expect(200);
    expect(frontendFirst).toSatisfyApiSpec();
    expect(envelopeData<{ id: string }[]>(frontendFirst)).toEqual([
      expect.objectContaining({ id: id('Frontend') }),
    ]);
    expect(frontendFirst.body.meta).toEqual({
      page: 1,
      perPage: 1,
      total: 1,
      totalPages: 1,
    });

    const languageSecond = await request(httpServer(app))
      .get('/api/v1/admin/skills?group=LANGUAGE&page=2&perPage=1')
      .set(auth())
      .expect(200);
    const languageIds = [id('Language-one'), id('Language-two')].sort();
    expect(languageSecond).toSatisfyApiSpec();
    expect(envelopeData<{ id: string }[]>(languageSecond)).toEqual([
      expect.objectContaining({ id: languageIds[1] }),
    ]);
    expect(languageSecond.body.meta).toEqual({
      page: 2,
      perPage: 1,
      total: 2,
      totalPages: 2,
    });

    const emptyFilteredPage = await request(httpServer(app))
      .get('/api/v1/admin/skills?group=LANGUAGE&page=3&perPage=1')
      .set(auth())
      .expect(200);
    expect(emptyFilteredPage).toSatisfyApiSpec();
    expect(envelopeData<unknown[]>(emptyFilteredPage)).toEqual([]);
    expect(emptyFilteredPage.body.meta).toEqual({
      page: 3,
      perPage: 1,
      total: 2,
      totalPages: 2,
    });
  });

  it('rejects malformed pagination or an invalid group, and a caller without skills.read', async () => {
    for (const query of [
      'page=0',
      'page=-1',
      'page=1.5',
      'perPage=0',
      'perPage=51',
      'group=UNKNOWN',
      'unknown=true',
    ]) {
      const invalid = await request(httpServer(app))
        .get(`/api/v1/admin/skills?${query}`)
        .set(auth())
        .expect(422);
      expect(invalid).toSatisfyApiSpec();
    }

    const role = await request(httpServer(app))
      .post('/api/v1/admin/roles')
      .set(auth())
      .send({
        name: `SkillsReadDenied ${unique}`,
        permissions: ['skills.update'],
      })
      .expect(201);
    const roleId = envelopeData<{ id: string }>(role).id;
    const email = `skills-read-denied-${unique}@example.com`;
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

    const forbidden = await request(httpServer(app))
      .get('/api/v1/admin/skills?group=BACKEND')
      .set({
        Authorization: `Bearer ${envelopeData<{ accessToken: string }>(login).accessToken}`,
      })
      .expect(403);
    expect(forbidden).toSatisfyApiSpec();
  });

  it('denies unauthenticated admin access and preserves public visibility, locale, and array shape', async () => {
    const unauthorized = await request(httpServer(app))
      .get('/api/v1/admin/skills?page=1')
      .expect(401);
    expect(unauthorized).toSatisfyApiSpec();

    const publicEn = await request(httpServer(app))
      .get('/api/v1/skills?locale=en')
      .expect(200);
    const publicAr = await request(httpServer(app))
      .get('/api/v1/skills?locale=ar')
      .expect(200);
    expect(publicEn).toSatisfyApiSpec();
    expect(publicAr).toSatisfyApiSpec();
    expect(publicEn.body).not.toHaveProperty('meta');
    expect(publicAr.body).not.toHaveProperty('meta');

    const publicFixtureIds = fixtures
      .filter((fixture) => fixture.isPublic)
      .map((fixture) => id(fixture.name));
    const publicEnIds = envelopeData<{ id: string }[]>(publicEn).map(
      (skill) => skill.id,
    );
    const publicArIds = envelopeData<{ id: string }[]>(publicAr).map(
      (skill) => skill.id,
    );
    expect(publicEnIds).toEqual(expect.arrayContaining(publicFixtureIds));
    expect(publicEnIds).not.toContain(id('Delivery-hidden'));
    expect(publicArIds).toEqual(
      expect.not.arrayContaining([...createdIds.values()]),
    );
  });
});
