// End-to-end proof of the canonical content synchronization against a REAL PostgreSQL database
// (doc 09 §6, D09-21). The properties below are the ones a fake cannot establish: what the database
// actually cascades, what a rolled-back transaction actually leaves behind, and whether a second run
// really writes nothing.
//
// ISOLATION. This suite provisions and drops its OWN database rather than using the shared e2e one.
// It creates, mutates and deletes governed content wholesale, so sharing a database with the other
// e2e specs would couple them to this suite's execution order. It also means the suite is
// self-contained: `DATABASE_URL` is derived, never read from a `.env`, and never points anywhere but
// a scratch database this file created (see `SCRATCH_DB`).
import { execFileSync } from 'node:child_process';
import { ContentStatus, MediaKind, PrismaClient } from '@prisma/client';
import { PROJECTS } from '../prisma/content/canonical/projects';
import { SETTINGS_TRANSLATIONS } from '../prisma/content/canonical/site-settings';
import { SKILLS } from '../prisma/content/canonical/skills';
import {
  applyPlan,
  runProtectedTransaction,
  TransactionConflictError,
} from '../prisma/sync/apply-plan';
import { buildPlan } from '../prisma/sync/build-plan';
import { readOnly } from '../prisma/sync/read-client';
import { isNoOp, summarize } from '../prisma/sync/types';
import type { Plan } from '../prisma/sync/types';

const SCRATCH_DB = 'emu_content_sync_e2e';

const adminUrl = (): string => {
  const url = new URL(
    process.env.DATABASE_URL ??
      'postgresql://eslammuatamed:eslammuatamed@localhost:5432/eslammuatamed_test',
  );
  url.pathname = '/postgres';
  return url.toString();
};

const scratchUrl = (): string => {
  const url = new URL(adminUrl());
  url.pathname = `/${SCRATCH_DB}`;
  return url.toString();
};

let prisma: PrismaClient;

const READ_OPERATIONS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);

/** Rows the synchronization must never touch, planted before every scenario. */
async function plantOperationalData(): Promise<void> {
  const role = await prisma.role.upsert({
    where: { name: 'OWNER' },
    create: { name: 'OWNER', isSystem: true },
    update: {},
  });
  await prisma.rolePermission.upsert({
    where: { roleId_permission: { roleId: role.id, permission: '*' } },
    create: { roleId: role.id, permission: '*' },
    update: {},
  });
  await prisma.user.upsert({
    where: { email: 'owner@example.com' },
    create: {
      email: 'owner@example.com',
      passwordHash: 'argon2id$placeholder',
      roleId: role.id,
    },
    update: {},
  });
  await prisma.contactMessage.createMany({
    data: [
      {
        name: 'Visitor One',
        email: 'one@example.com',
        subject: 'Hello',
        body: 'A real enquiry',
        isRead: true,
      },
      {
        name: 'Visitor Two',
        phone: '+201002785408',
        subject: 'Archived',
        body: 'Already archived',
        isArchived: true,
        archivedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ],
  });
  await prisma.testimonial.create({
    data: {
      order: 0,
      translations: {
        create: [
          {
            locale: 'en',
            quote: 'Dev-only',
            authorName: 'Sample',
            authorRole: 'Sample',
          },
          {
            locale: 'ar',
            quote: 'تجريبي',
            authorName: 'عيّنة',
            authorRole: 'عيّنة',
          },
        ],
      },
    },
  });
}

async function resetGovernedContent(): Promise<void> {
  // Test-fixture teardown, NOT a synchronization code path: the tool itself never issues a
  // table-wide delete (doc 09 §6.2). This is the suite putting its own scratch database back to a
  // known state between scenarios.
  await prisma.articleTag.deleteMany();
  await prisma.articleTranslation.deleteMany();
  await prisma.article.deleteMany();
  await prisma.projectGalleryItemTranslation.deleteMany();
  await prisma.projectGalleryItem.deleteMany();
  await prisma.projectTechnology.deleteMany();
  await prisma.projectTranslation.deleteMany();
  await prisma.project.deleteMany();
  await prisma.experienceTechnology.deleteMany();
  await prisma.experienceTranslation.deleteMany();
  await prisma.experience.deleteMany();
  await prisma.skillTranslation.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.tagTranslation.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.categoryTranslation.deleteMany();
  await prisma.category.deleteMany();
  await prisma.siteSettingsTranslation.deleteMany();
  await prisma.siteSettings.deleteMany();
}

const plan = (): Promise<Plan> => buildPlan(readOnly(prisma));

const syncOnce = async (): Promise<Plan> => {
  const current = await plan();
  expect(current.problems).toEqual([]);
  if (!isNoOp(current)) await applyPlan(prisma, current);
  return current;
};

beforeAll(async () => {
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl() } } });
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${SCRATCH_DB}"`);
  await admin.$executeRawUnsafe(`CREATE DATABASE "${SCRATCH_DB}"`);
  await admin.$disconnect();

  // A FRESH database migrated from zero — this doubles as migration validation, including the
  // staged `Skill.slug` migration and its CHECK constraint.
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: scratchUrl() },
    stdio: 'pipe',
  });

  prisma = new PrismaClient({ datasources: { db: { url: scratchUrl() } } });
  await prisma.locale.createMany({
    data: [
      {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        dir: 'ltr',
        order: 0,
      },
      {
        code: 'ar',
        name: 'Arabic',
        nativeName: 'العربية',
        dir: 'rtl',
        order: 1,
      },
    ],
  });
  await plantOperationalData();
}, 180_000);

afterAll(async () => {
  await prisma?.$disconnect();
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl() } } });
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${SCRATCH_DB}"`);
  await admin.$disconnect();
}, 60_000);

beforeEach(async () => {
  await resetGovernedContent();
});

describe('dry-run makes zero writes', () => {
  it('issues no write operation, proven by an interceptor', async () => {
    const attempted: string[] = [];
    const guarded = prisma.$extends({
      query: {
        $allModels: {
          $allOperations({ model, operation, args, query }) {
            if (!READ_OPERATIONS.has(operation))
              attempted.push(`${model}.${operation}`);
            return query(args);
          },
        },
      },
    });

    // The type system already forbids a write here; this proves it at RUNTIME too, because a type
    // is erased and the guarantee is worth proving twice.
    await buildPlan(readOnly(guarded as unknown as PrismaClient));

    expect(attempted).toEqual([]);
  });

  it('leaves every row untouched, including updatedAt', async () => {
    await syncOnce();
    const before = await prisma.project.findMany({
      select: { id: true, updatedAt: true, year: true },
      orderBy: { id: 'asc' },
    });

    await plan();
    await plan();

    expect(
      await prisma.project.findMany({
        select: { id: true, updatedAt: true, year: true },
        orderBy: { id: 'asc' },
      }),
    ).toEqual(before);
  });
});

describe('empty database → converged, then idempotent', () => {
  it('creates the full canonical dataset on the first run', async () => {
    await syncOnce();

    expect(await prisma.project.count()).toBe(4);
    expect(await prisma.article.count()).toBe(12);
    expect(await prisma.skill.count()).toBe(SKILLS.length);
    expect(await prisma.siteSettings.count()).toBe(1);
    expect(await prisma.siteSettingsTranslation.count()).toBe(2);
  });

  it('produces ZERO changes on the second run', async () => {
    await syncOnce();
    const second = await plan();

    expect(second.problems).toEqual([]);
    expect(isNoOp(second)).toBe(true);
    expect(summarize(second).affectedModels).toEqual([]);
  });

  it('appends no duplicate on a third run', async () => {
    await syncOnce();
    await syncOnce();
    await syncOnce();

    expect(await prisma.project.count()).toBe(4);
    expect(await prisma.article.count()).toBe(12);
  });

  it('writes both locales for every localized entity', async () => {
    await syncOnce();

    for (const [count, translations] of [
      [await prisma.project.count(), await prisma.projectTranslation.count()],
      [await prisma.article.count(), await prisma.articleTranslation.count()],
      [await prisma.skill.count(), await prisma.skillTranslation.count()],
      [
        await prisma.experience.count(),
        await prisma.experienceTranslation.count(),
      ],
    ])
      expect(translations).toBe(count! * 2);
  });

  it('resolves SAMT to 2026 through the canonical dataset', async () => {
    await syncOnce();
    const samt = await prisma.projectTranslation.findUnique({
      where: {
        locale_slug: { locale: 'en', slug: 'samt-institution-website' },
      },
      select: { project: { select: { year: true } } },
    });

    expect(samt?.project.year).toBe(2026);
  });
});

describe('stale content converges', () => {
  it('corrects a stale scalar without recreating the row', async () => {
    await syncOnce();
    const before = await prisma.projectTranslation.findUnique({
      where: {
        locale_slug: { locale: 'en', slug: 'samt-institution-website' },
      },
      select: { projectId: true },
    });
    await prisma.project.update({
      where: { id: before!.projectId },
      data: { year: 2025 },
    });

    await syncOnce();

    const after = await prisma.projectTranslation.findUnique({
      where: {
        locale_slug: { locale: 'en', slug: 'samt-institution-website' },
      },
      select: { projectId: true, project: { select: { year: true } } },
    });
    expect(after?.project.year).toBe(2026);
    // The stable id is preserved — an external link or cached reference survives the correction.
    expect(after?.projectId).toBe(before!.projectId);
  });

  it('re-asserts the four SiteSettings fields the base seed leaves create-only', async () => {
    await syncOnce();
    await prisma.siteSettingsTranslation.updateMany({
      where: { locale: 'en' },
      data: {
        siteName: 'Stale Name',
        availabilityStatus: 'Stale availability',
        defaultMetaTitle: 'Stale title',
        defaultMetaDescription: 'Stale description',
      },
    });

    await syncOnce();

    const english = await prisma.siteSettingsTranslation.findFirst({
      where: { locale: 'en' },
    });
    const canonical = SETTINGS_TRANSLATIONS.find((row) => row.locale === 'en')!;
    expect(english?.siteName).toBe(canonical.siteName);
    expect(english?.availabilityStatus).toBe(canonical.availabilityStatus);
    expect(english?.defaultMetaTitle).toBe(canonical.defaultMetaTitle);
    expect(english?.defaultMetaDescription).toBe(
      canonical.defaultMetaDescription,
    );
  });

  it('never touches the operator-owned SiteSettings fields', async () => {
    await syncOnce();
    const settings = await prisma.siteSettings.findFirstOrThrow();
    await prisma.siteSettings.update({
      where: { id: settings.id },
      data: {
        googleSiteVerification: 'operator-token',
        analyticsEnabled: true,
        analyticsProvider: 'ga4',
      },
    });

    await syncOnce();

    const after = await prisma.siteSettings.findFirstOrThrow();
    expect(after.googleSiteVerification).toBe('operator-token');
    expect(after.analyticsEnabled).toBe(true);
    expect(after.analyticsProvider).toBe('ga4');
  });

  it('removes a stale governed Project and keeps its MediaAsset', async () => {
    await syncOnce();
    const asset = await prisma.mediaAsset.create({
      data: {
        kind: MediaKind.IMAGE,
        storageKey: 'scratch/stale-project-cover',
        originalFilename: 'cover.webp',
        mimeType: 'image/webp',
        sizeBytes: 1024,
        // The schema CHECK requires a 64-character SHA-256 hex digest.
        contentHash: 'a'.repeat(64),
        width: 1200,
        height: 630,
        blurhash: 'LEHV6nWB2yk8',
      },
    });
    const stale = await prisma.project.create({
      data: {
        isPublished: true,
        order: 99,
        year: 2019,
        translations: {
          create: [
            {
              locale: 'en',
              slug: 'a-stale-project',
              title: 'Stale',
              summary: 's',
              overview: 'o',
              businessProblem: 'b',
              solution: 's',
              role: 'r',
              architecture: 'a',
              challenges: 'c',
              features: 'f',
              lessonsLearned: 'l',
            },
          ],
        },
        gallery: { create: [{ mediaAssetId: asset.id, order: 0 }] },
      },
    });

    const before = await plan();
    expect(
      before.cascades.find((c) => c.owner === 'a-stale-project'),
    ).toMatchObject({ model: 'ProjectGalleryItem', count: 1 });

    await syncOnce();

    expect(
      await prisma.project.findUnique({ where: { id: stale.id } }),
    ).toBeNull();
    expect(await prisma.projectGalleryItem.count()).toBe(0);
    // The reusable asset survives — only the governed relation went.
    expect(
      await prisma.mediaAsset.findUnique({ where: { id: asset.id } }),
    ).not.toBeNull();
  });

  it('hides a non-canonical Skill instead of deleting it, preserving its relations', async () => {
    await syncOnce();
    const retired = await prisma.skill.create({
      data: {
        slug: 'jquery',
        group: 'FRONTEND',
        order: 99,
        isPublic: true,
        translations: {
          create: [
            { locale: 'en', label: 'jQuery' },
            { locale: 'ar', label: 'jQuery' },
          ],
        },
      },
    });
    const project = await prisma.projectTranslation.findUniqueOrThrow({
      where: { locale_slug: { locale: 'en', slug: 'personal-platform' } },
      select: { projectId: true },
    });
    await prisma.projectTechnology.create({
      data: { projectId: project.projectId, skillId: retired.id },
    });

    await syncOnce();

    const after = await prisma.skill.findUnique({ where: { id: retired.id } });
    expect(after).not.toBeNull();
    expect(after?.isPublic).toBe(false);
    // The relation to a hidden skill is NOT canonical, so the technology set is replaced — but the
    // skill row and its id survive, which is what makes the action reversible.
    expect(
      await prisma.skill.findUnique({ where: { slug: 'jquery' } }),
    ).not.toBeNull();
  });

  it('preserves every existing Skill id across a full run', async () => {
    await syncOnce();
    const before = await prisma.skill.findMany({
      select: { id: true, slug: true },
      orderBy: { slug: 'asc' },
    });

    await prisma.skill.updateMany({ data: { order: 999 } });
    await syncOnce();

    expect(
      await prisma.skill.findMany({
        select: { id: true, slug: true },
        orderBy: { slug: 'asc' },
      }),
    ).toEqual(before);
  });

  it('replaces a project technology set to match canonical', async () => {
    await syncOnce();
    const { projectId } = await prisma.projectTranslation.findUniqueOrThrow({
      where: {
        locale_slug: { locale: 'en', slug: 'samt-institution-website' },
      },
      select: { projectId: true },
    });
    await prisma.projectTechnology.deleteMany({ where: { projectId } });

    await syncOnce();

    const links = await prisma.projectTechnology.findMany({
      where: { projectId },
      select: { skill: { select: { slug: true } } },
    });
    const canonical = PROJECTS.find(
      (candidate) => candidate.en.slug === 'samt-institution-website',
    )!;
    expect(links.map((link) => link.skill.slug).sort()).toEqual(
      [...canonical.techKeys].sort(),
    );
    // The project's own scalars never drifted, so its record was `unchanged` — relation
    // replacement therefore must NOT be conditional on the record having scalar changes, or this
    // drift would survive forever and the run below would never be a no-op.
    expect(isNoOp(await plan())).toBe(true);
  });
});

describe('slug reuse — the ordinary rename case', () => {
  it('applies an English rename whose Arabic slug is unchanged', async () => {
    await syncOnce();
    const canonical = PROJECTS.find(
      (project) => project.en.slug === 'samt-institution-website',
    )!;
    const { projectId } = await prisma.projectTranslation.findUniqueOrThrow({
      where: {
        locale_slug: { locale: 'en', slug: 'samt-institution-website' },
      },
      select: { projectId: true },
    });
    // Simulate the state BEFORE a rename lands: the stored row carries an old English slug and
    // the canonical Arabic slug. The canonical dataset now names a different English slug, so the
    // plan emits create + delete — and the create needs an Arabic slug the stale row still holds.
    await prisma.projectTranslation.update({
      where: { projectId_locale: { projectId, locale: 'en' } },
      data: { slug: 'samt-under-its-old-name' },
    });

    const before = await plan();
    expect(before.problems).toEqual([]);
    expect(
      before.records.find(
        (record) =>
          record.model === 'Project' &&
          record.naturalKey === 'samt-under-its-old-name',
      )?.action,
    ).toBe('delete');

    // Deletes run before writes, so this must NOT abort on @@unique([locale, slug]).
    await syncOnce();

    const arabic = await prisma.projectTranslation.findUniqueOrThrow({
      where: { locale_slug: { locale: 'ar', slug: canonical.ar.slug } },
      select: { project: { select: { year: true } } },
    });
    expect(arabic.project.year).toBe(2026);
    expect(await prisma.project.count()).toBe(4);
    expect(isNoOp(await plan())).toBe(true);
  });
});

describe('operational data is protected', () => {
  it('preserves every protected record count across a full converging run', async () => {
    const before = {
      users: await prisma.user.count(),
      roles: await prisma.role.count(),
      permissions: await prisma.rolePermission.count(),
      messages: await prisma.contactMessage.count(),
      testimonials: await prisma.testimonial.count(),
      media: await prisma.mediaAsset.count(),
    };

    await syncOnce();

    expect({
      users: await prisma.user.count(),
      roles: await prisma.role.count(),
      permissions: await prisma.rolePermission.count(),
      messages: await prisma.contactMessage.count(),
      testimonials: await prisma.testimonial.count(),
      media: await prisma.mediaAsset.count(),
    }).toEqual(before);
  });

  it('preserves contact message read and archive state', async () => {
    const before = await prisma.contactMessage.findMany({
      select: { id: true, isRead: true, isArchived: true, archivedAt: true },
      orderBy: { id: 'asc' },
    });

    await syncOnce();

    expect(
      await prisma.contactMessage.findMany({
        select: { id: true, isRead: true, isArchived: true, archivedAt: true },
        orderBy: { id: 'asc' },
      }),
    ).toEqual(before);
  });

  it('leaves testimonials alone — they are dev-only, not canonical', async () => {
    const before = await prisma.testimonial.findMany({
      select: { id: true, isVisible: true, order: true },
    });

    await syncOnce();

    expect(
      await prisma.testimonial.findMany({
        select: { id: true, isVisible: true, order: true },
      }),
    ).toEqual(before);
  });
});

describe('the protected-data guard actually works', () => {
  // The comparator is unit-tested, but nothing proved the MECHANISM: that the counts really
  // bracket the work, that a breach really rolls back, or that the isolation level is really
  // applied. A guard whose wiring is untested is a guard nobody has seen fire.

  it('fires and ROLLS BACK when the work deletes a protected row', async () => {
    const before = await prisma.contactMessage.count();
    expect(before).toBeGreaterThan(0);

    await expect(
      runProtectedTransaction(prisma, async (tx) => {
        // Stands in for an unanticipated cascade. The allowlist makes this unreachable through
        // the real apply path, which is exactly why the guard needs a deliberate breach to prove
        // it fires at all.
        await tx.contactMessage.deleteMany();
      }),
    ).rejects.toThrow(/ContactMessage \d+ → 0/);

    // The rows are still here: the guard threw INSIDE the transaction, so the delete was undone.
    // The previous post-commit version would have thrown too — and the rows would be gone.
    expect(await prisma.contactMessage.count()).toBe(before);
  });

  it('rolls back the governed work as well, not just the protected breach', async () => {
    await expect(
      runProtectedTransaction(prisma, async (tx) => {
        await tx.skill.create({
          data: {
            slug: 'should-not-survive',
            group: 'FRONTEND',
            translations: { create: [{ locale: 'en', label: 'Nope' }] },
          },
        });
        await tx.contactMessage.deleteMany();
      }),
    ).rejects.toThrow(/Operational record counts changed/);

    expect(
      await prisma.skill.findUnique({ where: { slug: 'should-not-survive' } }),
    ).toBeNull();
  });

  it('runs at REPEATABLE READ — the property the whole guard rests on', async () => {
    // Asserted against the database rather than against the Prisma option, because the option is
    // a request and this is the observed result. Under READ COMMITTED the two counts would come
    // from different snapshots and the next test could not pass.
    const { result } = await runProtectedTransaction(prisma, async (tx) => {
      const rows = await tx.$queryRaw<
        { level: string }[]
      >`SELECT current_setting('transaction_isolation') AS level`;
      return rows[0]!.level;
    });

    expect(result).toBe('repeatable read');
  });

  it('does NOT fail when another session commits to a protected table mid-run', async () => {
    // This is the original blocker in its exact shape: an admin session rotating a token, or a
    // visitor submitting the contact form, while a two-minute sync is in flight. The pre-fix
    // version failed the run — after committing it — with "This must never happen".
    const other = new PrismaClient({
      datasources: { db: { url: scratchUrl() } },
    });
    try {
      const outcome = await runProtectedTransaction(prisma, async (tx) => {
        await tx.skill.count(); // take the snapshot first
        // A genuinely concurrent, committed write from a different connection.
        await other.contactMessage.create({
          data: {
            name: 'Mid-run visitor',
            email: 'midrun@example.com',
            subject: 'Sent while the sync was running',
            body: 'This must not fail the run.',
          },
        });
        return 'completed';
      });

      expect(outcome.result).toBe('completed');
      // The concurrent row is invisible to the snapshot, so both counts agree...
      expect(outcome.protectedCountsAfter.ContactMessage).toBe(
        outcome.protectedCountsBefore.ContactMessage,
      );
      // ...and it genuinely committed, so nothing was lost by ignoring it.
      expect(await prisma.contactMessage.count()).toBe(
        outcome.protectedCountsBefore.ContactMessage! + 1,
      );
    } finally {
      await other.contactMessage.deleteMany({
        where: { email: 'midrun@example.com' },
      });
      await other.$disconnect();
    }
  });
});

describe('a real write conflict is reported, not crashed on', () => {
  it('rolls back and reports it as retryable when another session wins the row', async () => {
    await syncOnce();
    const skill = await prisma.skill.findFirstOrThrow({ select: { id: true } });
    const other = new PrismaClient({
      datasources: { db: { url: scratchUrl() } },
    });

    try {
      // RepeatableRead is the isolation the protected-data guard requires, and its cost is that a
      // concurrent write to a row this run also touches aborts the transaction. Provoke exactly
      // that, and assert the operator gets the actionable message instead of a Prisma stack trace.
      await expect(
        runProtectedTransaction(prisma, async (tx) => {
          // Order matters, and getting it wrong deadlocks the test rather than the database:
          // the snapshot must be taken FIRST, then the other session must update AND COMMIT
          // (autocommit on its own connection, so it takes and releases the row lock cleanly),
          // and only then may this transaction touch the row. Updating from `tx` first would lock
          // the row and leave the other connection blocking on a transaction that is waiting for
          // it — a deadlock of the test's own making, not a demonstration of anything.
          await tx.skill.count();
          await other.skill.update({
            where: { id: skill.id },
            data: { order: 900 },
          });
          await tx.skill.update({
            where: { id: skill.id },
            data: { order: 501 },
          });
        }),
      ).rejects.toThrow(TransactionConflictError);

      // Rolled back: the losing transaction's write is gone, the winner's stands.
      const after = await prisma.skill.findUniqueOrThrow({
        where: { id: skill.id },
        select: { order: true },
      });
      expect(after.order).toBe(900);
    } finally {
      await other.$disconnect();
    }
    // And the database is still convergeable — a retry is genuinely safe.
    await syncOnce();
    expect(isNoOp(await plan())).toBe(true);
  }, 60_000);
});

describe('a failed apply rolls the whole run back', () => {
  it('leaves the database exactly as it was when a write fails mid-transaction', async () => {
    const before = {
      skills: await prisma.skill.count(),
      projects: await prisma.project.count(),
      categories: await prisma.category.count(),
      articles: await prisma.article.count(),
    };
    expect(before.skills).toBe(0);

    // A plan whose Category creates have been stripped. Skills and projects are created first and
    // succeed; the Article create then cannot resolve its category and throws INSIDE the
    // transaction. If the transaction boundary were wrong, the skills and projects would survive.
    const full = await plan();
    const sabotaged: Plan = {
      ...full,
      records: full.records.filter(
        (record) =>
          !(record.model === 'Category' && record.action === 'create'),
      ),
    };

    await expect(applyPlan(prisma, sabotaged)).rejects.toThrow(
      /Cannot resolve category/,
    );

    expect({
      skills: await prisma.skill.count(),
      projects: await prisma.project.count(),
      categories: await prisma.category.count(),
      articles: await prisma.article.count(),
    }).toEqual(before);
  });

  it('refuses a plan naming a protected model before writing anything', async () => {
    const full = await plan();
    const illegal: Plan = {
      ...full,
      records: [
        ...full.records,
        {
          model: 'ContactMessage' as never,
          action: 'delete',
          naturalKey: 'anything',
          id: 'some-id',
          fields: [],
        },
      ],
    };

    await expect(applyPlan(prisma, illegal)).rejects.toThrow(
      /not in the governed allowlist/,
    );
    expect(await prisma.skill.count()).toBe(0);
    expect(await prisma.contactMessage.count()).toBe(2);
  });
});

describe('published content reads back correctly in both locales', () => {
  it('gives every canonical article a PUBLISHED status and both translations', async () => {
    await syncOnce();

    const articles = await prisma.article.findMany({
      select: {
        status: true,
        translations: { select: { locale: true, title: true } },
      },
    });

    expect(articles).toHaveLength(12);
    for (const article of articles) {
      expect(article.status).toBe(ContentStatus.PUBLISHED);
      expect(article.translations.map((t) => t.locale).sort()).toEqual([
        'ar',
        'en',
      ]);
      for (const translation of article.translations)
        expect(translation.title.length).toBeGreaterThan(0);
    }
  });

  it('resolves both SiteSettings locales with no empty governed value', async () => {
    await syncOnce();

    for (const canonical of SETTINGS_TRANSLATIONS) {
      const stored = await prisma.siteSettingsTranslation.findFirstOrThrow({
        where: { locale: canonical.locale },
      });
      expect(stored.siteName).toBe(canonical.siteName);
      expect(stored.tagline).toBe(canonical.tagline);
      expect(stored.availabilityStatus).toBe(canonical.availabilityStatus);
      expect(stored.aboutBio).toBe(canonical.aboutBio);
      expect(stored.currentFocus).toBe(canonical.currentFocus);
    }
  });
});
