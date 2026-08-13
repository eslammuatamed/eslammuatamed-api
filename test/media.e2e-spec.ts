import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import cookieParser from 'cookie-parser';
import sharp from 'sharp';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  flattenValidationErrors,
  ValidationProblemException,
} from '../src/common/http/validation-problem.exception';
import {
  STORAGE_ADAPTER,
  StorageAdapter,
} from '../src/modules/media/storage/storage-adapter.interface';
import { PrismaClient } from '../src/generated/prisma/client';
import { createPrismaClient } from '../src/prisma/standalone-client';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createE2eApp,
  envelopeData,
  httpServer,
  OWNER_EMAIL,
  OWNER_PASSWORD,
} from './utils/e2e-app';
import { loadApiSpec } from './utils/contract';

// End-to-end media pipeline against the real AppModule + a fresh migrated/seeded Postgres (doc 18
// §2, feature 003 T10). Storage is the local adapter (STORAGE_DRIVER=local) — no R2 network call.
// Contract assertions use the exported openapi.json as the oracle (jest-openapi).

// A run-unique seed so re-runs never collide on contentHash (dedup would turn a 201 into a 200).
const RUN = Date.now();

// The C-6 race barrier (see the test for why a lock and not a sleep). Same mechanism as the 9C-6
// rotation barrier: `pg_blocking_pids` is the reliable signal, because a backend queued on a row
// produces a mix of granted and waiting lock rows that counting `pg_locks` by type miscounts.
const BARRIER_DEADLINE_MS = 5_000;
const BARRIER_POLL_MS = 25;

async function waitUntilBlocked(
  observer: PrismaClient,
  expected: number,
): Promise<void> {
  const startedAt = Date.now();
  for (;;) {
    const rows = await observer.$queryRaw<{ blocked: number }[]>`
      SELECT count(*)::int AS blocked
        FROM pg_stat_activity
       WHERE datname = current_database()
         AND cardinality(pg_blocking_pids(pid)) > 0
    `;
    if ((rows[0]?.blocked ?? 0) >= expected) {
      return;
    }
    if (Date.now() - startedAt > BARRIER_DEADLINE_MS) {
      // Never a silent pass: an unformed barrier means the interleaving never happened, so the
      // assertions below would be decoration rather than proof.
      throw new Error(
        `Barrier never formed: the delete did not reach the row lock within ` +
          `${BARRIER_DEADLINE_MS} ms. This run proves nothing about the C-6 race.`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, BARRIER_POLL_MS));
  }
}

interface AdminVariant {
  readonly format: string;
  readonly width: number;
  readonly height: number;
  readonly url: string;
  readonly overBudget: boolean;
}
interface AdminAsset {
  readonly id: string;
  readonly kind: string;
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly blurhash: string | null;
  readonly variants: AdminVariant[];
}
interface PublicVariant {
  readonly format: string;
  readonly width: number;
  readonly height: number;
  readonly url: string;
}
interface PublicImageDescriptor {
  readonly id: string;
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly variants: PublicVariant[];
}
interface Usage {
  readonly type: string;
  readonly id: string;
}

// A valid PNG whose bytes are unique per (seed): distinct seed → distinct content → distinct hash.
async function pngImage(
  seed: number,
  width = 1400,
  height = 900,
): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
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

describe('Media pipeline (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let ownerToken: string;
  const owner = (): Record<string, string> => ({
    Authorization: `Bearer ${ownerToken}`,
  });

  beforeAll(async () => {
    loadApiSpec();
    app = await createE2eApp();
    server = httpServer(app);
    const login = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
    ownerToken = envelopeData<{ accessToken: string }>(login).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  const uploadImage = (
    token: string | null,
    buffer: Buffer,
    filename = 'photo.png',
  ): request.Test => {
    const req = request(server).post('/api/v1/admin/media');
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req.attach('file', buffer, filename);
  };

  // Creates a scoped role + user with exactly `permissions` and returns its access token. Used to
  // prove permission enforcement (403) and to isolate the throttle test on its own user+IP bucket.
  async function tokenFor(
    permissions: string[],
    label: string,
  ): Promise<string> {
    const roleRes = await request(server)
      .post('/api/v1/admin/roles')
      .set(owner())
      .send({ name: `${label}-${RUN}`, permissions })
      .expect(201);
    const roleId = envelopeData<{ id: string }>(roleRes).id;
    const email = `${label}-${RUN}@example.com`;
    const password = 'change-me-minimum-12';
    await request(server)
      .post('/api/v1/admin/users')
      .set(owner())
      .send({ email, password, roleId })
      .expect(201);
    const login = await request(server)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return envelopeData<{ accessToken: string }>(login).accessToken;
  }

  it('rejects an unauthenticated upload with 401 (contract-valid problem+json)', async () => {
    const res = await uploadImage(null, await pngImage(RUN + 1));
    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res).toSatisfyApiSpec();
  });

  it('forbids an authenticated user without media.create with 403', async () => {
    const token = await tokenFor(['categories.read'], 'nomedia');
    const res = await uploadImage(token, await pngImage(RUN + 2));
    expect(res.status).toBe(403);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res).toSatisfyApiSpec();
  });

  it('accepts an authorized upload → 201 with a WebP master + WebP/AVIF renditions', async () => {
    const res = await uploadImage(ownerToken, await pngImage(RUN + 3)).expect(
      201,
    );
    expect(res).toSatisfyApiSpec();
    const asset = envelopeData<AdminAsset>(res);
    expect(asset.kind).toBe('IMAGE');
    expect(asset.url).toContain('webp'); // descriptor url = widest WebP rendition
    expect(asset.blurhash).toBeTruthy();
    expect(asset.variants.length).toBeGreaterThan(0);
    expect(
      asset.variants.every((v) => v.format === 'WEBP' || v.format === 'AVIF'),
    ).toBe(true);
  });

  // D20-20 end-to-end: a source strictly between two configured tiers gets a terminal rendition at
  // its own width, in both public formats. 1086 is the approved About portrait's width, so this is
  // the real case rather than a synthetic one.
  it('emits a terminal rendition at the source width for a between-tiers source (D20-20)', async () => {
    const res = await uploadImage(
      ownerToken,
      await pngImage(RUN + 20, 1086, 1448),
    ).expect(201);
    expect(res).toSatisfyApiSpec();
    const asset = envelopeData<AdminAsset>(res);

    const widths = [...new Set(asset.variants.map((v) => v.width))].sort(
      (a, b) => a - b,
    );
    expect(widths).toEqual([640, 1086]);
    expect(widths).not.toContain(1280); // never invented above the source

    for (const width of widths) {
      const formats = asset.variants
        .filter((v) => v.width === width)
        .map((v) => v.format)
        .sort();
      expect(formats).toEqual(['AVIF', 'WEBP']);
    }

    // The width in the URL is the width in the row — a storage key that disagreed with its
    // descriptor would be a falsely-labelled source wearing a truthful number.
    for (const variant of asset.variants) {
      expect(variant.url).toContain(`/${variant.width}-`);
    }
  }, 60000);

  // D10-14 end-to-end, against the PUBLIC descriptor — which is what the contract governs. The admin
  // entity deliberately still reports the master's own width/height (the dashboard needs the real
  // master facts); only the public descriptor is required to be self-consistent.
  it('reports public url/width/height from the same widest WebP rendition (D10-14)', async () => {
    const asset = envelopeData<AdminAsset>(
      await uploadImage(
        ownerToken,
        await pngImage(RUN + 21, 1086, 1448),
      ).expect(201),
    );
    await request(server)
      .post('/api/v1/admin/testimonials')
      .set(owner())
      .send({
        avatarId: asset.id,
        order: 30,
        isVisible: true,
        translations: [
          {
            locale: 'en',
            quote: 'Portrait descriptor check.',
            authorName: 'A',
            authorRole: 'R',
          },
        ],
      })
      .expect(201);

    const publicList = await request(server)
      .get('/api/v1/testimonials?locale=en')
      .expect(200);
    expect(publicList).toSatisfyApiSpec();

    const descriptor = envelopeData<{ avatar: PublicImageDescriptor | null }[]>(
      publicList,
    )
      .map((t) => t.avatar)
      .find((a) => a !== null && a.id === asset.id);
    expect(descriptor).toBeDefined();
    if (!descriptor) return;

    // The terminal rendition is the widest public WebP, so the top level must point at 1086 — not the
    // 640 rendition, and not the 1086x1448 master (whose dimensions happen to coincide here, which is
    // exactly why `url` is asserted too rather than the numbers alone).
    const webp = descriptor.variants.filter((v) => v.format === 'WEBP');
    const widest = webp.reduce((a, b) => (b.width > a.width ? b : a));
    expect(widest.width).toBe(1086);
    expect(descriptor.url).toBe(widest.url);
    expect(descriptor.width).toBe(widest.width);
    expect(descriptor.height).toBe(widest.height);
    expect(descriptor.url).not.toContain('master'); // master is never a public URL
  }, 60000);

  it('deduplicates identical bytes → 200 with meta.deduplicated and the same asset id', async () => {
    const buffer = await pngImage(RUN + 4);
    const first = await uploadImage(ownerToken, buffer).expect(201);
    const second = await uploadImage(ownerToken, buffer).expect(200);
    expect(second).toSatisfyApiSpec();
    expect(
      (second.body as { meta: { deduplicated: boolean } }).meta.deduplicated,
    ).toBe(true);
    expect(envelopeData<AdminAsset>(second).id).toBe(
      envelopeData<AdminAsset>(first).id,
    );
  });

  it('blocks deleting a referenced asset with 409 + usages, and deletes an unreferenced one with 204', async () => {
    const asset = envelopeData<AdminAsset>(
      await uploadImage(ownerToken, await pngImage(RUN + 5)).expect(201),
    );
    // Reference it as a testimonial avatar so deletion is usage-guarded.
    await request(server)
      .post('/api/v1/admin/testimonials')
      .set(owner())
      .send({
        avatarId: asset.id,
        order: 0,
        isVisible: true,
        translations: [
          {
            locale: 'en',
            quote: 'Great work.',
            authorName: 'Alex',
            authorRole: 'CTO',
          },
        ],
      })
      .expect(201);

    const usages = await request(server)
      .get(`/api/v1/admin/media/${asset.id}/usages`)
      .set(owner())
      .expect(200);
    expect(usages).toSatisfyApiSpec();
    expect(
      envelopeData<Usage[]>(usages).some(
        (u) => u.type === 'testimonial-avatar',
      ),
    ).toBe(true);

    const conflict = await request(server)
      .delete(`/api/v1/admin/media/${asset.id}`)
      .set(owner());
    expect(conflict.status).toBe(409);
    expect(conflict.headers['content-type']).toContain(
      'application/problem+json',
    );
    expect(conflict).toSatisfyApiSpec();
    expect(
      (conflict.body as { usages: unknown[] }).usages.length,
    ).toBeGreaterThan(0);

    // An unreferenced asset deletes cleanly (row + variants + objects) → 204.
    const orphanFree = envelopeData<AdminAsset>(
      await uploadImage(ownerToken, await pngImage(RUN + 6)).expect(201),
    );
    await request(server)
      .delete(`/api/v1/admin/media/${orphanFree.id}`)
      .set(owner())
      .expect(204);
  });

  // ── C-6 — the race the pre-check cannot win (D07-7) ────────────────────────────────────────
  //
  // The usage read at the top of `remove()` is stale the moment it returns. This proves the
  // RESTRICT foreign key — not that read — is what decides, and that the reordering keeps the
  // objects on disk when the database says no.
  //
  // The barrier is the FK's own parent-row lock, not a sleep. A separate connection INSERTs a
  // referencing row and holds the transaction open: under READ COMMITTED the request's pre-check
  // cannot see the uncommitted row (so it proceeds exactly as in the unguarded case), while the
  // authoritative DELETE must wait for that transaction to resolve. Committing it turns the wait
  // into a 23503 → P2003, which is the precise interleaving the defect needed.
  it('keeps the objects on disk and 409s when a reference is committed mid-delete', async () => {
    // Its own user, so this upload does not consume the owner's 10/min throttle bucket.
    const token = await tokenFor(
      ['media.create', 'media.read', 'media.delete'],
      'c6-race',
    );
    const auth = { Authorization: `Bearer ${token}` };
    const asset = envelopeData<AdminAsset>(
      await uploadImage(token, await pngImage(RUN + 90)).expect(201),
    );

    const prisma = app.get(PrismaService);
    const stored = await prisma.mediaAsset.findUniqueOrThrow({
      where: { id: asset.id },
      include: { variants: { select: { storageKey: true } } },
    });
    const keys = [
      stored.storageKey,
      ...stored.variants.map((v) => v.storageKey),
    ];
    const storageDir = process.env.STORAGE_LOCAL_DIR;
    expect(storageDir).toBeDefined();
    const onDisk = (): boolean[] =>
      keys.map((key) => existsSync(join(storageDir as string, key)));
    // The instrument itself: if the objects were never written, "still present" proves nothing.
    expect(onDisk()).toEqual(keys.map(() => true));

    const blocker = createPrismaClient();
    const observer = createPrismaClient();
    let released!: () => void;
    const release = new Promise<void>((resolve) => {
      released = resolve;
    });
    let inserted!: () => void;
    const referenceExists = new Promise<void>((resolve) => {
      inserted = resolve;
    });

    try {
      // T2: create the reference, and hold it uncommitted until the delete is observably blocked.
      const held = blocker.$transaction(
        async (tx) => {
          const project = await tx.project.create({ data: {} });
          await tx.projectGalleryItem.create({
            data: { projectId: project.id, mediaAssetId: asset.id },
          });
          inserted();
          await release;
        },
        { timeout: BARRIER_DEADLINE_MS * 4 },
      );

      // Ordering matters and cannot be left to chance: the reference must already exist
      // (uncommitted) before the delete starts, or the delete simply wins and removes the asset —
      // which then makes T2's own insert fail on the FK and proves nothing. Racing against `held`
      // surfaces an error in the transaction instead of hanging here forever.
      await Promise.race([referenceExists, held]);

      // T1: the delete. Not awaited — it must be in flight for the barrier to form.
      const deleting = request(server)
        .delete(`/api/v1/admin/media/${asset.id}`)
        .set(auth);
      const settled = deleting.then((r) => r);

      await waitUntilBlocked(observer, 1);
      // Blocked, therefore: the pre-check already passed and the authoritative DELETE is queued
      // behind T2. Objects must still be on disk at this exact moment — the old ordering had
      // already removed them by now.
      expect(onDisk()).toEqual(keys.map(() => true));

      released();
      await held;

      const conflict = await settled;

      expect(conflict.status).toBe(409);
      expect(conflict.headers['content-type']).toContain(
        'application/problem+json',
      );
      expect(conflict).toSatisfyApiSpec();
      // Truthful usages: the reference that actually blocked it, re-read after the rejection.
      const usages = (conflict.body as { usages: Usage[] }).usages;
      expect(usages.some((u) => u.type === 'project-gallery')).toBe(true);
      // No raw Prisma/driver detail escapes.
      const serialized = JSON.stringify(conflict.body);
      expect(serialized).not.toContain('P2003');
      expect(serialized).not.toContain('23503');
      expect(serialized).not.toContain('_fkey');

      // THE C-6 INVARIANT: the database refused, so storage was never touched.
      expect(onDisk()).toEqual(keys.map(() => true));
      expect(await prisma.mediaAsset.count({ where: { id: asset.id } })).toBe(
        1,
      );
      expect(
        await prisma.projectGalleryItem.count({
          where: { mediaAssetId: asset.id },
        }),
      ).toBe(1);
    } finally {
      released();
      await blocker.$disconnect();
      await observer.$disconnect();
    }
    // Provisioning a scoped user (argon2) plus the barrier deadline exceeds jest's 5 s default.
  }, 30_000);

  // The success path, proven at the object level rather than by status alone (§12).
  it('removes the row and every stored object exactly once on an unreferenced delete', async () => {
    const token = await tokenFor(
      ['media.create', 'media.read', 'media.delete'],
      'c6-success',
    );
    const auth = { Authorization: `Bearer ${token}` };
    const asset = envelopeData<AdminAsset>(
      await uploadImage(token, await pngImage(RUN + 91)).expect(201),
    );
    const prisma = app.get(PrismaService);
    const stored = await prisma.mediaAsset.findUniqueOrThrow({
      where: { id: asset.id },
      include: { variants: { select: { storageKey: true } } },
    });
    const keys = [
      stored.storageKey,
      ...stored.variants.map((v) => v.storageKey),
    ];
    expect(new Set(keys).size).toBe(keys.length); // each key exactly once
    const storageDir = process.env.STORAGE_LOCAL_DIR as string;
    expect(keys.map((k) => existsSync(join(storageDir, k)))).toEqual(
      keys.map(() => true),
    );

    await request(server)
      .delete(`/api/v1/admin/media/${asset.id}`)
      .set(auth)
      .expect(204);

    expect(keys.map((k) => existsSync(join(storageDir, k)))).toEqual(
      keys.map(() => false),
    );
    expect(await prisma.mediaAsset.count({ where: { id: asset.id } })).toBe(0);
    // The CASCADE side of the same single delete.
    expect(
      await prisma.mediaAssetVariant.count({
        where: { mediaAssetId: asset.id },
      }),
    ).toBe(0);
  }, 30_000);

  it('rejects a non-image (spoofed extension) with 422 and creates no orphan row', async () => {
    const prisma = app.get(PrismaService);
    const before = await prisma.mediaAsset.count();
    const notImage = Buffer.from(`definitely not an image ${RUN}`);
    const res = await uploadImage(ownerToken, notImage, 'evil.jpg');
    expect(res.status).toBe(422);
    expect(res).toSatisfyApiSpec();
    expect(await prisma.mediaAsset.count()).toBe(before);
  });

  it('resolves a public media descriptor as an object when present and as null when absent (contract-valid both ways)', async () => {
    // Present: a visible testimonial whose avatar is an uploaded image → descriptor object.
    const asset = envelopeData<AdminAsset>(
      await uploadImage(ownerToken, await pngImage(RUN + 9)).expect(201),
    );
    await request(server)
      .post('/api/v1/admin/testimonials')
      .set(owner())
      .send({
        avatarId: asset.id,
        order: 1,
        isVisible: true,
        translations: [
          {
            locale: 'en',
            quote: 'With avatar.',
            authorName: 'A',
            authorRole: 'R',
          },
        ],
      })
      .expect(201);
    // Null: a visible testimonial with no avatar → descriptor null.
    await request(server)
      .post('/api/v1/admin/testimonials')
      .set(owner())
      .send({
        order: 2,
        isVisible: true,
        translations: [
          {
            locale: 'en',
            quote: 'No avatar.',
            authorName: 'B',
            authorRole: 'R',
          },
        ],
      })
      .expect(201);

    const publicList = await request(server)
      .get('/api/v1/testimonials?locale=en')
      .expect(200);
    // The oracle now accepts BOTH a descriptor object and null for the nullable $ref (the T9→T10 fix).
    expect(publicList).toSatisfyApiSpec();
    const avatars = envelopeData<{ avatar: unknown }[]>(publicList).map(
      (t) => t.avatar,
    );
    expect(avatars.some((a) => a !== null && typeof a === 'object')).toBe(true);
    expect(avatars.some((a) => a === null)).toBe(true);
  });

  // Kept last: fills a dedicated user's throttle bucket so it never bleeds into OWNER's window.
  it('throttles the 11th upload in a minute with 429 + Retry-After (RFC 7807)', async () => {
    const token = await tokenFor(['media.create'], 'throttle');
    const buffer = await pngImage(RUN + 7); // 1st → 201, 2nd–10th → 200 dedup; all count toward the cap.
    for (let i = 0; i < 10; i++) {
      const res = await uploadImage(token, buffer);
      expect([200, 201]).toContain(res.status);
    }
    const blocked = await uploadImage(token, buffer);
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(blocked.headers['content-type']).toContain(
      'application/problem+json',
    );
    expect(blocked).toSatisfyApiSpec();
  });
});

// A separate app whose storage fails AFTER the master object is written, exercising the real D07-6
// compensation path (objects-before-row; delete-exactly-what-was-uploaded; no orphan row).
describe('Media upload compensation on storage failure (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let ownerToken: string;
  const uploadedKeys: string[] = [];
  const deleteManyCalls: string[][] = [];
  let putCount = 0;

  const failingStorage: StorageAdapter = {
    // Succeed on the first put (master), fail on the next (first rendition) so `uploaded` is non-empty
    // when the failure hits — the cleanup must delete exactly that key.
    put: (input) => {
      putCount += 1;
      if (putCount >= 2) {
        return Promise.reject(new Error('storage unavailable (injected)'));
      }
      uploadedKeys.push(input.key);
      return Promise.resolve();
    },
    delete: () => Promise.resolve(),
    deleteMany: (keys) => {
      deleteManyCalls.push([...keys]);
      return Promise.resolve({ deleted: [...keys], failed: [] });
    },
    publicUrl: (key) => `http://media.test/${key}`,
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(STORAGE_ADAPTER)
      .useValue(failingStorage)
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: (errors) =>
          new ValidationProblemException(flattenValidationErrors(errors)),
      }),
    );
    await app.init();
    server = app.getHttpServer() as App;
    const login = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
    ownerToken = envelopeData<{ accessToken: string }>(login).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('deletes the already-written objects and leaves no orphan row when a later put fails', async () => {
    const prisma = app.get(PrismaService);
    const buffer = await pngImage(RUN + 8, 700, 500); // master + ≥1 rendition → ≥2 puts
    const contentHash = createHash('sha256').update(buffer).digest('hex');

    const res = await request(server)
      .post('/api/v1/admin/media')
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('file', buffer, 'photo.png');

    // A raw storage failure is sanitized to a 500 problem+json (undocumented by design → not
    // asserted against the contract).
    expect(res.status).toBe(500);
    expect(res.headers['content-type']).toContain('application/problem+json');

    // Compensation ran: the master object that was written is deleted, and no MediaAsset row exists.
    expect(uploadedKeys.length).toBeGreaterThan(0);
    expect(deleteManyCalls.flat()).toEqual(
      expect.arrayContaining(uploadedKeys),
    );
    expect(
      await prisma.mediaAsset.findUnique({ where: { contentHash } }),
    ).toBeNull();
  });
});
