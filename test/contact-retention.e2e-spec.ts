import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { ContactService } from '../src/modules/contact/contact.service';
import { retentionCutoff } from '../src/modules/contact/contact-purge.scheduler';
import {
  createE2eApp,
  envelopeData,
  httpServer,
  OWNER_EMAIL,
  OWNER_PASSWORD,
} from './utils/e2e-app';
import { loadApiSpec } from './utils/contract';

// Retention (doc 19 §6, D09-14/D19-10): the archive transition maintains archivedAt over
// the real HTTP path, and the purge hard-deletes only rows archived more than 12 months ago.
// Requires a migrated + seeded eslammuatamed_test database.
interface Msg {
  readonly id: string;
  readonly isArchived: boolean;
  readonly archivedAt: string | null;
}

interface TrustProxyApp {
  set(setting: string, value: unknown): unknown;
}

describe('Contact retention (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  const unique = Date.now();
  let ipCounter = 0;
  const nextIp = (): string => `203.0.113.${(ipCounter++ % 250) + 1}`;

  const auth = (): Record<string, string> => ({
    Authorization: `Bearer ${ownerToken}`,
  });

  const getMessage = async (id: string): Promise<Msg> => {
    const res = await request(httpServer(app))
      .get(`/api/v1/admin/messages/${id}`)
      .set(auth())
      .expect(200);
    expect(res).toSatisfyApiSpec();
    return envelopeData<Msg>(res);
  };

  beforeAll(async () => {
    loadApiSpec();
    app = await createE2eApp();
    (app.getHttpAdapter().getInstance() as TrustProxyApp).set(
      'trust proxy',
      true,
    );
    const login = await request(httpServer(app))
      .post('/api/v1/auth/login')
      .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
    ownerToken = envelopeData<{ accessToken: string }>(login).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('archivedAt maintenance over the API (D09-14)', () => {
    it('sets archivedAt on archive and clears it on un-archive', async () => {
      const subject = `E2E retention transition ${unique}`;
      await request(httpServer(app))
        .post('/api/v1/contact')
        .set('X-Forwarded-For', nextIp())
        .send({
          name: 'Alex',
          email: 'alex@example.com',
          subject,
          body: 'A genuine message for the retention transition test.',
          elapsedMs: 8200,
        })
        .expect(200);

      const listed = await request(httpServer(app))
        .get('/api/v1/admin/messages?isRead=false&perPage=50&page=1')
        .set(auth())
        .expect(200);
      const created = envelopeData<Msg[]>(listed).find(
        (m) => (m as unknown as { subject: string }).subject === subject,
      );
      expect(created).toBeDefined();
      const id = (created as Msg).id;
      expect((created as Msg).archivedAt).toBeNull();

      // Archive -> archivedAt is set to a timestamp.
      await request(httpServer(app))
        .patch(`/api/v1/admin/messages/${id}`)
        .set(auth())
        .send({ isArchived: true })
        .expect(200);
      const archived = await getMessage(id);
      expect(archived.isArchived).toBe(true);
      expect(archived.archivedAt).not.toBeNull();
      expect(Number.isNaN(Date.parse(archived.archivedAt as string))).toBe(
        false,
      );

      // Un-archive -> archivedAt is cleared.
      await request(httpServer(app))
        .patch(`/api/v1/admin/messages/${id}`)
        .set(auth())
        .send({ isArchived: false })
        .expect(200);
      const unarchived = await getMessage(id);
      expect(unarchived.isArchived).toBe(false);
      expect(unarchived.archivedAt).toBeNull();
    });
  });

  describe('purgeArchivedOlderThan against Postgres (D19-10)', () => {
    it('deletes only rows archived more than 12 months ago; retains recent + unarchived', async () => {
      const prisma = app.get(PrismaService);
      const contact = app.get(ContactService);
      const tag = `retention-${unique}`;

      const now = new Date();
      const thirteenMonthsAgo = new Date(now.getTime());
      thirteenMonthsAgo.setMonth(thirteenMonthsAgo.getMonth() - 13);
      const oneMonthAgo = new Date(now.getTime());
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const base = {
        name: 'Retention',
        email: 'retain@example.com',
        body: 'seed row for the retention purge test',
      };
      const old = await prisma.contactMessage.create({
        data: {
          ...base,
          subject: `${tag} old-archived`,
          isArchived: true,
          archivedAt: thirteenMonthsAgo,
        },
      });
      const recent = await prisma.contactMessage.create({
        data: {
          ...base,
          subject: `${tag} recent-archived`,
          isArchived: true,
          archivedAt: oneMonthAgo,
        },
      });
      const active = await prisma.contactMessage.create({
        data: {
          ...base,
          subject: `${tag} unarchived`,
          isArchived: false,
          archivedAt: null,
        },
      });

      const deleted = await contact.purgeArchivedOlderThan(
        retentionCutoff(now),
      );
      expect(deleted).toBeGreaterThanOrEqual(1);

      // The 13-month-old archived row is gone; the recent-archived and unarchived rows survive.
      expect(
        await prisma.contactMessage.findUnique({ where: { id: old.id } }),
      ).toBeNull();
      expect(
        await prisma.contactMessage.findUnique({ where: { id: recent.id } }),
      ).not.toBeNull();
      expect(
        await prisma.contactMessage.findUnique({ where: { id: active.id } }),
      ).not.toBeNull();

      // Clean up the rows this test created (leave the table as we found it).
      await prisma.contactMessage.deleteMany({
        where: { id: { in: [recent.id, active.id] } },
      });
    });
  });
});
