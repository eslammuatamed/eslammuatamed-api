import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ARTICLES } from '../content/canonical/articles';
import { CATEGORIES } from '../content/canonical/categories';
import { EXPERIENCES } from '../content/canonical/experiences';
import { PROJECTS } from '../content/canonical/projects';
import {
  PROFILE_LINKS,
  SETTINGS_SCALARS,
  SETTINGS_TRANSLATIONS,
} from '../content/canonical/site-settings';
import { SKILLS } from '../content/canonical/skills';
import { TAGS } from '../content/canonical/tags';
import {
  CASCADE_ONLY_MODELS,
  GOVERNED_MODELS,
  GOVERNED_SETTINGS_SCALARS,
  GOVERNED_SETTINGS_TRANSLATION_FIELDS,
  OPERATOR_OWNED_SETTINGS_TRANSLATION_FIELDS,
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
    const operatorOwned = new Set<string>(
      OPERATOR_OWNED_SETTINGS_TRANSLATION_FIELDS,
    );

    // Every column must be CLASSIFIED — governed or operator-owned. An unclassified one is the
    // hazard this guard exists for, so a new column fails here until someone decides which it is.
    const unclassified = fieldsOfModel('SiteSettingsTranslation').filter(
      (field) =>
        !structural.has(field) &&
        !governed.has(field) &&
        !operatorOwned.has(field),
    );

    expect(unclassified).toEqual([]);

    // …and the two lists must not overlap, or a field would be both synced and operator-owned.
    expect([...operatorOwned].filter((field) => governed.has(field))).toEqual(
      [],
    );
  });

  it('writes exactly the governed translation fields — no more, no less', () => {
    // `apply-plan.ts` writes a settings translation as `const { locale, ...governed }`, so the
    // canonical object's shape IS the write. If it drifted from the list the builder diffs, one of
    // two silent failures would follow: a diffed-but-never-written field would be reported as an
    // update on every run (so the zero-change second run becomes unreachable), or a
    // written-but-never-diffed field would mutate the row on every run while the report said
    // "unchanged". The scalar side is coupled by the type system; this is the translation side.
    const written = Object.keys(SETTINGS_TRANSLATIONS[0]!).filter(
      (key) => key !== 'locale',
    );

    expect(written.sort()).toEqual(
      [...GOVERNED_SETTINGS_TRANSLATION_FIELDS].sort(),
    );
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

  it('keeps the reviewed content volume — 12 articles and 9 projects', () => {
    // Guards the extraction from `seed.dev.ts`: a dropped entry would otherwise look like a
    // deliberate deletion the moment the synchronization runs.
    //
    // The project count moved 4 -> 9 when the five remaining governed case studies (Zidni,
    // Zidni AI, Nexa, Rabiah Hospitals, LavaStack) were added. Raising this number is the
    // ONLY sanctioned reason to touch this assertion, and it belongs in the same commit as
    // the entries themselves — the tripwire did its job here, failing on an intentional
    // change rather than letting a count drift silently.
    expect(ARTICLES).toHaveLength(12);
    expect(PROJECTS).toHaveLength(9);
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

  // owner-profile §8 (approved 2026-07-29) partitions the addresses by role, and only two are
  // approved for publication. `profileLinks` is in GOVERNED_SETTINGS_SCALARS, so whatever sits here
  // is written to Production by `content:sync:apply` and rendered to every visitor — which is why
  // this is asserted against the canonical dataset and not only against the exported contract
  // (`test/profile-contract.e2e-spec.ts` already guards `openapi.json`, and that guard did NOT
  // cover the seed values: the Gmail sat here while that assertion passed).
  it('publishes no address that owner-profile §8 marks never-public', () => {
    const NEVER_PUBLIC = [
      'eslammuatemed@gmail.com', // internal Contact-form notification destination
      'admin@eslammuatamed.com', // dashboard authentication only
    ];
    // EVERY governed dataset, not just the settings scalars. `content:sync:apply` writes all of
    // these to Production and the public API renders them, so an address pasted into an `aboutBio`,
    // a project case-study body or an article would reach visitors while a scalars-only scan stayed
    // green. `SETTINGS_TRANSLATIONS` matters most: all eight of its fields are governed
    // (`GOVERNED_SETTINGS_TRANSLATION_FIELDS`) and it carries free prose.
    const published = JSON.stringify([
      SETTINGS_SCALARS,
      SETTINGS_TRANSLATIONS,
      ARTICLES,
      PROJECTS,
      EXPERIENCES,
      SKILLS,
      TAGS,
      CATEGORIES,
    ]);
    for (const address of NEVER_PUBLIC) {
      expect(published).not.toContain(address);
    }
  });

  // `HR-8` was cited in three files as the authority for canonical content, and it resolves to
  // NOTHING — no `HR-` code has ever existed in any ref of the docs repository. It survived because
  // a comment citation is checked by no gate, which is the same mechanism that let this branch's
  // parent publish a never-public address behind a superseded `R5` citation.
  //
  // This is deliberately a denylist of the one phantom prefix, NOT a general "every cited decision
  // ID resolves" check. That stronger test would have to read the docs repository, which is a
  // sibling checkout that CI does not clone — and the constitution forbids sharing anything but the
  // exported contract between repos. A test that silently passes when the docs are absent would be
  // worse than none. Verifying the remaining `D**-N` citations stays a review responsibility, and is
  // recorded as such rather than pretended away.
  it('cites no HR-N decision code, because none has ever existed', () => {
    const roots = ['content', 'sync'];
    const files = roots.flatMap((root) =>
      readdirSync(join(__dirname, '..', root), { recursive: true })
        .map(String)
        .filter((name) => name.endsWith('.ts'))
        .map((name) => join(__dirname, '..', root, name)),
    );
    files.push(join(__dirname, '..', 'seed.ts'));
    files.push(join(__dirname, '..', 'seed.dev.ts'));

    const offenders = files
      // This file is excluded because it has to be able to NAME the code it bans; including it
      // would make the test fail on its own explanation.
      .filter((file) => file !== __filename)
      .filter((file) => /\bHR-\d+\b/.test(readFileSync(file, 'utf8')))
      .map((file) => file.replace(join(__dirname, '..', '..'), ''));

    expect(offenders).toEqual([]);
  });

  // positioning-strategy §9 bans the v1.x constructions, and §10 makes these strings owner-reviewed.
  // They were canonicalized once already (S-1): `defaultMetaDescription` carried the v1.x wording in
  // BOTH locales while the tagline beside it was correct, so the surface that publishes the site-wide
  // meta description contradicted the approved positioning.
  //
  // Scanned across the whole canonical dataset, not just the settings row, because the same wording
  // can be pasted into an `aboutBio`, a project overview or an article body — and unlike the tagline
  // ban in `test/public-tagline.e2e-spec.ts`, this one needs no database and runs in the unit lane.
  it('carries no superseded v1.x positioning anywhere in the canonical dataset', () => {
    const SUPERSEDED = [
      // v1.x `defaultMetaDescription` (S-1)
      'Frontend engineer specializing in Vue.js and Nuxt.js',
      'مهندس واجهات أمامية متخصص في Vue.js',
      // The retired About opening, replaced by owner-approved copy 2026-08-05. `ABOUT_COPY` is
      // spread into `SETTINGS_TRANSLATIONS`, so it is inside the scan below — this is what stops
      // the old opening re-entering the synchronization plan through the canonical dataset.
      "I'm a JavaScript Product Engineer — frontend-led",
      'أنا مهندس برمجيات للمنتجات، متخصص في الواجهات الأمامية',
      // The retired About THIRD paragraph, replaced by owner-approved copy 2026-08-06
      // (about-copy.md v1.2.0). It was the last surface carrying the `frontend-led` qualifier, and
      // it is banned here for the same reason as the opening: "absent today" is a fact about one
      // commit, while a denylist entry is a fact about every future one.
      'frontend-led product engineering',
      'هندسة منتجات تقودها الواجهة الأمامية',
    ];
    const published = JSON.stringify([
      SETTINGS_SCALARS,
      SETTINGS_TRANSLATIONS,
      ARTICLES,
      PROJECTS,
      EXPERIENCES,
      SKILLS,
      TAGS,
      CATEGORIES,
    ]);
    for (const phrase of SUPERSEDED) {
      expect(published).not.toContain(phrase);
    }
  });

  // The scan above is a DENYLIST: it catches regression to the two known-bad addresses but cannot
  // catch a third wrong address that nobody has thought of. These are its allowlist half — the two
  // published addresses pinned to the roles R15 assigns them, so a plausible-looking substitution
  // fails here even though no denied string appears anywhere.
  it('pins each published address to the role owner-profile §8 gives it', () => {
    expect(SETTINGS_SCALARS.contactEmail).toBe('contact@eslammuatamed.com');
    expect(SETTINGS_SCALARS.professionalEmail).toBe('hello@eslammuatamed.com');
  });

  // The public Email profile link and `contactEmail` are ONE address rendered in two governed
  // places. They are built from a single constant so they cannot drift; this asserts the property
  // rather than the constant, so replacing the constant with two literals fails here instead of
  // silently reintroducing the divergence that produced the defect.
  it('renders the same public address in the Email profile link and in contactEmail', () => {
    const mailtos = PROFILE_LINKS.filter((link) =>
      link.url.startsWith('mailto:'),
    );
    expect(mailtos).toHaveLength(1);
    expect(mailtos[0]!.url).toBe(`mailto:${SETTINGS_SCALARS.contactEmail}`);
    expect(SETTINGS_SCALARS.contactEmail).toBe('contact@eslammuatamed.com');
  });
});
