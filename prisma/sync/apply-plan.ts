// Apply path for the canonical content synchronization (doc 09 §6.2, D09-21).
//
// Consumes the plan produced by `buildPlan` — the same function the dry-run calls — validates it
// against the governed allowlist, and applies it inside ONE interactive transaction so a failure
// rolls the entire run back rather than leaving content half-converged.
//
// There is deliberately no `--force`, no `skipValidation`, and no environment variable that changes
// what this does. A flag that bypasses the safety check is a flag that will be used in a hurry.
import { Prisma, PrismaClient } from '@prisma/client';
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
  GOVERNED_SETTINGS_SCALARS,
  isCascadeOnly,
  isGoverned,
} from './allowlist';
import {
  countProtected,
  experienceKey,
  LOCALE_AR,
  LOCALE_EN,
} from './build-plan';
import {
  articleScalars,
  experienceScalars,
  projectScalars,
} from './governed-scalars';
import type { Plan, RecordChange } from './types';

/** Prisma's interactive-transaction client: the full client minus the transaction controls. */
type Tx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * A `RepeatableRead` transaction aborts with Prisma `P2034` when a concurrent session updates a row
 * this run also touches. It is the cost of the isolation level the protected-data guard requires,
 * and it fails safe **for this run**: the transaction rolled back in full, so none of the
 * synchronization's writes survive.
 *
 * **It does NOT mean the database is unchanged.** The conflict happened precisely *because* another
 * session committed a write, so governed content may now differ from the plan the operator
 * reviewed. Saying "the database is exactly as it was" would be a false guarantee at the one moment
 * an operator most needs an accurate one — mid-release, deciding whether to investigate. The
 * message therefore scopes its claim to this run's writes and says plainly that something else
 * changed.
 *
 * It is surfaced as its own error because the correct response is specific and non-obvious: re-run
 * the dry-run, *read it again*, and only then apply. Retrying is safe in the sense that matters —
 * the tool is idempotent and converges on the canonical dataset, the property the zero-change
 * second run proves — but the new plan may legitimately differ from the reviewed one, which is why
 * it is never retried automatically. Without this, the CLI would print a raw Prisma stack trace
 * during a release and leave the operator guessing whether anything was half-applied.
 */
export class TransactionConflictError extends Error {
  constructor(cause: unknown) {
    super(
      'The synchronization was rolled back: another session wrote to a row this run also ' +
        'needed (transaction conflict).\n' +
        '\n' +
        "NONE OF THIS RUN'S CHANGES WERE APPLIED — its transaction rolled back in full.\n" +
        '\n' +
        'This does NOT mean the database is unchanged. The conflict happened BECAUSE another ' +
        'session committed a write, so governed content may now differ from the plan you ' +
        'reviewed.\n' +
        '\n' +
        'Re-run `npm run content:sync:plan` and read the new plan before applying. Retrying is ' +
        'safe — the synchronization is idempotent and converges on the canonical dataset — but ' +
        'the new plan may legitimately differ from the one you just reviewed, which is why it is ' +
        'not retried automatically.',
    );
    this.name = 'TransactionConflictError';
    this.cause = cause;
  }
}

/**
 * Prisma raises `P2034` for a write conflict or deadlock; the underlying Postgres SQLSTATEs are
 * `40001` (serialization failure) and `40P01` (deadlock detected).
 *
 * The string fallbacks are deliberately narrow. An earlier version accepted a bare
 * `message.includes('40001')`, which would classify ANY error whose text happened to contain those
 * five digits — an id, a byte count, a line from governed article content — as a transaction
 * conflict. The consequence is not a mislabel but a false promise: the operator would be told the
 * specific story "another session wrote to a row this run needed" and that **retrying is safe**,
 * about an error that might be neither. That is the same class of defect as the message this
 * function feeds, so it is matched on a code-shaped context rather than on a loose substring.
 */
export function isTransactionConflict(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError)
    return error.code === 'P2034';

  const message = error instanceof Error ? error.message : String(error);
  return (
    /could not serialize access/i.test(message) ||
    /deadlock detected/i.test(message) ||
    // Only where the digits appear AS a SQLSTATE/code, never as incidental text.
    /(?:sqlstate|code|error)\W{0,3}\b(?:40001|40P01)\b/i.test(message)
  );
}

export class PlanRejectedError extends Error {
  constructor(public readonly reasons: readonly string[]) {
    super(
      `Refusing to apply the plan:\n${reasons.map((reason) => `  - ${reason}`).join('\n')}`,
    );
    this.name = 'PlanRejectedError';
  }
}

/**
 * The gate every apply must pass. Kept separate from `applyPlan` so it is directly testable and so
 * there is exactly one place a reviewer has to read to know what cannot happen.
 */
export function validatePlan(plan: Plan): void {
  const reasons: string[] = [...plan.problems];

  for (const record of plan.records) {
    // Widened to `string` on purpose. `RecordChange.model` is TYPED as `GovernedModel`, which makes
    // the negative branch `never` to the compiler — but a plan is a data structure that can arrive
    // deserialized from `--json`, and a type is erased at runtime. The check must therefore run
    // against the value, not against the claim the type makes about it.
    const model: string = record.model;
    if (!isGoverned(model))
      reasons.push(
        `Model "${model}" is not in the governed allowlist (doc 09 §6.1).`,
      );
    else if (isCascadeOnly(model))
      reasons.push(
        `Model "${model}" is cascade-only and must never be written directly.`,
      );
    if (record.action !== 'create' && !record.id)
      reasons.push(
        `${record.model} "${record.naturalKey}" is planned as "${record.action}" but carries no row id.`,
      );
  }
  for (const relation of plan.relations) {
    const model: string = relation.model;
    if (!isGoverned(model))
      reasons.push(
        `Relation model "${model}" is not in the governed allowlist (doc 09 §6.1).`,
      );
  }
  for (const cascade of plan.cascades)
    if (!isCascadeOnly(cascade.model))
      reasons.push(
        `"${cascade.model}" is disclosed as a cascade but is not a cascade-only model.`,
      );

  // The singleton must be named exactly once. Without this, a hand-edited `--json` plan that simply
  // omitted the record would reach the create branch and produce a SECOND SiteSettings row —
  // falsifying doc 09 §6.1's "never created twice". The builder always emits it, so this is only
  // reachable via a malformed plan; the guarantee is cheap to make real rather than to qualify.
  const settingsRecords = plan.records.filter(
    (record) => record.model === 'SiteSettings',
  );
  if (settingsRecords.length !== 1)
    reasons.push(
      `A plan must name the SiteSettings singleton exactly once; this one names it ` +
        `${settingsRecords.length} time(s). Refusing rather than risking a second settings row.`,
    );

  if (reasons.length) throw new PlanRejectedError([...new Set(reasons)]);
}

/**
 * Throws when any protected model's row count moved. Extracted so it is directly testable: as an
 * inline block inside the transaction it had no coverage at all — deleting it left the entire
 * suite green, which is exactly the "verified, not asserted" claim being asserted by nobody.
 */
export function assertProtectedCountsUnchanged(
  before: Readonly<Record<string, number>>,
  after: Readonly<Record<string, number>>,
): void {
  const drifted = Object.entries(before).filter(
    ([model, count]) => after[model] !== count,
  );
  if (drifted.length)
    throw new Error(
      `Operational record counts changed during synchronization: ` +
        drifted
          .map(([model, count]) => `${model} ${count} → ${after[model]}`)
          .join(', ') +
        `. This must never happen; the transaction is rolled back.`,
    );
}

export interface GuardedRun<T> {
  readonly result: T;
  readonly protectedCountsBefore: Readonly<Record<string, number>>;
  readonly protectedCountsAfter: Readonly<Record<string, number>>;
}

/**
 * Runs `work` in one transaction that is bracketed by protected-model counts.
 *
 * Extracted rather than inlined because the guarantee has to be TESTABLE. As an inline block it
 * could only be exercised by a run that actually breached the allowlist — which the design makes
 * impossible — so nothing proved the wiring worked at all: not that the counts bracket the work,
 * not that a breach rolls back, and not that the isolation level is really applied. Those three
 * are now covered by `content-sync.e2e-spec.ts` against a real database, using a `work` that
 * deliberately deletes a protected row.
 *
 * **REPEATABLE READ is load-bearing, not a precaution.** Both counts must come from ONE snapshot.
 * Under READ COMMITTED the second read would observe commits made by other sessions, so an admin
 * session rotating a refresh token during a two-minute run would fail a completely correct run.
 * With one snapshot, concurrent commits are invisible while this transaction's OWN writes remain
 * visible to it — so a difference between the two counts can only have been caused by this run,
 * which is exactly the thing worth failing on.
 */
export async function runProtectedTransaction<T>(
  prisma: PrismaClient,
  work: (tx: Tx) => Promise<T>,
): Promise<GuardedRun<T>> {
  let protectedCountsBefore: Record<string, number> = {};
  let protectedCountsAfter: Record<string, number> = {};

  const run = async () =>
    prisma.$transaction(
      async (tx: Tx) => {
        protectedCountsBefore = await countProtected(tx);
        const value = await work(tx);
        protectedCountsAfter = await countProtected(tx);
        // Inside the transaction, so a breach ROLLS BACK. The previous version compared against
        // counts read when the plan was built and ran after commit — it could report a breach but
        // never prevent one.
        assertProtectedCountsUnchanged(
          protectedCountsBefore,
          protectedCountsAfter,
        );
        return value;
      },
      {
        timeout: 120_000,
        maxWait: 20_000,
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );

  let result: T;
  try {
    result = await run();
  } catch (error) {
    // Deliberately NOT retried here. A conflict means the database moved under this plan, and the
    // plan is a snapshot of a comparison — re-applying it blind could act on stale premises. The
    // operator re-runs the dry-run, sees what is now true, and decides.
    if (isTransactionConflict(error)) throw new TransactionConflictError(error);
    throw error;
  }

  return { result, protectedCountsBefore, protectedCountsAfter };
}

const acting = (plan: Plan, model: string, action: RecordChange['action']) =>
  plan.records.filter(
    (record) => record.model === model && record.action === action,
  );

export interface ApplyResult {
  readonly applied: {
    readonly creates: number;
    readonly updates: number;
    readonly deletes: number;
    readonly hides: number;
    readonly relationAdditions: number;
    readonly relationRemovals: number;
  };
  readonly protectedCountsBefore: Readonly<Record<string, number>>;
  readonly protectedCountsAfter: Readonly<Record<string, number>>;
}

export async function applyPlan(
  prisma: PrismaClient,
  plan: Plan,
): Promise<ApplyResult> {
  validatePlan(plan);

  const skillByCanonicalSlug = new Map(
    SKILLS.map((skill) => [skill.slug, skill]),
  );
  const categoryByCanonicalSlug = new Map(
    CATEGORIES.map((category) => [category.en.slug, category]),
  );
  const tagByCanonicalSlug = new Map(TAGS.map((tag) => [tag.en.slug, tag]));
  const projectByCanonicalSlug = new Map(
    PROJECTS.map((project) => [project.en.slug, project]),
  );
  const articleByCanonicalSlug = new Map(
    ARTICLES.map((article) => [article.en.slug, article]),
  );
  const experienceByCanonicalKey = new Map(
    EXPERIENCES.map((experience) => [
      experienceKey(experience.en.company, experience.en.role),
      experience,
    ]),
  );

  const guarded = await runProtectedTransaction(prisma, async (tx: Tx) => {
    // ---- 0. Stale rows first, so freed slugs can be reused ----------------------------------
    // Deletes precede creates and updates because every translation table carries
    // `@@unique([locale, slug])` and Postgres does not defer it. The ordinary case of an English
    // slug rename — where the Arabic slug stays put — emits one create plus one delete; running
    // the create first collides with the stale row that still holds that Arabic slug, and the
    // whole transaction aborts on a raw 23505 AFTER the dry-run called the plan applicable.
    // Fail-safe, but it breaks the promise that the preview predicts the apply, and propagating
    // slug edits is a large part of what this tool is for.
    //
    // FK-safe order is preserved: articles carry the references, so they go before the tags they
    // link. Categories are the exception and run last (step 5) — see there.
    // Every id came from the plan, so each delete is scoped by natural key; there is no
    // `deleteMany` over a whole table anywhere in this file.
    for (const record of acting(plan, 'Article', 'delete'))
      if (record.id) await tx.article.delete({ where: { id: record.id } });
    for (const record of acting(plan, 'Project', 'delete'))
      if (record.id) await tx.project.delete({ where: { id: record.id } });
    for (const record of acting(plan, 'Experience', 'delete'))
      if (record.id) await tx.experience.delete({ where: { id: record.id } });
    for (const record of acting(plan, 'Tag', 'delete'))
      if (record.id) await tx.tag.delete({ where: { id: record.id } });

    // ---- 1. Referenced entities first, so later FKs resolve ---------------------------------
    const skillIdBySlug = new Map<string, string>();
    for (const record of acting(plan, 'Skill', 'create')) {
      const skill = mustFind(
        skillByCanonicalSlug.get(record.naturalKey),
        'Skill',
        record.naturalKey,
      );
      const created = await tx.skill.create({
        data: {
          slug: skill.slug,
          group: skill.group,
          order: skill.order,
          brandColor: skill.brandColor,
          isPublic: skill.isPublic ?? true,
          translations: {
            create: [
              { locale: LOCALE_EN, label: skill.labelEn },
              { locale: LOCALE_AR, label: skill.labelAr },
            ],
          },
        },
        select: { id: true },
      });
      skillIdBySlug.set(skill.slug, created.id);
    }
    for (const record of acting(plan, 'Skill', 'update')) {
      const skill = mustFind(
        skillByCanonicalSlug.get(record.naturalKey),
        'Skill',
        record.naturalKey,
      );
      if (!record.id) continue;
      // `slug` is absent by design: it is the identity this row was found by and the public
      // filter URL. Labels are the editable half.
      await tx.skill.update({
        where: { id: record.id },
        data: {
          group: skill.group,
          order: skill.order,
          brandColor: skill.brandColor,
          isPublic: skill.isPublic ?? true,
        },
      });
      for (const [locale, label] of [
        [LOCALE_EN, skill.labelEn],
        [LOCALE_AR, skill.labelAr],
      ] as const)
        await tx.skillTranslation.upsert({
          where: { skillId_locale: { skillId: record.id, locale } },
          create: { skillId: record.id, locale, label },
          update: { label },
        });
    }
    // Hidden, never deleted — the id and every relation survive (doc 09 §6.4).
    for (const record of acting(plan, 'Skill', 'hide'))
      if (record.id)
        await tx.skill.update({
          where: { id: record.id },
          data: { isPublic: false },
        });

    for (const record of plan.records)
      if (record.model === 'Skill' && record.id)
        skillIdBySlug.set(record.naturalKey, record.id);

    const categoryIdBySlug = new Map<string, string>();
    for (const record of acting(plan, 'Category', 'create')) {
      const category = mustFind(
        categoryByCanonicalSlug.get(record.naturalKey),
        'Category',
        record.naturalKey,
      );
      const created = await tx.category.create({
        data: {
          translations: {
            create: [
              {
                locale: LOCALE_EN,
                name: category.en.name,
                slug: category.en.slug,
              },
              {
                locale: LOCALE_AR,
                name: category.ar.name,
                slug: category.ar.slug,
              },
            ],
          },
        },
        select: { id: true },
      });
      categoryIdBySlug.set(category.en.slug, created.id);
    }
    for (const record of acting(plan, 'Category', 'update')) {
      const category = mustFind(
        categoryByCanonicalSlug.get(record.naturalKey),
        'Category',
        record.naturalKey,
      );
      if (!record.id) continue;
      for (const [locale, content] of [
        [LOCALE_EN, category.en],
        [LOCALE_AR, category.ar],
      ] as const)
        await tx.categoryTranslation.upsert({
          where: {
            categoryId_locale: { categoryId: record.id, locale },
          },
          create: {
            categoryId: record.id,
            locale,
            name: content.name,
            slug: content.slug,
          },
          update: { name: content.name, slug: content.slug },
        });
    }
    for (const record of plan.records)
      if (record.model === 'Category' && record.id)
        categoryIdBySlug.set(record.naturalKey, record.id);

    const tagIdBySlug = new Map<string, string>();
    for (const record of acting(plan, 'Tag', 'create')) {
      const tag = mustFind(
        tagByCanonicalSlug.get(record.naturalKey),
        'Tag',
        record.naturalKey,
      );
      const created = await tx.tag.create({
        data: {
          translations: {
            create: [
              { locale: LOCALE_EN, name: tag.en.name, slug: tag.en.slug },
              { locale: LOCALE_AR, name: tag.ar.name, slug: tag.ar.slug },
            ],
          },
        },
        select: { id: true },
      });
      tagIdBySlug.set(tag.en.slug, created.id);
    }
    for (const record of acting(plan, 'Tag', 'update')) {
      const tag = mustFind(
        tagByCanonicalSlug.get(record.naturalKey),
        'Tag',
        record.naturalKey,
      );
      if (!record.id) continue;
      for (const [locale, content] of [
        [LOCALE_EN, tag.en],
        [LOCALE_AR, tag.ar],
      ] as const)
        await tx.tagTranslation.upsert({
          where: { tagId_locale: { tagId: record.id, locale } },
          create: {
            tagId: record.id,
            locale,
            name: content.name,
            slug: content.slug,
          },
          update: { name: content.name, slug: content.slug },
        });
    }
    for (const record of plan.records)
      if (record.model === 'Tag' && record.id)
        tagIdBySlug.set(record.naturalKey, record.id);

    // ---- 2. Experiences ---------------------------------------------------------------------
    const experienceIdByKey = new Map<string, string>();
    for (const record of acting(plan, 'Experience', 'create')) {
      const experience = mustFind(
        experienceByCanonicalKey.get(record.naturalKey),
        'Experience',
        record.naturalKey,
      );
      const created = await tx.experience.create({
        data: {
          ...experienceScalars(experience),
          translations: {
            create: [
              { locale: LOCALE_EN, ...experience.en },
              { locale: LOCALE_AR, ...experience.ar },
            ],
          },
          technologies: {
            create: experience.techKeys.map((slug) => ({
              skillId: mustResolve(skillIdBySlug, slug, 'skill'),
            })),
          },
        },
        select: { id: true },
      });
      experienceIdByKey.set(record.naturalKey, created.id);
    }
    for (const record of acting(plan, 'Experience', 'update')) {
      const experience = mustFind(
        experienceByCanonicalKey.get(record.naturalKey),
        'Experience',
        record.naturalKey,
      );
      if (!record.id) continue;
      await tx.experience.update({
        where: { id: record.id },
        data: experienceScalars(experience),
      });
      for (const [locale, content] of [
        [LOCALE_EN, experience.en],
        [LOCALE_AR, experience.ar],
      ] as const)
        await tx.experienceTranslation.upsert({
          where: {
            experienceId_locale: { experienceId: record.id, locale },
          },
          create: { experienceId: record.id, locale, ...content },
          update: { ...content },
        });
    }
    for (const record of plan.records)
      if (record.model === 'Experience' && record.id)
        experienceIdByKey.set(record.naturalKey, record.id);

    // ---- 3. Projects ------------------------------------------------------------------------
    const projectIdBySlug = new Map<string, string>();
    for (const record of acting(plan, 'Project', 'create')) {
      const project = mustFind(
        projectByCanonicalSlug.get(record.naturalKey),
        'Project',
        record.naturalKey,
      );
      const created = await tx.project.create({
        data: {
          ...projectScalars(project),
          translations: {
            create: [
              { locale: LOCALE_EN, ...project.en },
              { locale: LOCALE_AR, ...project.ar },
            ],
          },
          technologies: {
            create: project.techKeys.map((slug) => ({
              skillId: mustResolve(skillIdBySlug, slug, 'skill'),
            })),
          },
        },
        select: { id: true },
      });
      projectIdBySlug.set(record.naturalKey, created.id);
    }
    for (const record of acting(plan, 'Project', 'update')) {
      const project = mustFind(
        projectByCanonicalSlug.get(record.naturalKey),
        'Project',
        record.naturalKey,
      );
      if (!record.id) continue;
      await tx.project.update({
        where: { id: record.id },
        data: projectScalars(project),
      });
      for (const [locale, content] of [
        [LOCALE_EN, project.en],
        [LOCALE_AR, project.ar],
      ] as const)
        await tx.projectTranslation.upsert({
          where: { projectId_locale: { projectId: record.id, locale } },
          create: { projectId: record.id, locale, ...content },
          update: { ...content },
        });
    }
    for (const record of plan.records)
      if (record.model === 'Project' && record.id)
        projectIdBySlug.set(record.naturalKey, record.id);

    // ---- 4. Articles ------------------------------------------------------------------------
    const articleIdBySlug = new Map<string, string>();
    for (const record of acting(plan, 'Article', 'create')) {
      const article = mustFind(
        articleByCanonicalSlug.get(record.naturalKey),
        'Article',
        record.naturalKey,
      );
      const created = await tx.article.create({
        data: {
          ...articleScalars(article),
          categoryId: mustResolve(
            categoryIdBySlug,
            article.categorySlug,
            'category',
          ),
          translations: {
            create: [
              { locale: LOCALE_EN, ...article.en },
              { locale: LOCALE_AR, ...article.ar },
            ],
          },
          tags: {
            create: article.tagKeys.map((key) => ({
              tagId: mustResolve(tagIdBySlug, canonicalTagSlug(key), 'tag'),
            })),
          },
        },
        select: { id: true },
      });
      articleIdBySlug.set(record.naturalKey, created.id);
    }
    for (const record of acting(plan, 'Article', 'update')) {
      const article = mustFind(
        articleByCanonicalSlug.get(record.naturalKey),
        'Article',
        record.naturalKey,
      );
      if (!record.id) continue;
      await tx.article.update({
        where: { id: record.id },
        data: {
          ...articleScalars(article),
          categoryId: mustResolve(
            categoryIdBySlug,
            article.categorySlug,
            'category',
          ),
        },
      });
      for (const [locale, content] of [
        [LOCALE_EN, article.en],
        [LOCALE_AR, article.ar],
      ] as const)
        await tx.articleTranslation.upsert({
          where: { articleId_locale: { articleId: record.id, locale } },
          create: { articleId: record.id, locale, ...content },
          update: { ...content },
        });
    }
    for (const record of plan.records)
      if (record.model === 'Article' && record.id)
        articleIdBySlug.set(record.naturalKey, record.id);

    // ---- 4b. Relations -----------------------------------------------------------------------
    // Driven off `plan.relations`, NOT off whether the owning record also had a scalar change.
    // A project whose ONLY drift is its technology set has an `unchanged` record, so replacing
    // relations inside the update branch would leave that drift forever — and the second run
    // would never reach zero changes.
    for (const relation of plan.relations) {
      if (relation.model === 'ProjectTechnology') {
        const project = projectByCanonicalSlug.get(relation.owner);
        const projectId = projectIdBySlug.get(relation.owner);
        if (!project || !projectId) continue;
        await replaceProjectTechnologies(
          tx,
          projectId,
          project.techKeys.map((slug) =>
            mustResolve(skillIdBySlug, slug, 'skill'),
          ),
        );
      } else if (relation.model === 'ExperienceTechnology') {
        const experience = experienceByCanonicalKey.get(relation.owner);
        const experienceId = experienceIdByKey.get(relation.owner);
        if (!experience || !experienceId) continue;
        await replaceExperienceTechnologies(
          tx,
          experienceId,
          experience.techKeys.map((slug) =>
            mustResolve(skillIdBySlug, slug, 'skill'),
          ),
        );
      } else if (relation.model === 'ArticleTag') {
        const article = articleByCanonicalSlug.get(relation.owner);
        const articleId = articleIdBySlug.get(relation.owner);
        if (!article || !articleId) continue;
        await replaceArticleTags(
          tx,
          articleId,
          article.tagKeys.map((key) =>
            mustResolve(tagIdBySlug, canonicalTagSlug(key), 'tag'),
          ),
        );
      }
    }

    // ---- 5. Stale categories, last ----------------------------------------------------------
    // `Article.category` is onDelete: Restrict, so a stale category can only go once every
    // surviving article has been repointed — which step 4 just did. This is the one delete that
    // cannot move earlier; the rest ran in step 0 (see there for why).
    for (const record of acting(plan, 'Category', 'delete'))
      if (record.id) await tx.category.delete({ where: { id: record.id } });

    // ---- 6. SiteSettings --------------------------------------------------------------------
    const settingsRecord = plan.records.find(
      (record) => record.model === 'SiteSettings',
    );
    let settingsId = settingsRecord?.id;
    if (!settingsId) {
      const created = await tx.siteSettings.create({
        // Only governed scalars. `analyticsEnabled` was here and is operator-owned
        // (doc 09 §6.3) — it equalled the schema default, so it changed nothing, but writing an
        // operator-owned column at all contradicts the guarantee.
        data: toSettingsData(),
        select: { id: true },
      });
      settingsId = created.id;
    } else if (settingsRecord?.action === 'update') {
      await tx.siteSettings.update({
        where: { id: settingsId },
        data: toSettingsData(),
      });
    }
    // Re-asserted on every run, create and update alike — this is the correction to the base
    // seed's create-only treatment of siteName / availabilityStatus / the default meta strings
    // (doc 09 §6.3).
    for (const translation of SETTINGS_TRANSLATIONS) {
      const { locale, ...governed } = translation;
      // Gated on the plan's action. An unconditional upsert rewrote both rows on every run that
      // changed anything at all, and `SiteSettingsTranslation.updatedAt` is `@updatedAt` — so a
      // row the report listed `unchanged` still had its timestamp moved. The write must match
      // what the report promised, or the report is not a preview.
      const planned = plan.records.find(
        (record) =>
          record.model === 'SiteSettingsTranslation' &&
          record.naturalKey === locale,
      );
      if (planned && planned.action === 'unchanged') continue;
      await tx.siteSettingsTranslation.upsert({
        where: {
          siteSettingsId_locale: { siteSettingsId: settingsId, locale },
        },
        create: { siteSettingsId: settingsId, locale, ...governed },
        update: { ...governed },
      });
    }
  });

  return {
    applied: {
      creates: plan.records.filter((r) => r.action === 'create').length,
      updates: plan.records.filter((r) => r.action === 'update').length,
      deletes: plan.records.filter((r) => r.action === 'delete').length,
      hides: plan.records.filter((r) => r.action === 'hide').length,
      relationAdditions: plan.relations.reduce(
        (total, relation) => total + relation.added.length,
        0,
      ),
      relationRemovals: plan.relations.reduce(
        (total, relation) => total + relation.removed.length,
        0,
      ),
    },
    protectedCountsBefore: guarded.protectedCountsBefore,
    protectedCountsAfter: guarded.protectedCountsAfter,
  };
}

function canonicalTagSlug(key: string): string {
  const tag = TAGS.find((candidate) => candidate.key === key);
  if (!tag)
    throw new Error(`Canonical dataset references unknown tag key "${key}".`);
  return tag.en.slug;
}

/**
 * Typed so the compiler enforces that this object holds EXACTLY the governed scalars — every one
 * present (missing key = error) and no others (excess property check on the literal).
 *
 * This matters more than it looks. `build-plan.ts` diffs `GOVERNED_SETTINGS_SCALARS`; if this
 * hand-written object drifted from that list, one of two silent failures would follow: a field the
 * builder diffs but apply never writes would be reported as an update on EVERY run and the
 * zero-change second run would become unreachable, or a field apply writes but the builder never
 * diffs would mutate the row on every run while the report said "unchanged". Coupling the two by
 * construction removes the failure mode instead of testing for it.
 */
type GovernedSettingsData = {
  [K in (typeof GOVERNED_SETTINGS_SCALARS)[number]]: K extends 'profileLinks'
    ? Prisma.InputJsonValue
    : (typeof SETTINGS_SCALARS)[K];
};

function toSettingsData(): GovernedSettingsData {
  return {
    // Structurally cloned into a plain JSON value: `profileLinks` is a JSONB column, and the
    // canonical constant's interface type is not a Prisma `InputJsonValue`.
    profileLinks: SETTINGS_SCALARS.profileLinks.map((link) => ({
      label: link.label,
      url: link.url,
      icon: link.icon,
    })),
    careerStartYear: SETTINGS_SCALARS.careerStartYear,
    careerStartMonth: SETTINGS_SCALARS.careerStartMonth,
    professionalEmail: SETTINGS_SCALARS.professionalEmail,
    contactEmail: SETTINGS_SCALARS.contactEmail,
    contactPhone: SETTINGS_SCALARS.contactPhone,
    whatsappPhone: SETTINGS_SCALARS.whatsappPhone,
  };
}

/**
 * A canonical entry named by the plan must exist when apply runs. Previously each branch did
 * `continue` on a miss, so a Project or Article the report listed as created could silently not be
 * created while the CLI still printed it as applied. Cannot happen today — plan and apply share one
 * in-process dataset — but a tool whose output goes on a release record must never report intent
 * as outcome, and inside a transaction a throw is free: the whole run rolls back.
 */
function mustFind<T>(value: T | undefined, model: string, key: string): T {
  if (value === undefined)
    throw new Error(
      `Plan names ${model} "${key}", which is not in the canonical dataset. The transaction is ` +
        `rolled back.`,
    );
  return value;
}

function mustResolve(
  map: ReadonlyMap<string, string>,
  key: string,
  kind: string,
): string {
  const id = map.get(key);
  if (!id)
    throw new Error(
      `Cannot resolve ${kind} "${key}" while applying the plan. The transaction is rolled back.`,
    );
  return id;
}

/**
 * Relation replacement is remove-then-add rather than delete-all-then-recreate: rows that should
 * stay are left alone, so the operation is minimal and the report's "added"/"removed" lists are
 * literally what happens.
 */
async function replaceProjectTechnologies(
  tx: Tx,
  projectId: string,
  wantedSkillIds: readonly string[],
): Promise<void> {
  const current = await tx.projectTechnology.findMany({
    where: { projectId },
    select: { skillId: true },
  });
  const wanted = new Set(wantedSkillIds);
  for (const link of current)
    if (!wanted.has(link.skillId))
      await tx.projectTechnology.delete({
        where: { projectId_skillId: { projectId, skillId: link.skillId } },
      });
  const existing = new Set(current.map((link) => link.skillId));
  for (const skillId of wantedSkillIds)
    if (!existing.has(skillId))
      await tx.projectTechnology.create({ data: { projectId, skillId } });
}

async function replaceExperienceTechnologies(
  tx: Tx,
  experienceId: string,
  wantedSkillIds: readonly string[],
): Promise<void> {
  const current = await tx.experienceTechnology.findMany({
    where: { experienceId },
    select: { skillId: true },
  });
  const wanted = new Set(wantedSkillIds);
  for (const link of current)
    if (!wanted.has(link.skillId))
      await tx.experienceTechnology.delete({
        where: {
          experienceId_skillId: { experienceId, skillId: link.skillId },
        },
      });
  const existing = new Set(current.map((link) => link.skillId));
  for (const skillId of wantedSkillIds)
    if (!existing.has(skillId))
      await tx.experienceTechnology.create({
        data: { experienceId, skillId },
      });
}

async function replaceArticleTags(
  tx: Tx,
  articleId: string,
  wantedTagIds: readonly string[],
): Promise<void> {
  const current = await tx.articleTag.findMany({
    where: { articleId },
    select: { tagId: true },
  });
  const wanted = new Set(wantedTagIds);
  for (const link of current)
    if (!wanted.has(link.tagId))
      await tx.articleTag.delete({
        where: { articleId_tagId: { articleId, tagId: link.tagId } },
      });
  const existing = new Set(current.map((link) => link.tagId));
  for (const tagId of wantedTagIds)
    if (!existing.has(tagId))
      await tx.articleTag.create({ data: { articleId, tagId } });
}
