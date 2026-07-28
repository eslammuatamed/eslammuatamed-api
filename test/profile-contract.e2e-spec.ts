import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import sharp from 'sharp';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { loadApiSpec } from './utils/contract';
import {
  createE2eApp,
  envelopeData,
  httpServer,
  OWNER_EMAIL,
  OWNER_PASSWORD,
} from './utils/e2e-app';

// Profile pages data contract (docs 02 v1.5.0, 09 v1.8.0, 10 v1.7.0). Covers the integration
// behaviour that unit tests with a mocked Prisma cannot prove: real FK restriction, cascade,
// media usages, and the shape of the exported contract itself.

const RUN = Date.now() % 100_000;

async function pngImage(seed: number): Promise<Buffer> {
  return sharp({
    create: {
      width: 1200,
      height: 1500,
      channels: 3,
      background: {
        r: seed % 256,
        g: (seed >> 8) % 256,
        b: (seed >> 16) % 256,
      },
    },
  })
    .png()
    .toBuffer();
}

describe('Profile contract (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let prisma: PrismaService;
  let ownerToken: string;
  const owner = (): Record<string, string> => ({
    Authorization: `Bearer ${ownerToken}`,
  });

  beforeAll(async () => {
    loadApiSpec();
    app = await createE2eApp();
    server = httpServer(app);
    prisma = app.get(PrismaService);
    const login = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
    ownerToken = envelopeData<{ accessToken: string }>(login).accessToken;
  });

  afterAll(async () => {
    // Leave settings as the seed left them so the suite is order-independent.
    await request(server)
      .patch('/api/v1/admin/settings')
      .set(owner())
      .send({ portraitAssetId: null });
    await app.close();
  });

  describe('portrait media', () => {
    let imageId: string;

    it('accepts an IMAGE asset and exposes both the id and the resolved descriptor', async () => {
      const upload = await request(server)
        .post('/api/v1/admin/media')
        .set(owner())
        .attach('file', await pngImage(RUN + 1), 'portrait.png')
        .expect(201);
      imageId = envelopeData<{ id: string }>(upload).id;

      await request(server)
        .patch('/api/v1/admin/settings')
        .set(owner())
        .send({ portraitAssetId: imageId })
        .expect(200);

      const res = await request(server)
        .get('/api/v1/settings/site?locale=en')
        .expect(200);
      expect(res).toSatisfyApiSpec();

      const data = envelopeData<{
        portraitAssetId: string | null;
        portrait: {
          id: string;
          kind: string;
          url: string;
          width: number;
          height: number;
          blurhash: string | null;
          alt: string | null;
          variants: { format: string; width: number; url: string }[];
        } | null;
      }>(res);

      expect(data.portraitAssetId).toBe(imageId);
      expect(data.portrait?.id).toBe(imageId);
      expect(data.portrait?.kind).toBe('IMAGE');
      // Dimensions, blurhash and variants come from the existing image descriptor contract.
      expect(data.portrait?.width).toBeGreaterThan(0);
      expect(data.portrait?.height).toBeGreaterThan(0);
      expect(data.portrait?.variants.length).toBeGreaterThan(0);
      expect(data.portrait?.url).toContain('.webp');
    });

    it('resolves alt per locale with no cross-locale fallback', async () => {
      await request(server)
        .patch(`/api/v1/admin/media/${imageId}`)
        .set(owner())
        .send({ locale: 'en', alt: 'Portrait of Eslam' })
        .expect(200);

      const en = await request(server).get('/api/v1/settings/site?locale=en');
      const ar = await request(server).get('/api/v1/settings/site?locale=ar');

      expect(
        envelopeData<{ portrait: { alt: string | null } }>(en).portrait.alt,
      ).toBe('Portrait of Eslam');
      // No ar alt row → null, never the English value.
      expect(
        envelopeData<{ portrait: { alt: string | null } }>(ar).portrait.alt,
      ).toBeNull();
    });

    it('reports the portrait in media usages and refuses deletion with 409', async () => {
      const usages = await request(server)
        .get(`/api/v1/admin/media/${imageId}/usages`)
        .set(owner())
        .expect(200);
      expect(
        envelopeData<{ type: string }[]>(usages).map((u) => u.type),
      ).toContain('settings-portrait');

      await request(server)
        .delete(`/api/v1/admin/media/${imageId}`)
        .set(owner())
        .expect(409);
    });

    it('rejects a PDF asset for the portrait slot with 422', async () => {
      const settings = await prisma.siteSettings.findFirst({
        select: { resumeAssetId: true },
      });
      const pdf =
        settings?.resumeAssetId ??
        (
          await prisma.mediaAsset.findFirst({
            where: { kind: 'PDF' },
            select: { id: true },
          })
        )?.id;

      if (!pdf) {
        // No PDF in this database; a nonexistent id exercises the same guard.
        await request(server)
          .patch('/api/v1/admin/settings')
          .set(owner())
          .send({ portraitAssetId: '00000000-0000-4000-8000-000000000000' })
          .expect(422);
        return;
      }

      await request(server)
        .patch('/api/v1/admin/settings')
        .set(owner())
        .send({ portraitAssetId: pdf })
        .expect(422);
    });

    it('clears the portrait without deleting the reusable asset', async () => {
      await request(server)
        .patch('/api/v1/admin/settings')
        .set(owner())
        .send({ portraitAssetId: null })
        .expect(200);

      const res = await request(server).get('/api/v1/settings/site?locale=en');
      const data = envelopeData<{
        portraitAssetId: string | null;
        portrait: unknown;
      }>(res);
      expect(data.portraitAssetId).toBeNull();
      expect(data.portrait).toBeNull();

      // The asset survives and is now deletable, proving RESTRICT released.
      await expect(
        prisma.mediaAsset.findUnique({ where: { id: imageId } }),
      ).resolves.toBeTruthy();
      await request(server)
        .delete(`/api/v1/admin/media/${imageId}`)
        .set(owner())
        .expect(204);
    });
  });

  describe('email fields', () => {
    it('rejects an invalid address and accepts null clearing', async () => {
      await request(server)
        .patch('/api/v1/admin/settings')
        .set(owner())
        .send({ professionalEmail: 'not-an-email' })
        .expect(422);

      await request(server)
        .patch('/api/v1/admin/settings')
        .set(owner())
        .send({ contactEmail: null })
        .expect(200);

      const cleared = await request(server).get(
        '/api/v1/settings/site?locale=en',
      );
      expect(
        envelopeData<{ contactEmail: string | null }>(cleared).contactEmail,
      ).toBeNull();

      // Restore, and prove surrounding whitespace is trimmed rather than stored.
      await request(server)
        .patch('/api/v1/admin/settings')
        .set(owner())
        .send({ contactEmail: '  contact@eslammuatamed.com  ' })
        .expect(200);
      const restored = await request(server).get(
        '/api/v1/settings/site?locale=en',
      );
      expect(
        envelopeData<{ contactEmail: string | null }>(restored).contactEmail,
      ).toBe('contact@eslammuatamed.com');
    });

    it('rejects an address longer than 254 characters', async () => {
      const long = `${'a'.repeat(250)}@example.com`;
      await request(server)
        .patch('/api/v1/admin/settings')
        .set(owner())
        .send({ professionalEmail: long })
        .expect(422);
    });
  });

  describe('experience technologies', () => {
    it('restricts deleting a Skill referenced by an experience', async () => {
      const link = await prisma.experienceTechnology.findFirst();
      expect(link).toBeTruthy();
      // RESTRICT surfaces as a Prisma foreign-key error rather than a silent unlink.
      await expect(
        prisma.skill.delete({ where: { id: link!.skillId } }),
      ).rejects.toThrow();
    });

    it('cascades link removal when the experience is deleted', async () => {
      const skill = await prisma.skill.findFirst({ select: { id: true } });
      const created = await prisma.experience.create({
        data: {
          startDate: new Date('2020-01-01'),
          isCurrent: false,
          employmentType: 'FULL_TIME',
          order: 99,
          translations: {
            create: {
              locale: 'en',
              role: 'Cascade probe',
              company: 'Probe',
              location: 'Remote',
              impact: '- probe',
            },
          },
          technologies: { create: { skillId: skill!.id } },
        },
      });

      await prisma.experience.delete({ where: { id: created.id } });
      await expect(
        prisma.experienceTechnology.count({
          where: { experienceId: created.id },
        }),
      ).resolves.toBe(0);
    });

    it('returns localized {id,label} ordered by Skill.order', async () => {
      const res = await request(server)
        .get('/api/v1/experiences?locale=ar')
        .expect(200);
      expect(res).toSatisfyApiSpec();

      const rows =
        envelopeData<{ technologies: { id: string; label: string }[] }[]>(res);
      const withTech = rows.find((row) => row.technologies.length > 1);
      expect(withTech).toBeDefined();
      for (const technology of withTech!.technologies) {
        expect(Object.keys(technology).sort()).toEqual(['id', 'label']);
      }

      const orders = await Promise.all(
        withTech!.technologies.map(
          async (technology) =>
            (
              await prisma.skill.findUnique({
                where: { id: technology.id },
                select: { order: true },
              })
            )?.order,
        ),
      );
      expect(orders).toEqual([...orders].sort((a, b) => (a ?? 0) - (b ?? 0)));
    });
  });

  describe('exported contract', () => {
    it('never exposes the dashboard-auth address as content', () => {
      const spec = readFileSync(join(__dirname, '..', 'openapi.json'), 'utf8');
      expect(spec).not.toContain('adminEmail');
      expect(spec).not.toContain('eslammuatemed@gmail.com');
    });
  });
});
