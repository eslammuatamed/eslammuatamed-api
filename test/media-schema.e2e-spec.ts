import { Prisma } from '../src/generated/prisma/client';
import { createPrismaClient } from '../src/prisma/standalone-client';

// Schema/migration tests (Feature 003, T3): exercise the database constraints added by the
// media migration directly against Postgres — unique keys, positive/format CHECKs, the
// kind<->fields CHECK, CASCADE children, and RESTRICT usage. No Nest app or HTTP surface;
// a plain PrismaClient against the test database (doc 18 §2). Requires a running Postgres.
describe('Media schema constraints (e2e)', () => {
  const prisma = createPrismaClient();
  const run = `ms-${Date.now()}`;
  let keyN = 0;
  let hashN = 0;
  const createdAssetIds: string[] = [];
  const createdTestimonialIds: string[] = [];

  const key = (): string => `${run}-${keyN++}`;
  // 64-char lowercase hex — the shape the content_hash CHECK requires.
  const hash = (): string => (hashN++).toString(16).padStart(64, '0');

  const imageData = (
    overrides: Partial<Prisma.MediaAssetUncheckedCreateInput> = {},
  ): Prisma.MediaAssetUncheckedCreateInput => ({
    kind: 'IMAGE',
    storageKey: key(),
    originalFilename: 'photo.webp',
    mimeType: 'image/webp',
    sizeBytes: 1000,
    contentHash: hash(),
    width: 1920,
    height: 1080,
    blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
    ...overrides,
  });

  const pdfData = (
    overrides: Partial<Prisma.MediaAssetUncheckedCreateInput> = {},
  ): Prisma.MediaAssetUncheckedCreateInput => ({
    kind: 'PDF',
    storageKey: key(),
    originalFilename: 'cv.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 2000,
    contentHash: hash(),
    width: null,
    height: null,
    blurhash: null,
    ...overrides,
  });

  const makeImage = async (
    overrides: Partial<Prisma.MediaAssetUncheckedCreateInput> = {},
  ): Promise<{ id: string }> => {
    const asset = await prisma.mediaAsset.create({
      data: imageData(overrides),
    });
    createdAssetIds.push(asset.id);
    return asset;
  };

  // A CHECK violation surfaces the Postgres message ("violates check constraint ...").
  const expectCheckRejection = (promise: Promise<unknown>): Promise<void> =>
    expect(promise).rejects.toThrow(/violates check constraint/i);

  beforeAll(async () => {
    await prisma.locale.upsert({
      where: { code: 'en' },
      create: {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        dir: 'ltr',
      },
      update: {},
    });
  });

  afterAll(async () => {
    if (createdTestimonialIds.length > 0) {
      await prisma.testimonial.deleteMany({
        where: { id: { in: createdTestimonialIds } },
      });
    }
    if (createdAssetIds.length > 0) {
      await prisma.mediaAsset.deleteMany({
        where: { id: { in: createdAssetIds } },
      });
    }
    await prisma.$disconnect();
  });

  it('rejects a duplicate contentHash (unique)', async () => {
    const shared = hash();
    await makeImage({ contentHash: shared });
    const err: unknown = await makeImage({ contentHash: shared }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((err as Prisma.PrismaClientKnownRequestError).code).toBe('P2002');
  });

  it('rejects a duplicate variant tuple [mediaAssetId, format, width] (unique)', async () => {
    const asset = await makeImage();
    const variant = {
      mediaAssetId: asset.id,
      format: 'WEBP' as const,
      width: 640,
      height: 360,
      sizeBytes: 500,
    };
    await prisma.mediaAssetVariant.create({
      data: { ...variant, storageKey: key() },
    });
    const err: unknown = await prisma.mediaAssetVariant
      .create({ data: { ...variant, storageKey: key() } })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((err as Prisma.PrismaClientKnownRequestError).code).toBe('P2002');
  });

  it('enforces positive sizeBytes and dimensions (CHECK)', async () => {
    await expectCheckRejection(
      prisma.mediaAsset.create({ data: imageData({ sizeBytes: 0 }) }),
    );
    const asset = await makeImage();
    await expectCheckRejection(
      prisma.mediaAssetVariant.create({
        data: {
          mediaAssetId: asset.id,
          format: 'AVIF',
          width: 0,
          height: 100,
          storageKey: key(),
          sizeBytes: 10,
        },
      }),
    );
  });

  it('enforces a 64-char lowercase SHA-256 hex contentHash (CHECK)', async () => {
    await expectCheckRejection(
      prisma.mediaAsset.create({
        data: imageData({ contentHash: 'not-a-hash' }),
      }),
    );
    // uppercase hex is rejected — the service must emit lowercase (crypto default) so dedup is stable.
    await expectCheckRejection(
      prisma.mediaAsset.create({
        data: imageData({ contentHash: 'A'.repeat(64) }),
      }),
    );
  });

  it('enforces kind<->fields consistency (CHECK)', async () => {
    // IMAGE requires width/height/blurhash + image/webp master MIME.
    await expectCheckRejection(
      prisma.mediaAsset.create({ data: imageData({ width: null }) }),
    );
    await expectCheckRejection(
      prisma.mediaAsset.create({ data: imageData({ mimeType: 'image/png' }) }),
    );
    // PDF requires null dimensions/blurhash + application/pdf MIME.
    await expectCheckRejection(
      prisma.mediaAsset.create({ data: pdfData({ width: 100 }) }),
    );
    await expectCheckRejection(
      prisma.mediaAsset.create({ data: pdfData({ mimeType: 'image/webp' }) }),
    );
  });

  it('CASCADE-deletes variant and alt children with the asset', async () => {
    const asset = await makeImage();
    await prisma.mediaAssetVariant.create({
      data: {
        mediaAssetId: asset.id,
        format: 'WEBP',
        width: 1280,
        height: 720,
        storageKey: key(),
        sizeBytes: 800,
      },
    });
    await prisma.mediaAssetAlt.create({
      data: { mediaAssetId: asset.id, locale: 'en', alt: 'a photo' },
    });

    await prisma.mediaAsset.delete({ where: { id: asset.id } });
    createdAssetIds.splice(createdAssetIds.indexOf(asset.id), 1);

    expect(
      await prisma.mediaAssetVariant.count({
        where: { mediaAssetId: asset.id },
      }),
    ).toBe(0);
    expect(
      await prisma.mediaAssetAlt.count({ where: { mediaAssetId: asset.id } }),
    ).toBe(0);
  });

  it('RESTRICTs deleting an asset referenced by content (testimonial avatar)', async () => {
    const asset = await makeImage();
    const testimonial = await prisma.testimonial.create({
      data: { avatarId: asset.id },
    });
    createdTestimonialIds.push(testimonial.id);

    const err: unknown = await prisma.mediaAsset
      .delete({ where: { id: asset.id } })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(['P2003', 'P2014']).toContain(
      (err as Prisma.PrismaClientKnownRequestError).code,
    );
  });
});
