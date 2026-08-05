// Deterministic plan builder for the canonical content synchronization (doc 09 §6.2, D09-21).
//
// Performs ZERO writes — it is handed a `ReadOnlyDb`, so a write is a compile error. The same
// function backs both `content:sync:plan` and `content:sync:apply`; that identity is what makes the
// dry-run a trustworthy preview rather than a second opinion.
//
// Ordering is deterministic everywhere (records sorted by model then natural key, relation members
// sorted, fields emitted in declaration order) so two runs of the dry-run diff cleanly and the
// output can be attached to a release record.
import { ARTICLES } from '../content/canonical/articles';
import { CATEGORIES } from '../content/canonical/categories';
import { EXPERIENCES } from '../content/canonical/experiences';
import { PROJECTS } from '../content/canonical/projects';
import {
  SETTINGS_SCALARS,
  SETTINGS_TRANSLATIONS,
} from '../content/canonical/site-settings';
import { SKILLS } from '../content/canonical/skills';
import { TAGS } from '../content/canonical/tags';
import {
  GOVERNED_MODELS,
  GOVERNED_SETTINGS_SCALARS,
  GOVERNED_SETTINGS_TRANSLATION_FIELDS,
  isGoverned,
  PROTECTED_MODELS,
} from './allowlist';
import type { ProtectedModel } from './allowlist';
import {
  articleScalars,
  experienceScalars,
  projectScalars,
} from './governed-scalars';
import type { ReadOnlyDb } from './read-client';
import type {
  CascadeDisclosure,
  FieldChange,
  Plan,
  RecordChange,
  RelationChange,
} from './types';

export const LOCALE_EN = 'en';
export const LOCALE_AR = 'ar';
const REQUIRED_LOCALES = [LOCALE_EN, LOCALE_AR] as const;

/**
 * `Experience` is the one governed model with no database-level natural key: the schema has no
 * unique constraint that identifies a role, and inventing one would be a migration this workstream
 * has no mandate for. The English `(company, role)` pair is what the dataset actually distinguishes
 * entries by, so it is the key — and because the database does not enforce it, the builder REFUSES
 * when two rows match one key rather than picking one. Fail-closed is the whole compensation.
 */
export function experienceKey(company: string, role: string): string {
  return `${company} :: ${role}`;
}

/**
 * The governed translation fields, per model.
 *
 * These are EXPORTED because `apply-plan.ts` writes a translation by spreading the whole canonical
 * content object (`{ locale, ...content }`), while the builder diffs only the fields named here.
 * If the two drifted, a field would be written on every run but never diffed — mutating the row
 * while the report said "unchanged". `build-plan.spec.ts` asserts each list equals the canonical
 * object's keys minus the natural-key field, which is the only member legitimately absent (it is
 * what the row was found BY, so it cannot differ).
 */
export const PROJECT_TRANSLATION_FIELDS = [
  'title',
  'summary',
  'overview',
  'businessProblem',
  'solution',
  'role',
  'architecture',
  'challenges',
  'features',
  'lessonsLearned',
  'metaTitle',
  'metaDescription',
] as const;

export const ARTICLE_TRANSLATION_FIELDS = [
  'title',
  'excerpt',
  'body',
  'readingTimeMin',
] as const;

export const EXPERIENCE_TRANSLATION_FIELDS = [
  'role',
  'company',
  'location',
  'impact',
] as const;

/**
 * The subset of `EXPERIENCE_TRANSLATION_FIELDS` that forms the natural key. Diffing these on the
 * ENGLISH side would be meaningless — the row was found BY them — but they are still diffed and
 * written on the Arabic side, where they are ordinary content.
 */
export const EXPERIENCE_NATURAL_KEY_FIELDS: readonly string[] = [
  'role',
  'company',
];

/**
 * Key-order-independent structural comparison. `profileLinks` is a JSONB column, and PostgreSQL
 * returns object keys in whatever order they were written — comparing raw `JSON.stringify` output
 * would report a spurious update forever on a database whose rows were written by an older key
 * order, which would break the zero-change second-run property.
 */
function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (value instanceof Date) return `date:${value.getTime()}`;
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object')
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([key, member]) => `${JSON.stringify(key)}:${stableStringify(member)}`,
      )
      .join(',')}}`;
  return JSON.stringify(value);
}

function changed(
  field: string,
  before: unknown,
  after: unknown,
): FieldChange | null {
  return stableStringify(before) === stableStringify(after)
    ? null
    : { field, before, after };
}

function diffFields(
  pairs: readonly (readonly [string, unknown, unknown])[],
): FieldChange[] {
  return pairs
    .map(([field, before, after]) => changed(field, before, after))
    .filter((change): change is FieldChange => change !== null);
}

/**
 * For a `create` there is no "before", so `diffFields` would silently drop every field whose
 * canonical value happens to be null (`endDate`, `liveUrl`, `repoUrl`, `brandColor`). The dry-run
 * contract asks for the governed scalars of every planned change, so creates report all of them.
 */
function allFields(
  pairs: readonly (readonly [string, unknown])[],
): FieldChange[] {
  return pairs.map(([field, after]) => ({ field, before: undefined, after }));
}

/**
 * Diff a governed-scalar object produced by `governed-scalars.ts` against the stored row. The
 * builder therefore diffs THE VERY OBJECT apply writes — there is no second field list that could
 * drift out of step with it.
 */
function diffScalars(
  canonical: Readonly<Record<string, unknown>>,
  stored: Readonly<Record<string, unknown>>,
): FieldChange[] {
  return diffFields(
    Object.entries(canonical).map(
      ([field, after]) => [field, stored[field], after] as const,
    ),
  );
}

function allScalars(
  canonical: Readonly<Record<string, unknown>>,
): FieldChange[] {
  return allFields(Object.entries(canonical));
}

function relationDiff(
  model: RelationChange['model'],
  owner: string,
  current: readonly string[],
  canonical: readonly string[],
): RelationChange {
  const currentSet = new Set(current);
  const canonicalSet = new Set(canonical);
  return {
    model,
    owner,
    added: canonical.filter((member) => !currentSet.has(member)).sort(),
    removed: current.filter((member) => !canonicalSet.has(member)).sort(),
  };
}

/** Duplicate natural keys inside the canonical dataset itself — a dataset bug, refused up front. */
function duplicates(keys: readonly string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) dupes.add(key);
    seen.add(key);
  }
  return [...dupes].sort();
}

interface SlugHolder {
  readonly id: string;
  readonly slugs: readonly { readonly locale: string; readonly slug: string }[];
}

interface SlugSubject {
  readonly model: string;
  /** Canonical entries that will be created or updated, with the row they target (null = create). */
  readonly canonical: readonly {
    readonly key: string;
    readonly rowId: string | null;
    readonly slugs: readonly {
      readonly locale: string;
      readonly slug: string;
    }[];
  }[];
  readonly rows: readonly SlugHolder[];
  /** Rows the apply path removes BEFORE it writes, so their slugs are free for reuse. */
  readonly freedBeforeWrites: ReadonlySet<string>;
}

/**
 * Every translation table carries `@@unique([locale, slug])`, and Postgres does not defer it. Apply
 * deletes stale rows before writing (see `apply-plan.ts` step 0), which frees the ordinary
 * rename case — but two cases remain: a slug still held by a row that is NOT deleted first
 * (categories, which must be deleted last), and two canonical entries swapping slugs with each
 * other. Both would abort the transaction on a raw 23505 AFTER the dry-run called the plan
 * applicable.
 *
 * That is a dry-run FIDELITY defect rather than a destructive one — the transaction rolls back, so
 * none of the run's own changes are applied — but "the preview predicts the apply" is the property
 * that makes this tool safe to authorize, so the collision is detected here and refused with an
 * explanation instead of surfacing as a Postgres error code.
 */
function detectSlugCollisions(subjects: readonly SlugSubject[]): string[] {
  const problems: string[] = [];
  for (const subject of subjects) {
    const claimed = new Map<string, string>();
    for (const entry of subject.canonical)
      for (const { locale, slug } of entry.slugs) {
        const pair = `${locale}:${slug}`;

        // Two canonical entries claiming one (locale, slug). The English side is already caught by
        // the duplicate-natural-key check; this is what catches the ARABIC side, which that check
        // never looked at.
        const rival = claimed.get(pair);
        if (rival && rival !== entry.key) {
          problems.push(
            `Canonical ${subject.model} entries "${rival}" and "${entry.key}" both claim the ` +
              `${locale} slug "${slug}". \`@@unique([locale, slug])\` allows only one.`,
          );
          continue;
        }
        claimed.set(pair, entry.key);

        // ALL holders, not just the first: the unique index means a real database has at most
        // one, but scanning only the first would let the target row itself mask a second holder
        // and silently skip the check.
        for (const holder of subject.rows.filter((row) =>
          row.slugs.some(
            (candidate) =>
              candidate.locale === locale && candidate.slug === slug,
          ),
        )) {
          if (holder.id === entry.rowId) continue;
          if (subject.freedBeforeWrites.has(holder.id)) continue;

          problems.push(
            `${subject.model} "${entry.key}" needs the ${locale} slug "${slug}", but row ` +
              `${holder.id} still holds it and this plan does not remove it first. The write ` +
              `would violate \`@@unique([locale, slug])\` and roll the whole run back. Free the ` +
              `slug in a separate step, then synchronize.`,
          );
        }
      }
  }
  return problems;
}

function englishOf<T extends { locale: string }>(
  translations: readonly T[],
): T | undefined {
  return translations.find((translation) => translation.locale === LOCALE_EN);
}

export async function buildPlan(db: ReadOnlyDb): Promise<Plan> {
  const records: RecordChange[] = [];
  const relations: RelationChange[] = [];
  const cascades: CascadeDisclosure[] = [];
  const problems: string[] = [];

  // ---- Preconditions -------------------------------------------------------------------------
  const locales = await db.locale.findMany({ select: { code: true } });
  const localeCodes = new Set(locales.map((locale) => locale.code));
  for (const required of REQUIRED_LOCALES) {
    if (!localeCodes.has(required))
      problems.push(
        `Locale "${required}" is missing. Run \`npm run db:seed\` first — the synchronization ` +
          `never creates locales (doc 09 §6.1).`,
      );
  }

  // ---- Canonical dataset self-checks --------------------------------------------------------
  const datasetDupes: readonly (readonly [string, string[]])[] = [
    ['Skill', duplicates(SKILLS.map((skill) => skill.slug))],
    ['Project', duplicates(PROJECTS.map((project) => project.en.slug))],
    ['Article', duplicates(ARTICLES.map((article) => article.en.slug))],
    ['Category', duplicates(CATEGORIES.map((category) => category.en.slug))],
    ['Tag', duplicates(TAGS.map((tag) => tag.en.slug))],
    ['Tag(key)', duplicates(TAGS.map((tag) => tag.key))],
    [
      'Experience',
      duplicates(
        EXPERIENCES.map((experience) =>
          experienceKey(experience.en.company, experience.en.role),
        ),
      ),
    ],
  ];
  for (const [model, dupes] of datasetDupes) {
    if (dupes.length)
      problems.push(
        `Duplicate ${model} natural key(s) in the canonical dataset: ${dupes.join(', ')}. ` +
          `Two entries sharing a key would collapse into one row and silently drop the other's relations.`,
      );
  }

  // ---- Skills --------------------------------------------------------------------------------
  // Matched by `slug`, which is unique and never changes — that is what makes a label rename an
  // update in place rather than a second row holding half the relations. `slug` is never written
  // here: it is added by the D09-20 migration and only consumed as a key (doc 09 §6.4).
  const dbSkills = await db.skill.findMany({
    select: {
      id: true,
      slug: true,
      group: true,
      order: true,
      brandColor: true,
      isPublic: true,
      translations: { select: { locale: true, label: true } },
    },
  });
  const skillBySlug = new Map(dbSkills.map((skill) => [skill.slug, skill]));
  const canonicalSkillSlugs = new Set(SKILLS.map((skill) => skill.slug));

  for (const skill of [...SKILLS].sort((a, b) =>
    a.slug.localeCompare(b.slug),
  )) {
    const existing = skillBySlug.get(skill.slug);
    const wanted = {
      group: skill.group,
      order: skill.order,
      brandColor: skill.brandColor,
      isPublic: skill.isPublic ?? true,
    };
    if (!existing) {
      // The English label is still what a reader sees, and it is what every pre-slug row was keyed
      // by. If a DIFFERENT record already holds this label, creating a second one would split one
      // capability across two rows that look identical in the UI, each holding half the relations.
      const clash = dbSkills.find(
        (candidate) =>
          candidate.slug !== skill.slug &&
          englishOf(candidate.translations)?.label === skill.labelEn,
      );
      if (clash)
        problems.push(
          `Skill identity conflict: "${skill.labelEn}" is already held by the record with slug ` +
            `"${clash.slug}", but the canonical dataset expects slug "${skill.slug}". Creating a ` +
            `second record would split one capability across two rows. Reconcile the existing ` +
            `record's slug before synchronizing.`,
        );
      records.push({
        model: 'Skill',
        action: 'create',
        naturalKey: skill.slug,
        label: skill.labelEn,
        fields: allFields([
          ['group', wanted.group],
          ['order', wanted.order],
          ['brandColor', wanted.brandColor],
          ['isPublic', wanted.isPublic],
          ['label.en', skill.labelEn],
          ['label.ar', skill.labelAr],
        ]),
      });
      continue;
    }
    const fields = diffFields([
      ['group', existing.group, wanted.group],
      ['order', existing.order, wanted.order],
      ['brandColor', existing.brandColor, wanted.brandColor],
      ['isPublic', existing.isPublic, wanted.isPublic],
      [
        'label.en',
        englishOf(existing.translations)?.label ?? null,
        skill.labelEn,
      ],
      [
        'label.ar',
        existing.translations.find((t) => t.locale === LOCALE_AR)?.label ??
          null,
        skill.labelAr,
      ],
    ]);
    records.push({
      model: 'Skill',
      action: fields.length ? 'update' : 'unchanged',
      naturalKey: skill.slug,
      id: existing.id,
      label: skill.labelEn,
      fields,
    });
  }

  // A skill absent from the canonical dataset is HIDDEN, never deleted: both join tables are
  // `onDelete: Restrict`, so the database would refuse anyway, and hiding preserves the id and every
  // project/experience relation pointing at it (doc 09 §6.4).
  for (const skill of dbSkills
    .filter((candidate) => !canonicalSkillSlugs.has(candidate.slug))
    .sort((a, b) => a.slug.localeCompare(b.slug))) {
    records.push({
      model: 'Skill',
      action: skill.isPublic ? 'hide' : 'unchanged',
      naturalKey: skill.slug,
      id: skill.id,
      label: englishOf(skill.translations)?.label ?? skill.slug,
      fields: skill.isPublic
        ? [{ field: 'isPublic', before: true, after: false }]
        : [],
    });
  }

  // ---- Categories ----------------------------------------------------------------------------
  const dbCategories = await db.category.findMany({
    select: {
      id: true,
      translations: {
        select: { locale: true, name: true, slug: true },
      },
      articles: { select: { id: true } },
    },
  });
  const categoryBySlug = new Map<string, (typeof dbCategories)[number]>();
  for (const category of dbCategories) {
    const english = englishOf(category.translations);
    if (!english) {
      problems.push(
        `Category ${category.id} has no English translation, so it has no natural key. Refusing ` +
          `rather than guessing whether it is canonical.`,
      );
      continue;
    }
    if (categoryBySlug.has(english.slug)) {
      problems.push(
        `Two Category rows share the English slug "${english.slug}". The natural key must identify ` +
          `exactly one row; reconcile them before synchronizing.`,
      );
      continue;
    }
    categoryBySlug.set(english.slug, category);
  }
  const categoryIdBySlug = new Map<string, string>();
  const canonicalCategorySlugs = new Set(
    CATEGORIES.map((category) => category.en.slug),
  );

  for (const category of [...CATEGORIES].sort((a, b) =>
    a.en.slug.localeCompare(b.en.slug),
  )) {
    const existing = categoryBySlug.get(category.en.slug);
    if (!existing) {
      records.push({
        model: 'Category',
        action: 'create',
        naturalKey: category.en.slug,
        label: category.en.name,
        fields: allFields([
          ['name.en', category.en.name],
          ['name.ar', category.ar.name],
          ['slug.ar', category.ar.slug],
        ]),
      });
      continue;
    }
    categoryIdBySlug.set(category.en.slug, existing.id);
    const arabic = existing.translations.find((t) => t.locale === LOCALE_AR);
    const fields = diffFields([
      [
        'name.en',
        englishOf(existing.translations)?.name ?? null,
        category.en.name,
      ],
      ['name.ar', arabic?.name ?? null, category.ar.name],
      ['slug.ar', arabic?.slug ?? null, category.ar.slug],
    ]);
    records.push({
      model: 'Category',
      action: fields.length ? 'update' : 'unchanged',
      naturalKey: category.en.slug,
      id: existing.id,
      label: category.en.name,
      fields,
    });
  }

  // ---- Tags ----------------------------------------------------------------------------------
  const dbTags = await db.tag.findMany({
    select: {
      id: true,
      translations: { select: { locale: true, name: true, slug: true } },
    },
  });
  const tagBySlug = new Map<string, (typeof dbTags)[number]>();
  for (const tag of dbTags) {
    const english = englishOf(tag.translations);
    if (!english) {
      problems.push(
        `Tag ${tag.id} has no English translation, so it has no natural key. Refusing rather than ` +
          `guessing whether it is canonical.`,
      );
      continue;
    }
    if (tagBySlug.has(english.slug)) {
      problems.push(
        `Two Tag rows share the English slug "${english.slug}". The natural key must identify ` +
          `exactly one row; reconcile them before synchronizing.`,
      );
      continue;
    }
    tagBySlug.set(english.slug, tag);
  }
  const tagIdByKey = new Map<string, string>();
  const canonicalTagSlugs = new Set(TAGS.map((tag) => tag.en.slug));

  for (const tag of [...TAGS].sort((a, b) =>
    a.en.slug.localeCompare(b.en.slug),
  )) {
    const existing = tagBySlug.get(tag.en.slug);
    if (!existing) {
      records.push({
        model: 'Tag',
        action: 'create',
        naturalKey: tag.en.slug,
        label: tag.en.name,
        fields: allFields([
          ['name.en', tag.en.name],
          ['name.ar', tag.ar.name],
          ['slug.ar', tag.ar.slug],
        ]),
      });
      continue;
    }
    tagIdByKey.set(tag.key, existing.id);
    const arabic = existing.translations.find((t) => t.locale === LOCALE_AR);
    const fields = diffFields([
      ['name.en', englishOf(existing.translations)?.name ?? null, tag.en.name],
      ['name.ar', arabic?.name ?? null, tag.ar.name],
      ['slug.ar', arabic?.slug ?? null, tag.ar.slug],
    ]);
    records.push({
      model: 'Tag',
      action: fields.length ? 'update' : 'unchanged',
      naturalKey: tag.en.slug,
      id: existing.id,
      label: tag.en.name,
      fields,
    });
  }

  // ---- Experiences ---------------------------------------------------------------------------
  const dbExperiences = await db.experience.findMany({
    select: {
      id: true,
      startDate: true,
      endDate: true,
      isCurrent: true,
      employmentType: true,
      order: true,
      translations: {
        select: {
          locale: true,
          role: true,
          company: true,
          location: true,
          impact: true,
        },
      },
      technologies: { select: { skillId: true } },
    },
  });
  const experienceByKey = new Map<string, (typeof dbExperiences)[number]>();
  for (const experience of dbExperiences) {
    const english = englishOf(experience.translations);
    if (!english) {
      problems.push(
        `Experience ${experience.id} has no English translation, so it has no natural key. ` +
          `Refusing rather than guessing whether it is canonical.`,
      );
      continue;
    }
    const key = experienceKey(english.company, english.role);
    if (experienceByKey.has(key)) {
      problems.push(
        `Two Experience rows share the English (company, role) key "${key}". The schema has no ` +
          `unique constraint here, so the synchronization refuses rather than picking one.`,
      );
      continue;
    }
    experienceByKey.set(key, experience);
  }
  const canonicalExperienceKeys = new Set(
    EXPERIENCES.map((experience) =>
      experienceKey(experience.en.company, experience.en.role),
    ),
  );

  for (const experience of [...EXPERIENCES].sort((a, b) =>
    experienceKey(a.en.company, a.en.role).localeCompare(
      experienceKey(b.en.company, b.en.role),
    ),
  )) {
    const key = experienceKey(experience.en.company, experience.en.role);
    for (const slug of experience.techKeys)
      if (!canonicalSkillSlugs.has(slug))
        problems.push(
          `Experience "${key}" links technology "${slug}", which is not in the canonical Skills dataset.`,
        );
    const existing = experienceByKey.get(key);
    if (!existing) {
      records.push({
        model: 'Experience',
        action: 'create',
        naturalKey: key,
        label: `${experience.en.role} — ${experience.en.company}`,
        fields: [
          ...allScalars(experienceScalars(experience)),
          ...allFields([
            ['role.en', experience.en.role],
            ['company.en', experience.en.company],
          ]),
        ],
      });
      relations.push(
        relationDiff(
          'ExperienceTechnology',
          key,
          [],
          [...experience.techKeys].sort(),
        ),
      );
      continue;
    }
    const arabic = existing.translations.find((t) => t.locale === LOCALE_AR);
    const english = englishOf(existing.translations);
    const fields = [
      ...diffScalars(experienceScalars(experience), existing),
      // EN omits `role`/`company`: they ARE the natural key, so the row was found by them and they
      // cannot differ. Every other governed translation field is mapped from the shared constant,
      // so the constant is load-bearing here rather than merely exported for a test to look at.
      ...diffFields(
        EXPERIENCE_TRANSLATION_FIELDS.filter(
          (field) => !EXPERIENCE_NATURAL_KEY_FIELDS.includes(field),
        ).map(
          (field) =>
            [
              `${field}.en`,
              english?.[field] ?? null,
              experience.en[field],
            ] as const,
        ),
      ),
      ...diffFields(
        EXPERIENCE_TRANSLATION_FIELDS.map(
          (field) =>
            [
              `${field}.ar`,
              arabic?.[field] ?? null,
              experience.ar[field],
            ] as const,
        ),
      ),
    ];
    records.push({
      model: 'Experience',
      action: fields.length ? 'update' : 'unchanged',
      naturalKey: key,
      id: existing.id,
      label: `${experience.en.role} — ${experience.en.company}`,
      fields,
    });
    const currentSlugs = existing.technologies
      .map(
        (link) =>
          dbSkills.find((skill) => skill.id === link.skillId)?.slug ??
          `unknown:${link.skillId}`,
      )
      .sort();
    relations.push(
      relationDiff(
        'ExperienceTechnology',
        key,
        currentSlugs,
        [...experience.techKeys].sort(),
      ),
    );
  }

  for (const [key, experience] of [...experienceByKey].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (canonicalExperienceKeys.has(key)) continue;
    const english = englishOf(experience.translations);
    records.push({
      model: 'Experience',
      action: 'delete',
      naturalKey: key,
      id: experience.id,
      label: english ? `${english.role} — ${english.company}` : key,
      fields: [],
    });
  }

  // ---- Projects ------------------------------------------------------------------------------
  const projectTranslationFields = PROJECT_TRANSLATION_FIELDS;

  const dbProjects = await db.project.findMany({
    select: {
      id: true,
      featured: true,
      isPublished: true,
      order: true,
      year: true,
      liveUrl: true,
      repoUrl: true,
      translations: {
        select: {
          locale: true,
          slug: true,
          title: true,
          summary: true,
          overview: true,
          businessProblem: true,
          solution: true,
          role: true,
          architecture: true,
          challenges: true,
          features: true,
          lessonsLearned: true,
          metaTitle: true,
          metaDescription: true,
        },
      },
      technologies: { select: { skillId: true } },
      gallery: { select: { id: true } },
    },
  });
  const projectBySlug = new Map<string, (typeof dbProjects)[number]>();
  for (const project of dbProjects) {
    const english = englishOf(project.translations);
    if (!english) {
      problems.push(
        `Project ${project.id} has no English translation, so it has no natural key. Refusing ` +
          `rather than guessing whether it is canonical.`,
      );
      continue;
    }
    if (projectBySlug.has(english.slug)) {
      problems.push(
        `Two Project rows share the English slug "${english.slug}". The natural key must identify ` +
          `exactly one row; reconcile them before synchronizing.`,
      );
      continue;
    }
    projectBySlug.set(english.slug, project);
  }
  const canonicalProjectSlugs = new Set(
    PROJECTS.map((project) => project.en.slug),
  );

  for (const project of [...PROJECTS].sort((a, b) =>
    a.en.slug.localeCompare(b.en.slug),
  )) {
    for (const slug of project.techKeys)
      if (!canonicalSkillSlugs.has(slug))
        problems.push(
          `Project "${project.en.slug}" links technology "${slug}", which is not in the canonical Skills dataset.`,
        );

    const existing = projectBySlug.get(project.en.slug);
    if (!existing) {
      records.push({
        model: 'Project',
        action: 'create',
        naturalKey: project.en.slug,
        label: project.en.title,
        fields: [
          ...allScalars(projectScalars(project)),
          ...allFields([
            ['title.en', project.en.title],
            ['slug.ar', project.ar.slug],
          ]),
        ],
      });
      relations.push(
        relationDiff(
          'ProjectTechnology',
          project.en.slug,
          [],
          [...project.techKeys].sort(),
        ),
      );
      continue;
    }
    const english = englishOf(existing.translations);
    const arabic = existing.translations.find((t) => t.locale === LOCALE_AR);
    const fields = [
      ...diffScalars(projectScalars(project), existing),
      ...diffFields([
        ...projectTranslationFields.map(
          (field) =>
            [
              `${field}.en`,
              english?.[field] ?? null,
              project.en[field],
            ] as const,
        ),
        ['slug.ar', arabic?.slug ?? null, project.ar.slug],
        ...projectTranslationFields.map(
          (field) =>
            [
              `${field}.ar`,
              arabic?.[field] ?? null,
              project.ar[field],
            ] as const,
        ),
      ]),
    ];
    records.push({
      model: 'Project',
      action: fields.length ? 'update' : 'unchanged',
      naturalKey: project.en.slug,
      id: existing.id,
      label: project.en.title,
      fields,
    });
    const currentSlugs = existing.technologies
      .map(
        (link) =>
          dbSkills.find((skill) => skill.id === link.skillId)?.slug ??
          `unknown:${link.skillId}`,
      )
      .sort();
    relations.push(
      relationDiff(
        'ProjectTechnology',
        project.en.slug,
        currentSlugs,
        [...project.techKeys].sort(),
      ),
    );
  }

  for (const [slug, project] of [...projectBySlug].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (canonicalProjectSlugs.has(slug)) continue;
    records.push({
      model: 'Project',
      action: 'delete',
      naturalKey: slug,
      id: project.id,
      label: englishOf(project.translations)?.title ?? slug,
      fields: [],
    });
    // Disclosed, not silent: the delete cascades into the gallery rows. The referenced MediaAsset
    // survives — only the governed relation goes (doc 09 §6.1).
    if (project.gallery.length)
      cascades.push({
        model: 'ProjectGalleryItem',
        owner: slug,
        count: project.gallery.length,
        detail: project.gallery.map((item) => item.id).sort(),
      });
  }

  // ---- Articles ------------------------------------------------------------------------------
  const articleTranslationFields = ARTICLE_TRANSLATION_FIELDS;

  const dbArticles = await db.article.findMany({
    select: {
      id: true,
      status: true,
      publishAt: true,
      categoryId: true,
      translations: {
        select: {
          locale: true,
          slug: true,
          title: true,
          excerpt: true,
          body: true,
          readingTimeMin: true,
        },
      },
      tags: { select: { tagId: true } },
    },
  });
  const articleBySlug = new Map<string, (typeof dbArticles)[number]>();
  for (const article of dbArticles) {
    const english = englishOf(article.translations);
    if (!english) {
      problems.push(
        `Article ${article.id} has no English translation, so it has no natural key. Refusing ` +
          `rather than guessing whether it is canonical.`,
      );
      continue;
    }
    if (articleBySlug.has(english.slug)) {
      problems.push(
        `Two Article rows share the English slug "${english.slug}". The natural key must identify ` +
          `exactly one row; reconcile them before synchronizing.`,
      );
      continue;
    }
    articleBySlug.set(english.slug, article);
  }
  const canonicalArticleSlugs = new Set(
    ARTICLES.map((article) => article.en.slug),
  );
  const tagSlugById = new Map(
    dbTags
      .map((tag) => [tag.id, englishOf(tag.translations)?.slug] as const)
      .filter((pair): pair is readonly [string, string] => Boolean(pair[1])),
  );
  const canonicalTagSlugByKey = new Map(
    TAGS.map((tag) => [tag.key, tag.en.slug]),
  );

  for (const article of [...ARTICLES].sort((a, b) =>
    a.en.slug.localeCompare(b.en.slug),
  )) {
    if (!canonicalCategorySlugs.has(article.categorySlug))
      problems.push(
        `Article "${article.en.slug}" links category "${article.categorySlug}", which is not in the ` +
          `canonical Categories dataset.`,
      );
    const wantedTagSlugs: string[] = [];
    for (const key of article.tagKeys) {
      const slug = canonicalTagSlugByKey.get(key);
      if (slug) wantedTagSlugs.push(slug);
      else
        problems.push(
          `Article "${article.en.slug}" links tag key "${key}", which is not in the canonical Tags dataset.`,
        );
    }
    wantedTagSlugs.sort();

    const existing = articleBySlug.get(article.en.slug);
    if (!existing) {
      records.push({
        model: 'Article',
        action: 'create',
        naturalKey: article.en.slug,
        label: article.en.title,
        fields: [
          ...allScalars(articleScalars(article)),
          ...allFields([
            ['category', article.categorySlug],
            ['title.en', article.en.title],
            ['slug.ar', article.ar.slug],
          ]),
        ],
      });
      relations.push(
        relationDiff('ArticleTag', article.en.slug, [], wantedTagSlugs),
      );
      continue;
    }
    const english = englishOf(existing.translations);
    const arabic = existing.translations.find((t) => t.locale === LOCALE_AR);
    const currentCategorySlug =
      [...categoryIdBySlug].find(([, id]) => id === existing.categoryId)?.[0] ??
      existing.categoryId;
    const fields = [
      ...diffScalars(articleScalars(article), existing),
      ...diffFields([
        ['category', currentCategorySlug, article.categorySlug],
        ...articleTranslationFields.map(
          (field) =>
            [
              `${field}.en`,
              english?.[field] ?? null,
              article.en[field],
            ] as const,
        ),
        ['slug.ar', arabic?.slug ?? null, article.ar.slug],
        ...articleTranslationFields.map(
          (field) =>
            [
              `${field}.ar`,
              arabic?.[field] ?? null,
              article.ar[field],
            ] as const,
        ),
      ]),
    ];
    records.push({
      model: 'Article',
      action: fields.length ? 'update' : 'unchanged',
      naturalKey: article.en.slug,
      id: existing.id,
      label: article.en.title,
      fields,
    });
    const currentTagSlugs = existing.tags
      .map((link) => tagSlugById.get(link.tagId) ?? `unknown:${link.tagId}`)
      .sort();
    relations.push(
      relationDiff(
        'ArticleTag',
        article.en.slug,
        currentTagSlugs,
        wantedTagSlugs,
      ),
    );
  }

  for (const [slug, article] of [...articleBySlug].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (canonicalArticleSlugs.has(slug)) continue;
    records.push({
      model: 'Article',
      action: 'delete',
      naturalKey: slug,
      id: article.id,
      label: englishOf(article.translations)?.title ?? slug,
      fields: [],
    });
  }

  // A stale Category still referenced AFTER the run cannot be deleted (`Article.category` is
  // `onDelete: Restrict`). Detected here rather than discovered as a constraint violation
  // mid-transaction.
  //
  // "After the run" is the load-bearing part. Two groups of article stop referencing a stale
  // category: the ones this plan DELETES, and the ones it REPOINTS — every canonical article is
  // updated to its canonical category, and a canonical category is by definition never one of the
  // stale ones. Counting only the deletions would refuse a perfectly safe run whenever a canonical
  // article happened to be sitting in a stale category, which is precisely the situation this tool
  // exists to repair. The guard stays as a backstop against a bug elsewhere; it should not fire in
  // normal operation.
  const deletedArticleIds = new Set(
    records
      .filter(
        (record) => record.model === 'Article' && record.action === 'delete',
      )
      .map((record) => record.id),
  );
  const repointedArticleIds = new Set(
    [...articleBySlug]
      .filter(([articleSlug]) => canonicalArticleSlugs.has(articleSlug))
      .map(([, article]) => article.id),
  );
  for (const [slug, category] of [...categoryBySlug].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (canonicalCategorySlugs.has(slug)) continue;
    const survivors = category.articles.filter(
      (article) =>
        !deletedArticleIds.has(article.id) &&
        !repointedArticleIds.has(article.id),
    );
    if (survivors.length) {
      problems.push(
        `Category "${slug}" is not canonical but is still referenced by ${survivors.length} ` +
          `article(s) that this plan keeps. \`Article.category\` is onDelete: Restrict, so the ` +
          `delete would fail mid-transaction. Repoint those articles first.`,
      );
      continue;
    }
    records.push({
      model: 'Category',
      action: 'delete',
      naturalKey: slug,
      id: category.id,
      label: englishOf(category.translations)?.name ?? slug,
      fields: [],
    });
  }

  for (const [slug, tag] of [...tagBySlug].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (canonicalTagSlugs.has(slug)) continue;
    records.push({
      model: 'Tag',
      action: 'delete',
      naturalKey: slug,
      id: tag.id,
      label: englishOf(tag.translations)?.name ?? slug,
      fields: [],
    });
  }

  // ---- SiteSettings --------------------------------------------------------------------------
  const dbSettings = await db.siteSettings.findMany({
    select: {
      id: true,
      profileLinks: true,
      careerStartYear: true,
      careerStartMonth: true,
      professionalEmail: true,
      contactEmail: true,
      contactPhone: true,
      whatsappPhone: true,
      translations: {
        select: {
          id: true,
          locale: true,
          siteName: true,
          tagline: true,
          availabilityStatus: true,
          defaultMetaTitle: true,
          defaultMetaDescription: true,
          aboutBio: true,
          engineeringPhilosophy: true,
          currentFocus: true,
        },
      },
    },
  });
  if (dbSettings.length > 1)
    problems.push(
      `SiteSettings is a singleton but ${dbSettings.length} rows exist. Refusing rather than ` +
        `choosing one.`,
    );

  const settings = dbSettings[0];
  const settingsFields = diffFields(
    GOVERNED_SETTINGS_SCALARS.map(
      (field) =>
        [
          field,
          settings?.[field] ?? undefined,
          SETTINGS_SCALARS[field],
        ] as const,
    ),
  );
  records.push({
    model: 'SiteSettings',
    action: !settings
      ? 'create'
      : settingsFields.length
        ? 'update'
        : 'unchanged',
    naturalKey: 'singleton',
    ...(settings ? { id: settings.id } : {}),
    label: 'SiteSettings',
    fields: settingsFields,
  });

  for (const translation of SETTINGS_TRANSLATIONS) {
    const existing = settings?.translations.find(
      (row) => row.locale === translation.locale,
    );
    const fields = diffFields(
      GOVERNED_SETTINGS_TRANSLATION_FIELDS.map(
        (field) =>
          [
            field,
            existing ? (existing[field] ?? null) : undefined,
            translation[field],
          ] as const,
      ),
    );
    records.push({
      model: 'SiteSettingsTranslation',
      action: !existing ? 'create' : fields.length ? 'update' : 'unchanged',
      naturalKey: translation.locale,
      ...(existing ? { id: existing.id } : {}),
      label: `SiteSettings (${translation.locale})`,
      fields,
    });
  }

  // ---- Slug collisions ------------------------------------------------------------------------
  const deletedIdsFor = (model: string): ReadonlySet<string> =>
    new Set(
      records
        .filter(
          (record) => record.model === model && record.action === 'delete',
        )
        .map((record) => record.id)
        .filter((id): id is string => Boolean(id)),
    );
  const holdersOf = (
    rows: Iterable<{
      id: string;
      translations: readonly { locale: string; slug: string }[];
    }>,
  ): SlugHolder[] =>
    [...rows].map((row) => ({
      id: row.id,
      slugs: row.translations.map((translation) => ({
        locale: translation.locale,
        slug: translation.slug,
      })),
    }));

  problems.push(
    ...detectSlugCollisions([
      {
        model: 'Project',
        canonical: PROJECTS.map((project) => ({
          key: project.en.slug,
          rowId: projectBySlug.get(project.en.slug)?.id ?? null,
          slugs: [
            { locale: LOCALE_EN, slug: project.en.slug },
            { locale: LOCALE_AR, slug: project.ar.slug },
          ],
        })),
        rows: holdersOf(projectBySlug.values()),
        freedBeforeWrites: deletedIdsFor('Project'),
      },
      {
        model: 'Article',
        canonical: ARTICLES.map((article) => ({
          key: article.en.slug,
          rowId: articleBySlug.get(article.en.slug)?.id ?? null,
          slugs: [
            { locale: LOCALE_EN, slug: article.en.slug },
            { locale: LOCALE_AR, slug: article.ar.slug },
          ],
        })),
        rows: holdersOf(articleBySlug.values()),
        freedBeforeWrites: deletedIdsFor('Article'),
      },
      {
        model: 'Tag',
        canonical: TAGS.map((tag) => ({
          key: tag.en.slug,
          rowId: tagBySlug.get(tag.en.slug)?.id ?? null,
          slugs: [
            { locale: LOCALE_EN, slug: tag.en.slug },
            { locale: LOCALE_AR, slug: tag.ar.slug },
          ],
        })),
        rows: holdersOf(tagBySlug.values()),
        freedBeforeWrites: deletedIdsFor('Tag'),
      },
      {
        // Categories are deleted LAST (Article.category is Restrict), so a stale category's slugs
        // are NOT free when the canonical categories are written — hence the empty set rather than
        // this model's delete list.
        model: 'Category',
        canonical: CATEGORIES.map((category) => ({
          key: category.en.slug,
          rowId: categoryBySlug.get(category.en.slug)?.id ?? null,
          slugs: [
            { locale: LOCALE_EN, slug: category.en.slug },
            { locale: LOCALE_AR, slug: category.ar.slug },
          ],
        })),
        rows: holdersOf(categoryBySlug.values()),
        freedBeforeWrites: new Set<string>(),
      },
    ]),
  );

  // ---- Allowlist self-check ------------------------------------------------------------------
  // Belt and braces: the builder should be structurally incapable of naming a non-governed model,
  // but the plan is a data structure and this is the last point before it leaves the builder.
  for (const record of records) {
    const model: string = record.model;
    if (!isGoverned(model))
      problems.push(
        `Plan names model "${model}", which is not in the governed allowlist.`,
      );
  }

  // ---- Protected counts ----------------------------------------------------------------------
  const protectedCounts = await countProtected(db);

  const modelOrder = new Map(
    GOVERNED_MODELS.map((model, index) => [model, index]),
  );
  const sorted = [...records].sort((a, b) => {
    const byModel =
      (modelOrder.get(a.model) ?? 0) - (modelOrder.get(b.model) ?? 0);
    return byModel !== 0 ? byModel : a.naturalKey.localeCompare(b.naturalKey);
  });

  return {
    records: sorted,
    relations: relations
      .filter((relation) => relation.added.length || relation.removed.length)
      .sort(
        (a, b) =>
          a.model.localeCompare(b.model) || a.owner.localeCompare(b.owner),
      ),
    cascades: cascades.sort((a, b) => a.owner.localeCompare(b.owner)),
    protectedCounts,
    problems: [...new Set(problems)].sort(),
  };
}

/**
 * Pre/post counts for every protected model. Shared by the plan builder and the apply path so the
 * "before" and "after" sides are produced by ONE definition — two hand-written lists would drift,
 * and a model missing from the "after" list would silently stop being verified.
 *
 * Driven off `PROTECTED_MODELS` rather than a second literal, so adding a protected model to the
 * allowlist module is enough to bring it under verification.
 */
export async function countProtected(
  db: ReadOnlyDb,
): Promise<Record<string, number>> {
  const delegates: Readonly<
    Record<ProtectedModel, { count: () => Promise<number> }>
  > = {
    User: db.user,
    Role: db.role,
    RolePermission: db.rolePermission,
    RefreshToken: db.refreshToken,
    ContactMessage: db.contactMessage,
    MediaAsset: db.mediaAsset,
    MediaAssetAlt: db.mediaAssetAlt,
    MediaAssetVariant: db.mediaAssetVariant,
    Testimonial: db.testimonial,
    TestimonialTranslation: db.testimonialTranslation,
    PageSeo: db.pageSeo,
    SlugRedirect: db.slugRedirect,
    Locale: db.locale,
  };
  const counts: Record<string, number> = {};
  for (const model of PROTECTED_MODELS)
    counts[model] = await delegates[model].count();
  return counts;
}
