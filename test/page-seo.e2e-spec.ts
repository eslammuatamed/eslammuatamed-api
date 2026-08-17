import { INestApplication } from '@nestjs/common';
import sharp from 'sharp';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  createE2eApp,
  envelopeData,
  httpServer,
  OWNER_EMAIL,
  OWNER_PASSWORD,
} from './utils/e2e-app';
import { loadApiSpec } from './utils/contract';

/**
 * Static-page SEO end-to-end against the real AppModule and a fresh migrated/seeded Postgres
 * (doc 18 §2, FR-DSH-051, D10-24).
 *
 * Includes the FIRST execution of the `page_seo.og_image_id` → `media_assets` `onDelete: Restrict`
 * constraint. That path was unreachable before this module existed — `media.service.ts` has always
 * built `pageSeoOgImages` usages, but with no way to create a `PageSeo` row, nothing ever referenced
 * an asset through it, so the constraint had never fired in any test.
 */

// Run-unique so re-runs never collide on media contentHash (dedup turns a 201 into a 200).
const RUN = Date.now() % 100_000;

interface PageSeoTranslation {
  metaTitle: string | null;
  metaDescription: string | null;
  ogImageId: string | null;
  canonicalUrl: string | null;
}
interface AdminPageSeo {
  pageKey: string;
  translations: Record<string, PageSeoTranslation>;
}
interface PublicPageSeo extends PageSeoTranslation {
  pageKey: string;
  locale: string;
  ogImage: { url: string; alt: string | null } | null;
}
interface Usage {
  entity: string;
  reference: Record<string, unknown>;
}

describe('Static-page SEO (e2e)', () => {
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

  /** A distinct PNG per call, so each upload is its own asset rather than a dedup hit. */
  const pngImage = (seed: number): Promise<Buffer> =>
    sharp({
      create: {
        width: 1200,
        height: 630,
        channels: 3,
        background: {
          r: seed % 256,
          g: (seed * 7) % 256,
          b: (seed * 13) % 256,
        },
      },
    })
      .png()
      .toBuffer();

  const uploadImage = async (seed: number): Promise<string> => {
    const res = await request(server)
      .post('/api/v1/admin/media')
      .set(owner())
      .attach('file', await pngImage(seed), `og-${seed}.png`)
      .expect(201);
    return envelopeData<{ id: string }>(res).id;
  };

  /** A scoped role+user carrying exactly `permissions`, to prove 403 rather than assume it. */
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

  // ── public read ───────────────────────────────────────────────────────────────────────────────

  it('returns 200 with every field null for a known page with nothing authored', async () => {
    // The override-layer contract (F-D4): "no override, use the site defaults" is an ANSWER, so it
    // must not be a 404. `resume` is left unauthored by every test below, which is what keeps this
    // assertion meaningful rather than order-dependent.
    const res = await request(server)
      .get('/api/v1/seo/pages/resume?locale=en')
      .expect(200);

    expect(res).toSatisfyApiSpec();
    const body = envelopeData<PublicPageSeo>(res);
    expect(body).toMatchObject({
      pageKey: 'resume',
      locale: 'en',
      metaTitle: null,
      metaDescription: null,
      ogImageId: null,
      ogImage: null,
      canonicalUrl: null,
    });
  });

  it('404s an unknown page key rather than 422ing or inventing a page', async () => {
    const res = await request(server)
      .get('/api/v1/seo/pages/not-a-page?locale=en')
      .expect(404);
    expect(res).toSatisfyApiSpec();
  });

  it('404s a deferred route that is deliberately not in the key set (/uses, D24-7)', async () => {
    // A discriminating case, not a duplicate of the one above: `uses` is a REAL public route in the
    // information architecture, so a permissive key set would have accepted it. D24-7 defers it.
    const res = await request(server)
      .get('/api/v1/seo/pages/uses?locale=en')
      .expect(404);
    expect(res).toSatisfyApiSpec();
  });

  it('400s a locale that is not enabled (no silent fallback)', async () => {
    const res = await request(server)
      .get('/api/v1/seo/pages/about?locale=zz')
      .expect(400);
    expect(res).toSatisfyApiSpec();
  });

  // ── admin authorization ───────────────────────────────────────────────────────────────────────

  it('denies the admin surface without a token', async () => {
    const res = await request(server)
      .get('/api/v1/admin/seo/pages')
      .expect(401);
    expect(res).toSatisfyApiSpec();
  });

  it('403s a token that lacks seo.read, and 403s seo.update separately', async () => {
    // Two keys, two proofs: a role holding only `seo.read` must still be refused the PATCH, or the
    // read/update split would be decorative.
    const unrelated = await tokenFor(['articles.read'], 'seo-none');
    const readOnly = await tokenFor(['seo.read'], 'seo-ro');

    const denied = await request(server)
      .get('/api/v1/admin/seo/pages')
      .set('Authorization', `Bearer ${unrelated}`)
      .expect(403);
    expect(denied).toSatisfyApiSpec();

    // CONTROL: the read-only token CAN read — so the 403 below is about the missing update key and
    // not about the token being broken.
    await request(server)
      .get('/api/v1/admin/seo/pages')
      .set('Authorization', `Bearer ${readOnly}`)
      .expect(200);

    const deniedWrite = await request(server)
      .patch('/api/v1/admin/seo/pages/about')
      .set('Authorization', `Bearer ${readOnly}`)
      .send({ translations: [{ locale: 'en', metaTitle: 'nope' }] })
      .expect(403);
    expect(deniedWrite).toSatisfyApiSpec();
  });

  // ── admin read shape ──────────────────────────────────────────────────────────────────────────

  it('lists every known page key with an entry for every enabled locale', async () => {
    const res = await request(server)
      .get('/api/v1/admin/seo/pages')
      .set(owner())
      .expect(200);

    expect(res).toSatisfyApiSpec();
    const pages = envelopeData<AdminPageSeo[]>(res);
    expect(pages.map((page) => page.pageKey)).toEqual([
      'home',
      'about',
      'experience',
      'projects',
      'blog',
      'resume',
      'contact',
    ]);
    // An unauthored locale is present and all-null, so the editor can render its tab (D10-24).
    for (const page of pages) {
      expect(Object.keys(page.translations).sort()).toEqual(['ar', 'en']);
    }
  });

  it('422s an unknown page key on the admin surface', async () => {
    const res = await request(server)
      .get('/api/v1/admin/seo/pages/not-a-page')
      .set(owner())
      .expect(422);
    expect(res).toSatisfyApiSpec();
  });

  // ── write, locale parity, and null semantics ──────────────────────────────────────────────────

  it('upserts both locales independently and resolves each without cross-locale fallback', async () => {
    const patched = await request(server)
      .patch('/api/v1/admin/seo/pages/about')
      .set(owner())
      .send({
        translations: [
          {
            locale: 'en',
            metaTitle: 'About — EN',
            metaDescription: 'EN description.',
            canonicalUrl: 'https://eslammuatamed.com/about',
          },
          { locale: 'ar', metaTitle: 'من أنا — AR' },
        ],
      })
      .expect(200);

    expect(patched).toSatisfyApiSpec();
    const map = envelopeData<AdminPageSeo>(patched).translations;
    expect(map.en?.metaTitle).toBe('About — EN');
    expect(map.ar?.metaTitle).toBe('من أنا — AR');
    // AR authored only a title: its description stays null rather than borrowing EN's (D10-6).
    expect(map.ar?.metaDescription).toBeNull();

    const en = await request(server)
      .get('/api/v1/seo/pages/about?locale=en')
      .expect(200);
    expect(en).toSatisfyApiSpec();
    expect(envelopeData<PublicPageSeo>(en)).toMatchObject({
      metaTitle: 'About — EN',
      metaDescription: 'EN description.',
      canonicalUrl: 'https://eslammuatamed.com/about',
    });

    const ar = await request(server)
      .get('/api/v1/seo/pages/about?locale=ar')
      .expect(200);
    expect(ar).toSatisfyApiSpec();
    expect(envelopeData<PublicPageSeo>(ar)).toMatchObject({
      metaTitle: 'من أنا — AR',
      metaDescription: null,
      canonicalUrl: null,
    });
  });

  it('leaves a locale absent from the body untouched', async () => {
    await request(server)
      .patch('/api/v1/admin/seo/pages/blog')
      .set(owner())
      .send({
        translations: [
          { locale: 'en', metaTitle: 'Blog EN' },
          { locale: 'ar', metaTitle: 'مدونة' },
        ],
      })
      .expect(200);

    const patched = await request(server)
      .patch('/api/v1/admin/seo/pages/blog')
      .set(owner())
      .send({ translations: [{ locale: 'en', metaTitle: 'Blog EN v2' }] })
      .expect(200);

    const map = envelopeData<AdminPageSeo>(patched).translations;
    expect(map.en?.metaTitle).toBe('Blog EN v2');
    expect(map.ar?.metaTitle).toBe('مدونة');
  });

  it('distinguishes an omitted key from an explicit null (D10-23)', async () => {
    await request(server)
      .patch('/api/v1/admin/seo/pages/contact')
      .set(owner())
      .send({
        translations: [
          {
            locale: 'en',
            metaTitle: 'Contact',
            metaDescription: 'Reach out.',
          },
        ],
      })
      .expect(200);

    // Omitting metaDescription must PRESERVE it — the control that makes the clear below meaningful.
    const omitted = await request(server)
      .patch('/api/v1/admin/seo/pages/contact')
      .set(owner())
      .send({ translations: [{ locale: 'en', metaTitle: 'Contact v2' }] })
      .expect(200);
    expect(
      envelopeData<AdminPageSeo>(omitted).translations.en?.metaDescription,
    ).toBe('Reach out.');

    const cleared = await request(server)
      .patch('/api/v1/admin/seo/pages/contact')
      .set(owner())
      .send({ translations: [{ locale: 'en', metaDescription: null }] })
      .expect(200);
    expect(cleared).toSatisfyApiSpec();
    const map = envelopeData<AdminPageSeo>(cleared).translations;
    expect(map.en?.metaDescription).toBeNull();
    // …and the sibling it did not name is still intact.
    expect(map.en?.metaTitle).toBe('Contact v2');
  });

  // ── validation ────────────────────────────────────────────────────────────────────────────────

  it('422s a canonicalUrl without a protocol', async () => {
    const res = await request(server)
      .patch('/api/v1/admin/seo/pages/home')
      .set(owner())
      .send({ translations: [{ locale: 'en', canonicalUrl: 'example.com' }] })
      .expect(422);
    expect(res).toSatisfyApiSpec();
  });

  it('422s an ogImageId that does not exist', async () => {
    const missing = await request(server)
      .patch('/api/v1/admin/seo/pages/home')
      .set(owner())
      .send({
        translations: [
          { locale: 'en', ogImageId: '0194f9a2-ef2a-7a31-8cb7-369c87f79331' },
        ],
      })
      .expect(422);
    expect(missing).toSatisfyApiSpec();
  });

  it('422s an ogImageId that exists but is a PDF, not an IMAGE', async () => {
    // The kind branch is a separate code path from the existence branch above, so it gets its own
    // case. The résumé PDF is the only non-image asset the library accepts (FR-DSH-032), which makes
    // it the only way to reach this rejection at all.
    const pdf = Buffer.concat([
      Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n', 'latin1'),
      Buffer.from(`% page-seo-e2e-${RUN}\n`, 'latin1'),
      Buffer.from('trailer<</Root 1 0 R>>\n%%EOF\n', 'latin1'),
    ]);
    const upload = await request(server)
      .post('/api/v1/admin/media')
      .set(owner())
      .attach('file', pdf, 'resume.pdf')
      .expect(201);
    const pdfId = envelopeData<{ id: string; kind: string }>(upload).id;
    // CONTROL: confirm the asset really is a PDF, so the 422 below is about kind and not about the
    // upload having silently failed or deduplicated into an image.
    expect(envelopeData<{ kind: string }>(upload).kind).toBe('PDF');

    const res = await request(server)
      .patch('/api/v1/admin/seo/pages/home')
      .set(owner())
      .send({ translations: [{ locale: 'en', ogImageId: pdfId }] })
      .expect(422);
    expect(res).toSatisfyApiSpec();
  });

  it('400s a locale that is not enabled on write', async () => {
    const res = await request(server)
      .patch('/api/v1/admin/seo/pages/home')
      .set(owner())
      .send({ translations: [{ locale: 'zz', metaTitle: 'x' }] })
      .expect(400);
    expect(res).toSatisfyApiSpec();
  });

  // ── OG image: descriptor resolution and the RESTRICT constraint ────────────────────────────────

  it('resolves an OG image descriptor on the public read', async () => {
    const assetId = await uploadImage(RUN + 1);

    await request(server)
      .patch('/api/v1/admin/seo/pages/projects')
      .set(owner())
      .send({ translations: [{ locale: 'en', ogImageId: assetId }] })
      .expect(200);

    const res = await request(server)
      .get('/api/v1/seo/pages/projects?locale=en')
      .expect(200);
    expect(res).toSatisfyApiSpec();
    const body = envelopeData<PublicPageSeo>(res);
    expect(body.ogImageId).toBe(assetId);
    expect(body.ogImage).not.toBeNull();
    expect(body.ogImage?.url).toContain('http');
  });

  it('blocks deleting an asset a page SEO row references (409 + usages), and deletes an unreferenced one (204)', async () => {
    // FIRST execution of page_seo.og_image_id onDelete: Restrict — unreachable until this module
    // existed. The 204 on an unreferenced asset is the negative control: it proves the 409 comes from
    // the reference and not from media deletion being broken for every asset.
    const referenced = await uploadImage(RUN + 2);
    const unreferenced = await uploadImage(RUN + 3);

    await request(server)
      .patch('/api/v1/admin/seo/pages/experience')
      .set(owner())
      .send({ translations: [{ locale: 'ar', ogImageId: referenced }] })
      .expect(200);

    const usages = await request(server)
      .get(`/api/v1/admin/media/${referenced}/usages`)
      .set(owner())
      .expect(200);
    expect(usages).toSatisfyApiSpec();
    expect(
      envelopeData<Usage[]>(usages).some(
        (usage) => usage.reference.pageKey === 'experience',
      ),
    ).toBe(true);

    const conflict = await request(server)
      .delete(`/api/v1/admin/media/${referenced}`)
      .set(owner())
      .expect(409);
    expect(conflict).toSatisfyApiSpec();

    await request(server)
      .delete(`/api/v1/admin/media/${unreferenced}`)
      .set(owner())
      .expect(204);

    // Clearing the reference releases the asset — the delete that just 409'd now succeeds.
    await request(server)
      .patch('/api/v1/admin/seo/pages/experience')
      .set(owner())
      .send({ translations: [{ locale: 'ar', ogImageId: null }] })
      .expect(200);

    await request(server)
      .delete(`/api/v1/admin/media/${referenced}`)
      .set(owner())
      .expect(204);
  });
});
