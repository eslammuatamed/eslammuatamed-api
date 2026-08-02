// Standalone script: class-transformer decorators in env.validation need the metadata
// polyfill that Nest's bootstrap normally provides.
import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { ARGON2_OPTIONS } from '../src/modules/auth/hashing/argon2.options';
import { validate } from '../src/config/env.validation';
import { ABOUT_COPY } from './content/about-copy';
import { PUBLIC_TAGLINE } from './content/public-tagline';

// Idempotent seed (doc 09 §6): locales, the OWNER system role (+ its reserved '*' grant), the
// OWNER user, the SiteSettings singleton, and the initial categories. Re-running is a no-op —
// every write is an upsert or guarded by an existence check, and the owner password/role are
// never clobbered once set.

const prisma = new PrismaClient();

interface CategorySeed {
  readonly en: { readonly name: string; readonly slug: string };
  readonly ar: { readonly name: string; readonly slug: string };
}

const CATEGORIES: readonly CategorySeed[] = [
  {
    en: { name: 'Engineering', slug: 'engineering' },
    ar: { name: 'هندسة', slug: 'handasa' },
  },
  {
    en: { name: 'Architecture', slug: 'architecture' },
    ar: { name: 'معمارية', slug: 'muemaria' },
  },
  {
    en: { name: 'Career', slug: 'career' },
    ar: { name: 'مسيرة مهنية', slug: 'masira-mihaniya' },
  },
  {
    en: { name: 'Tutorials', slug: 'tutorials' },
    ar: { name: 'شروحات', slug: 'shuruhat' },
  },
];

async function seedLocales(): Promise<void> {
  await prisma.locale.upsert({
    where: { code: 'en' },
    create: {
      code: 'en',
      name: 'English',
      nativeName: 'English',
      dir: 'ltr',
      isEnabled: true,
      order: 0,
    },
    update: {},
  });
  await prisma.locale.upsert({
    where: { code: 'ar' },
    create: {
      code: 'ar',
      name: 'Arabic',
      nativeName: 'العربية',
      dir: 'rtl',
      isEnabled: true,
      order: 1,
    },
    update: {},
  });
}

// The OWNER system role holds the single reserved '*' wildcard grant (D19-8): it authorizes
// every permission, present and future, so a growing catalog can never lock the operator out.
async function seedOwnerRole(): Promise<string> {
  const role = await prisma.role.upsert({
    where: { name: 'OWNER' },
    create: {
      name: 'OWNER',
      description: 'Superadmin system role holding the reserved * grant.',
      isSystem: true,
    },
    update: {},
  });
  await prisma.rolePermission.upsert({
    where: { roleId_permission: { roleId: role.id, permission: '*' } },
    create: { roleId: role.id, permission: '*' },
    update: {},
  });
  return role.id;
}

async function seedOwner(
  email: string,
  password: string,
  roleId: string,
): Promise<void> {
  const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);
  await prisma.user.upsert({
    where: { email },
    // update:{} keeps an operator-changed password/role intact across re-seeds (doc 09 §6).
    create: { email, passwordHash, roleId, isActive: true },
    update: {},
  });
}

// Approved public addresses (owner-profile §8). The About prose is seeded from
// `content/about-copy.ts` now that final owner-reviewed EN/AR copy exists — the condition
// D18-7 already attaches to seeding these fields, so this is the policy taking effect, not a
// change to it. The same decision still forbids an arbitrary portrait or a fabricated
// MediaAsset, both of which remain absent.
const PROFESSIONAL_EMAIL = 'hello@eslammuatamed.com';
const CONTACT_EMAIL = 'contact@eslammuatamed.com';
// Owner-approved public numbers (D10-16), stored in E.164. Deliberately two constants holding the
// same value rather than one shared constant: `contactPhone` and `whatsappPhone` are independently
// governed, and collapsing them here would quietly reintroduce the inference the contract forbids.
const CONTACT_PHONE = '+201002785408';
const WHATSAPP_PHONE = '+201002785408';

// Positioning per the content source of truth. `tagline` is the approved public title, governed
// literally by positioning-strategy.md §2/§3 (v1.1.0) and imported rather than written here.
const SETTINGS_IDENTITY = [
  {
    locale: 'en',
    siteName: 'Eslam Muatamed',
    tagline: PUBLIC_TAGLINE.en,
    availabilityStatus: 'Open to frontend opportunities',
    defaultMetaTitle: 'Eslam Muatamed',
    defaultMetaDescription:
      'Frontend engineer specializing in Vue.js and Nuxt.js, building fast, accessible, SEO-focused web interfaces.',
  },
  {
    locale: 'ar',
    siteName: 'إسلام معتمد',
    tagline: PUBLIC_TAGLINE.ar,
    availabilityStatus: 'متاح لفرص عمل في تطوير الواجهات الأمامية',
    defaultMetaTitle: 'إسلام معتمد',
    defaultMetaDescription:
      'مهندس واجهات أمامية متخصص في Vue.js و Nuxt.js، أبني واجهات ويب سريعة وسهلة الوصول ومهيأة لمحركات البحث.',
  },
] as const;

async function seedSiteSettings(): Promise<void> {
  const existing = await prisma.siteSettings.findFirst({
    select: { id: true },
  });
  // Operational addresses (owner-profile §8, confirmed 2026-07-29). portraitAssetId stays null —
  // a real MediaAsset is never invented by a seed (D18-7).
  const settings = existing
    ? await prisma.siteSettings.update({
        where: { id: existing.id },
        data: {
          careerStartYear: 2023,
          careerStartMonth: 11,
          professionalEmail: PROFESSIONAL_EMAIL,
          contactEmail: CONTACT_EMAIL,
          contactPhone: CONTACT_PHONE,
          whatsappPhone: WHATSAPP_PHONE,
        },
        select: { id: true },
      })
    : await prisma.siteSettings.create({
        data: {
          analyticsEnabled: false,
          careerStartYear: 2023,
          careerStartMonth: 11,
          professionalEmail: PROFESSIONAL_EMAIL,
          contactEmail: CONTACT_EMAIL,
          contactPhone: CONTACT_PHONE,
          whatsappPhone: WHATSAPP_PHONE,
        },
        select: { id: true },
      });

  // Translations are upserted on every run, not created only alongside a new singleton: an
  // already-provisioned database would otherwise keep the governed fields stale forever, since the
  // singleton branch above never reaches a nested create.
  //
  // Two classes of field, deliberately: `siteName`, `availabilityStatus` and the default meta
  // strings stay CREATE-ONLY, because an operator may have edited them in the CMS. The About copy
  // and the public `tagline` are RE-ASSERTED on every run, because their governing documents —
  // about-copy.md §4 and positioning-strategy.md §2/§3 — are authoritative over any diverging
  // seeded value. The tagline moved into this class with positioning-strategy v1.1.0: leaving it
  // create-only would have left every already-provisioned database on the superseded title.
  // Locale-complete, no cross-locale fallback (D10-6).
  for (const identity of SETTINGS_IDENTITY) {
    const about = ABOUT_COPY[identity.locale];
    await prisma.siteSettingsTranslation.upsert({
      where: {
        siteSettingsId_locale: {
          siteSettingsId: settings.id,
          locale: identity.locale,
        },
      },
      create: { siteSettingsId: settings.id, ...identity, ...about },
      update: { ...about, tagline: identity.tagline },
    });
  }
}

async function seedCategories(): Promise<void> {
  for (const category of CATEGORIES) {
    const existing = await prisma.categoryTranslation.findUnique({
      where: { locale_slug: { locale: 'en', slug: category.en.slug } },
    });
    if (existing) {
      continue;
    }
    await prisma.category.create({
      data: {
        translations: {
          create: [
            { locale: 'en', name: category.en.name, slug: category.en.slug },
            { locale: 'ar', name: category.ar.name, slug: category.ar.slug },
          ],
        },
      },
    });
  }
}

async function main(): Promise<void> {
  const env = validate(process.env);

  await seedLocales();
  const ownerRoleId = await seedOwnerRole();
  await seedOwner(env.SEED_OWNER_EMAIL, env.SEED_OWNER_PASSWORD, ownerRoleId);
  await seedSiteSettings();
  await seedCategories();

  console.log(
    'Seed complete: locales, OWNER role (+* grant), owner, site settings, categories.',
  );
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
