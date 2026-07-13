// Standalone script: class-transformer decorators in env.validation need the metadata
// polyfill that Nest's bootstrap normally provides.
import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { ARGON2_OPTIONS } from '../src/modules/auth/hashing/argon2.options';
import { validate } from '../src/config/env.validation';

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

async function seedSiteSettings(): Promise<void> {
  const existing = await prisma.siteSettings.findFirst();
  if (existing) {
    return;
  }
  await prisma.siteSettings.create({
    data: {
      analyticsEnabled: false,
      translations: {
        create: [
          {
            locale: 'en',
            siteName: 'Eslam Muatamed',
            tagline: 'Software engineer & architect',
            defaultMetaTitle: 'Eslam Muatamed',
            defaultMetaDescription: 'Portfolio, case studies, and writing.',
          },
          {
            locale: 'ar',
            siteName: 'إسلام معتمد',
            tagline: 'مهندس ومعماري برمجيات',
            defaultMetaTitle: 'إسلام معتمد',
            defaultMetaDescription: 'أعمال ودراسات حالة ومقالات.',
          },
        ],
      },
    },
  });
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
