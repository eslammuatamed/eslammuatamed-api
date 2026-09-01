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

describe('Testimonials (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  const createdTestimonialIds: string[] = [];
  const unique = Date.now();

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
    for (const id of createdTestimonialIds) {
      const removed = await request(httpServer(app))
        .delete(`/api/v1/admin/testimonials/${id}`)
        .set(auth())
        .expect(204);
      expect(removed).toSatisfyApiSpec();
    }
    await app.close();
  });

  const testimonial = (tag: string, isVisible: boolean, order: number) => ({
    order,
    isVisible,
    translations: [
      {
        locale: 'en',
        quote: `E2E ${tag} testimonial ${unique}.`,
        authorName: `E2E ${tag} Author ${unique}`,
        authorRole: 'Client',
      },
    ],
  });

  it('hides invisible testimonials publicly while admin lists both', async () => {
    const visible = await request(httpServer(app))
      .post('/api/v1/admin/testimonials')
      .set(auth())
      .send(testimonial('Visible', true, 9000))
      .expect(201);
    const visibleId = envelopeData<{ id: string }>(visible).id;
    createdTestimonialIds.push(visibleId);
    expect(visible).toSatisfyApiSpec();

    const hidden = await request(httpServer(app))
      .post('/api/v1/admin/testimonials')
      .set(auth())
      .send(testimonial('Hidden', false, 9001))
      .expect(201);
    const hiddenId = envelopeData<{ id: string }>(hidden).id;
    createdTestimonialIds.push(hiddenId);
    expect(hidden).toSatisfyApiSpec();

    const publicList = await request(httpServer(app))
      .get('/api/v1/testimonials?locale=en')
      .expect(200);
    expect(publicList).toSatisfyApiSpec();
    const publicIds = envelopeData<{ id: string }[]>(publicList).map(
      (item) => item.id,
    );
    expect(publicList.body).not.toHaveProperty('meta');
    expect(publicIds).toContain(visibleId);
    expect(publicIds).not.toContain(hiddenId);

    const arPublicList = await request(httpServer(app))
      .get('/api/v1/testimonials?locale=ar')
      .expect(200);
    expect(arPublicList).toSatisfyApiSpec();
    expect(arPublicList.body).not.toHaveProperty('meta');
    expect(envelopeData<{ id: string }[]>(arPublicList)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: visibleId })]),
    );

    const adminList = await request(httpServer(app))
      .get('/api/v1/admin/testimonials')
      .set(auth())
      .expect(200);
    expect(adminList).toSatisfyApiSpec();
    const adminIds = envelopeData<{ id: string }[]>(adminList).map(
      (item) => item.id,
    );
    expect(adminIds).toEqual(expect.arrayContaining([visibleId, hiddenId]));
  });

  it('paginates the existing admin collection before slicing and retains real metadata beyond the total', async () => {
    const equalOrderOne = await request(httpServer(app))
      .post('/api/v1/admin/testimonials')
      .set(auth())
      .send(testimonial('Equal one', true, 100))
      .expect(201);
    const equalOrderOneId = envelopeData<{ id: string }>(equalOrderOne).id;
    createdTestimonialIds.push(equalOrderOneId);

    const equalOrderTwo = await request(httpServer(app))
      .post('/api/v1/admin/testimonials')
      .set(auth())
      .send(testimonial('Equal two', false, 100))
      .expect(201);
    const equalOrderTwoId = envelopeData<{ id: string }>(equalOrderTwo).id;
    createdTestimonialIds.push(equalOrderTwoId);

    const later = await request(httpServer(app))
      .post('/api/v1/admin/testimonials')
      .set(auth())
      .send(testimonial('Later', true, 200))
      .expect(201);
    const laterId = envelopeData<{ id: string }>(later).id;
    createdTestimonialIds.push(laterId);

    const page1 = await request(httpServer(app))
      .get('/api/v1/admin/testimonials?page=1&perPage=1')
      .set(auth())
      .expect(200);
    const page2 = await request(httpServer(app))
      .get('/api/v1/admin/testimonials?page=2&perPage=1')
      .set(auth())
      .expect(200);
    const page3 = await request(httpServer(app))
      .get('/api/v1/admin/testimonials?page=3&perPage=1')
      .set(auth())
      .expect(200);
    const defaultPage = await request(httpServer(app))
      .get('/api/v1/admin/testimonials')
      .set(auth())
      .expect(200);
    const maxPage = await request(httpServer(app))
      .get('/api/v1/admin/testimonials?page=1&perPage=50')
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
    expect(page1.body.meta).toEqual({
      page: 1,
      perPage: 1,
      total: 5,
      totalPages: 5,
    });
    expect(defaultPage.body.meta).toEqual({
      page: 1,
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
      .get('/api/v1/admin/testimonials?page=2&perPage=50')
      .set(auth())
      .expect(200);
    expect(beyondTotal).toSatisfyApiSpec();
    expect(envelopeData<{ id: string }[]>(beyondTotal)).toEqual([]);
    expect(beyondTotal.body.meta).toEqual({
      page: 2,
      perPage: 50,
      total: 5,
      totalPages: 1,
    });
  });

  it('rejects invalid pagination and a caller without testimonials.read', async () => {
    for (const query of [
      'page=0',
      'page=-1',
      'page=1.5',
      'perPage=0',
      'perPage=51',
      'unknown=true',
    ]) {
      const invalid = await request(httpServer(app))
        .get(`/api/v1/admin/testimonials?${query}`)
        .set(auth())
        .expect(422);
      expect(invalid).toSatisfyApiSpec();
    }

    const role = await request(httpServer(app))
      .post('/api/v1/admin/roles')
      .set(auth())
      .send({
        name: `TestimonialsReadDenied ${unique}`,
        permissions: ['testimonials.update'],
      })
      .expect(201);
    const roleId = envelopeData<{ id: string }>(role).id;
    const email = `testimonials-read-denied-${unique}@example.com`;
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
      .get('/api/v1/admin/testimonials?page=1')
      .set({
        Authorization: `Bearer ${envelopeData<{ accessToken: string }>(login).accessToken}`,
      })
      .expect(403);
    expect(forbidden).toSatisfyApiSpec();
  });

  it('denies an unauthenticated admin pagination request', async () => {
    const unauthorized = await request(httpServer(app))
      .get('/api/v1/admin/testimonials?page=1')
      .expect(401);

    expect(unauthorized).toSatisfyApiSpec();
  });
});
