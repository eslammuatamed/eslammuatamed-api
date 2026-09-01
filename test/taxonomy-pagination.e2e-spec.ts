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

type Resource = {
  readonly name: 'Categories' | 'Tags';
  readonly path: 'categories' | 'tags';
  readonly deniedPermission: 'categories.update' | 'tags.update';
  readonly createdIds: string[];
};

const resources: Resource[] = [
  {
    name: 'Categories',
    path: 'categories',
    deniedPermission: 'categories.update',
    createdIds: [],
  },
  {
    name: 'Tags',
    path: 'tags',
    deniedPermission: 'tags.update',
    createdIds: [],
  },
];

describe('Taxonomy admin pagination (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let ownerToken: string;
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
      .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD })
      .expect(200);
    ownerToken = envelopeData<{ accessToken: string }>(login).accessToken;
  });

  afterAll(async () => {
    for (const resource of resources) {
      for (const id of resource.createdIds) {
        await request(httpServer(app))
          .delete(`/api/v1/admin/${resource.path}/${id}`)
          .set(auth())
          .expect(204);
      }
    }
    await prisma.$disconnect();
    await app.close();
  });

  describe.each(resources)('$name', (resource) => {
    const create = async (label: string): Promise<string> => {
      const response = await request(httpServer(app))
        .post(`/api/v1/admin/${resource.path}`)
        .set(auth())
        .send({
          translations: [
            {
              locale: 'en',
              name: `${resource.name} ${label} ${unique}`,
              slug: `${resource.path}-${label.toLowerCase()}-${unique}`,
            },
          ],
        })
        .expect(201);
      expect(response).toSatisfyApiSpec();
      const id = envelopeData<{ id: string }>(response).id;
      resource.createdIds.push(id);
      return id;
    };

    const setFixtureDates = async (
      equalOrderIds: string[],
      laterId: string,
    ): Promise<void> => {
      if (resource.path === 'categories') {
        await prisma.category.updateMany({
          where: { id: { in: equalOrderIds } },
          data: { createdAt: new Date('2000-01-01T00:00:00.000Z') },
        });
        await prisma.category.update({
          where: { id: laterId },
          data: { createdAt: new Date('2001-01-01T00:00:00.000Z') },
        });
        return;
      }

      await prisma.tag.updateMany({
        where: { id: { in: equalOrderIds } },
        data: { createdAt: new Date('2000-01-01T00:00:00.000Z') },
      });
      await prisma.tag.update({
        where: { id: laterId },
        data: { createdAt: new Date('2001-01-01T00:00:00.000Z') },
      });
    };

    it('paginates before slicing with createdAt/id ordering and real metadata', async () => {
      const equalOrderOneId = await create('Equal-one');
      const equalOrderTwoId = await create('Equal-two');
      const laterId = await create('Later');
      await setFixtureDates([equalOrderOneId, equalOrderTwoId], laterId);

      const page1 = await request(httpServer(app))
        .get(`/api/v1/admin/${resource.path}?page=1&perPage=1`)
        .set(auth())
        .expect(200);
      const page2 = await request(httpServer(app))
        .get(`/api/v1/admin/${resource.path}?page=2&perPage=1`)
        .set(auth())
        .expect(200);
      const page3 = await request(httpServer(app))
        .get(`/api/v1/admin/${resource.path}?page=3&perPage=1`)
        .set(auth())
        .expect(200);
      const defaultPage = await request(httpServer(app))
        .get(`/api/v1/admin/${resource.path}`)
        .set(auth())
        .expect(200);
      const maxPage = await request(httpServer(app))
        .get(`/api/v1/admin/${resource.path}?page=1&perPage=50`)
        .set(auth())
        .expect(200);
      for (const response of [page1, page2, page3, defaultPage, maxPage]) {
        expect(response).toSatisfyApiSpec();
      }

      const equalOrderIds = [equalOrderOneId, equalOrderTwoId].sort();
      expect(envelopeData<{ id: string }[]>(page1)).toEqual([
        expect.objectContaining({ id: equalOrderIds[0] }),
      ]);
      expect(envelopeData<{ id: string }[]>(page2)).toEqual([
        expect.objectContaining({ id: equalOrderIds[1] }),
      ]);
      expect(envelopeData<{ id: string }[]>(page3)).toEqual([
        expect.objectContaining({ id: laterId }),
      ]);

      const total = envelopeData<unknown[]>(maxPage).length;
      expect(maxPage.body.meta).toEqual({
        page: 1,
        perPage: 50,
        total,
        totalPages: 1,
      });
      expect(defaultPage.body.meta).toEqual({
        page: 1,
        perPage: 12,
        total,
        totalPages: Math.ceil(total / 12),
      });

      const beyondTotal = await request(httpServer(app))
        .get(`/api/v1/admin/${resource.path}?page=2&perPage=50`)
        .set(auth())
        .expect(200);
      expect(beyondTotal).toSatisfyApiSpec();
      expect(envelopeData<unknown[]>(beyondTotal)).toEqual([]);
      expect(beyondTotal.body.meta).toEqual({
        page: 2,
        perPage: 50,
        total,
        totalPages: 1,
      });
    });

    it('rejects malformed pagination and a caller without the read permission', async () => {
      for (const query of [
        'page=0',
        'page=-1',
        'page=1.5',
        'perPage=0',
        'perPage=51',
        'unknown=true',
      ]) {
        const invalid = await request(httpServer(app))
          .get(`/api/v1/admin/${resource.path}?${query}`)
          .set(auth())
          .expect(422);
        expect(invalid).toSatisfyApiSpec();
      }

      const role = await request(httpServer(app))
        .post('/api/v1/admin/roles')
        .set(auth())
        .send({
          name: `${resource.name}ReadDenied ${unique}`,
          permissions: [resource.deniedPermission],
        })
        .expect(201);
      const roleId = envelopeData<{ id: string }>(role).id;
      const email = `${resource.path}-read-denied-${unique}@example.com`;
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
        .get(`/api/v1/admin/${resource.path}?page=1`)
        .set({
          Authorization: `Bearer ${envelopeData<{ accessToken: string }>(login).accessToken}`,
        })
        .expect(403);
      expect(forbidden).toSatisfyApiSpec();
    });

    it('denies unauthenticated access and keeps the public locale array unchanged', async () => {
      const unauthorized = await request(httpServer(app))
        .get(`/api/v1/admin/${resource.path}?page=1`)
        .expect(401);
      expect(unauthorized).toSatisfyApiSpec();

      const publicEn = await request(httpServer(app))
        .get(`/api/v1/${resource.path}?locale=en`)
        .expect(200);
      const publicAr = await request(httpServer(app))
        .get(`/api/v1/${resource.path}?locale=ar`)
        .expect(200);
      expect(publicEn).toSatisfyApiSpec();
      expect(publicAr).toSatisfyApiSpec();
      expect(publicEn.body).not.toHaveProperty('meta');
      expect(publicAr.body).not.toHaveProperty('meta');

      const publicEnIds = envelopeData<{ id: string }[]>(publicEn).map(
        (item) => item.id,
      );
      const publicArIds = envelopeData<{ id: string }[]>(publicAr).map(
        (item) => item.id,
      );
      expect(publicEnIds).toEqual(expect.arrayContaining(resource.createdIds));
      expect(publicArIds).toEqual(
        expect.not.arrayContaining(resource.createdIds),
      );
    });
  });
});
