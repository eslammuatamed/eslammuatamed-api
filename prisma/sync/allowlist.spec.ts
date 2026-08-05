import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ARTICLES } from '../content/canonical/articles';
import { CATEGORIES } from '../content/canonical/categories';
import { EXPERIENCES } from '../content/canonical/experiences';
import { PROJECTS } from '../content/canonical/projects';
import { SETTINGS_TRANSLATIONS } from '../content/canonical/site-settings';
import { SKILLS } from '../content/canonical/skills';
import { TAGS } from '../content/canonical/tags';
import {
  CASCADE_ONLY_MODELS,
  GOVERNED_MODELS,
  GOVERNED_SETTINGS_SCALARS,
  GOVERNED_SETTINGS_TRANSLATION_FIELDS,
  OPERATOR_OWNED_SETTINGS_SCALARS,
  PROTECTED_MODELS,
} from './allowlist';

const SCHEMA = readFileSync(join(__dirname, '..', 'schema.prisma'), 'utf8');

const modelsInSchema = (): string[] =>
  [...SCHEMA.matchAll(/^model\s+(\w+)\s*\{/gm)].map((match) => match[1]!);

const fieldsOfModel = (model: string): string[] => {
  const body = new RegExp(
    `^model\\s+${model}\\s*\\{([\\s\\S]*?)^\\}`,
    'm',
  ).exec(SCHEMA)?.[1];
  if (!body) throw new Error(`Model ${model} not found in schema.prisma`);
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !line.startsWith('//') &&
        !line.startsWith('@@') &&
        /^\w+\s+\S/.test(line),
    )
    .map((line) => line.split(/\s+/)[0]!);
};

describe('governed allowlist', () => {
  it('classifies EVERY model in schema.prisma as either governed or protected', () => {
    // An UNCLASSIFIED model is the real hazard: it is neither reviewed as governed nor stopped by
    // the protection check, so it would be invisible to both. Adding a model to the schema must
    // fail here until someone classifies it deliberately.
    const classified = new Set<string>([
      ...GOVERNED_MODELS,
      ...PROTECTED_MODELS,
    ]);
    const unclassified = modelsInSchema().filter(
      (model) => !classified.has(model),
    );

    expect(unclassified).toEqual([]);
  });

  it('does not classify any model as both governed and protected', () => {
    const governed = new Set<string>(GOVERNED_MODELS);
    expect(PROTECTED_MODELS.filter((model) => governed.has(model))).toEqual([]);
  });

  it('names no model that does not exist in the schema', () => {
    const real = new Set(modelsInSchema());
    expect(
      [...GOVERNED_MODELS, ...PROTECTED_MODELS].filter(
        (model) => !real.has(model),
      ),
    ).toEqual([]);
  });

  it('protects every operational model the specification names', () => {
    // Spelled out rather than derived, so weakening the protection requires editing a test that
    // says what it is protecting.
    expect(PROTECTED_MODELS).toEqual(
      expect.arrayContaining([
        'User',
        'Role',
        'RolePermission',
        'RefreshToken',
        'ContactMessage',
        'MediaAsset',
        'MediaAssetAlt',
        'MediaAssetVariant',
        'Testimonial',
        'TestimonialTranslation',
        'PageSeo',
        'SlugRedirect',
        'Locale',
      ]),
    );
  });

  it('marks the gallery models cascade-only, and they are governed', () => {
    const governed = new Set<string>(GOVERNED_MODELS);
    for (const model of CASCADE_ONLY_MODELS)
      expect(governed.has(model)).toBe(true);
  });
});

describe('SiteSettings field partition', () => {
  it('classifies every SiteSettings column as governed or operator-owned', () => {
    const structural = new Set([
      'id',
      'createdAt',
      'updatedAt',
      'resumeAsset',
      'portraitAsset',
      'translations',
    ]);
    const classified = new Set<string>([
      ...GOVERNED_SETTINGS_SCALARS,
      ...OPERATOR_OWNED_SETTINGS_SCALARS,
    ]);

    const unclassified = fieldsOfModel('SiteSettings').filter(
      (field) => !structural.has(field) && !classified.has(field),
    );

    expect(unclassified).toEqual([]);
  });

  it('keeps the two SiteSettings lists disjoint', () => {
    const governed = new Set<string>(GOVERNED_SETTINGS_SCALARS);
    expect(
      OPERATOR_OWNED_SETTINGS_SCALARS.filter((field) => governed.has(field)),
    ).toEqual([]);
  });

  it('governs every SiteSettingsTranslation content column', () => {
    const structural = new Set([
      'id',
      'siteSettingsId',
      'locale',
      'createdAt',
      'updatedAt',
      'siteSettings',
      'localeRef',
    ]);
    const governed = new Set<string>(GOVERNED_SETTINGS_TRANSLATION_FIELDS);

    const ungoverned = fieldsOfModel('SiteSettingsTranslation').filter(
      (field) => !structural.has(field) && !governed.has(field),
    );

    expect(ungoverned).toEqual([]);
  });

  it('never governs a media reference on SiteSettings', () => {
    // The synchronization must not be able to point the résumé or portrait at anything: no
    // canonical source states a value, and inventing a MediaAsset is forbidden (D18-7).
    expect(GOVERNED_SETTINGS_SCALARS).not.toContain('resumeAssetId');
    expect(GOVERNED_SETTINGS_SCALARS).not.toContain('portraitAssetId');
  });
});

describe('canonical dataset invariants', () => {
  it('has no duplicate natural key in any collection', () => {
    const unique = (keys: string[]) => new Set(keys).size === keys.length;

    expect(unique(SKILLS.map((skill) => skill.slug))).toBe(true);
    expect(unique(PROJECTS.map((project) => project.en.slug))).toBe(true);
    expect(unique(ARTICLES.map((article) => article.en.slug))).toBe(true);
    expect(unique(CATEGORIES.map((category) => category.en.slug))).toBe(true);
    expect(unique(TAGS.map((tag) => tag.en.slug))).toBe(true);
    expect(unique(TAGS.map((tag) => tag.key))).toBe(true);
    expect(
      unique(
        EXPERIENCES.map(
          (experience) => `${experience.en.company} :: ${experience.en.role}`,
        ),
      ),
    ).toBe(true);
  });

  it('carries both EN and AR for every localized entity', () => {
    const bilingual = (
      entries: readonly { en: unknown; ar: unknown }[],
    ): boolean =>
      entries.every((entry) => Boolean(entry.en) && Boolean(entry.ar));

    expect(bilingual(PROJECTS)).toBe(true);
    expect(bilingual(ARTICLES)).toBe(true);
    expect(bilingual(EXPERIENCES)).toBe(true);
    expect(bilingual(CATEGORIES)).toBe(true);
    expect(bilingual(TAGS)).toBe(true);
    expect(
      SKILLS.every((skill) => Boolean(skill.labelEn) && Boolean(skill.labelAr)),
    ).toBe(true);
    expect(SETTINGS_TRANSLATIONS.map((row) => row.locale).sort()).toEqual([
      'ar',
      'en',
    ]);
  });

  it('gives every SiteSettings translation a non-empty value for every governed field', () => {
    for (const translation of SETTINGS_TRANSLATIONS)
      for (const field of GOVERNED_SETTINGS_TRANSLATION_FIELDS)
        expect(translation[field]?.length ?? 0).toBeGreaterThan(0);
  });

  it('resolves SAMT to 2026', () => {
    // The wrong year survived in production for a year because the seed was create-only. It is
    // corrected in the canonical dataset — not by a one-off UPDATE — so it is re-asserted on every
    // run and cannot drift back silently.
    const samt = PROJECTS.find(
      (project) => project.en.slug === 'samt-institution-website',
    );

    expect(samt).toBeDefined();
    expect(samt?.year).toBe(2026);
  });

  it('links only canonical skills from projects and experiences', () => {
    const slugs = new Set(SKILLS.map((skill) => skill.slug));
    for (const project of PROJECTS)
      for (const key of project.techKeys) expect(slugs.has(key)).toBe(true);
    for (const experience of EXPERIENCES)
      for (const key of experience.techKeys) expect(slugs.has(key)).toBe(true);
  });

  it('links only canonical categories and tags from articles', () => {
    const categorySlugs = new Set(CATEGORIES.map((c) => c.en.slug));
    const tagKeys = new Set(TAGS.map((tag) => tag.key));
    for (const article of ARTICLES) {
      expect(categorySlugs.has(article.categorySlug)).toBe(true);
      for (const key of article.tagKeys) expect(tagKeys.has(key)).toBe(true);
    }
  });

  it('keeps the reviewed content volume — 12 articles and 4 projects', () => {
    // Guards the extraction from `seed.dev.ts`: a dropped entry would otherwise look like a
    // deliberate deletion the moment the synchronization runs.
    expect(ARTICLES).toHaveLength(12);
    expect(PROJECTS).toHaveLength(4);
  });

  it('uses lowercase kebab-case, non-uuid-shaped skill slugs (the D09-20 CHECK rule)', () => {
    const kebab = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    const uuidShaped =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    for (const skill of SKILLS) {
      expect(skill.slug).toMatch(kebab);
      expect(skill.slug).not.toMatch(uuidShaped);
    }
  });
});
