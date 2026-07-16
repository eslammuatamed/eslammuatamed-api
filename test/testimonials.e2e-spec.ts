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
    expect(publicIds).toContain(visibleId);
    expect(publicIds).not.toContain(hiddenId);

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
});
