import { INestApplication } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ResponseEnvelopeInterceptor } from '../../common/interceptors/response-envelope.interceptor';
import { MediaAdminController } from './media.admin.controller';
import { MediaService } from './media.service';

// Verifies the transport-boundary behavior that unit-testing the service can't: the @Res passthrough
// yields 201 for a new asset and 200 for a duplicate, and both still flow through the global
// response envelope (single value → { data }, DataWithMeta → { data, meta }). No DB — the service is
// mocked; no guards are registered in this minimal module, so no auth is required.
describe('MediaAdminController — upload status + envelope', () => {
  let app: INestApplication;
  const media = { upload: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MediaAdminController],
      providers: [
        { provide: MediaService, useValue: media },
        { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    media.upload.mockReset();
  });

  it('returns 201 { data } for a newly created asset', async () => {
    media.upload.mockResolvedValue({
      deduplicated: false,
      asset: { id: 'asset-1', kind: 'IMAGE' },
    });

    const res = await request(app.getHttpServer())
      .post('/admin/media')
      .attach('file', Buffer.from('image-bytes'), 'photo.jpg')
      .expect(201);

    expect(res.body).toEqual({ data: { id: 'asset-1', kind: 'IMAGE' } });
  });

  it('returns 200 { data, meta.deduplicated } for a byte-identical duplicate', async () => {
    media.upload.mockResolvedValue({
      deduplicated: true,
      asset: { id: 'asset-1', kind: 'IMAGE' },
    });

    const res = await request(app.getHttpServer())
      .post('/admin/media')
      .attach('file', Buffer.from('image-bytes'), 'photo.jpg')
      .expect(200);

    expect(res.body).toEqual({
      data: { id: 'asset-1', kind: 'IMAGE' },
      meta: { deduplicated: true },
    });
  });

  it('400s when no file part is supplied', async () => {
    await request(app.getHttpServer()).post('/admin/media').expect(400);
    expect(media.upload).not.toHaveBeenCalled();
  });
});
