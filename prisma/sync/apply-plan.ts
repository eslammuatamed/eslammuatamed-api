// Apply path for the canonical content synchronization (doc 09 §6.2, D09-21).
//
// Consumes the plan produced by `buildPlan` — the same function the dry-run calls — validates it
// against the governed allowlist, and applies it inside ONE interactive transaction so a failure
// rolls the entire run back rather than leaving content half-converged.
//
// There is deliberately no `--force`, no `skipValidation`, and no environment variable that changes
// what this does. A flag that bypasses the safety check is a flag that will be used in a hurry.
import { ContentStatus, Prisma, PrismaClient } from '@prisma/client';
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
import { isCascadeOnly, isGoverned } from './allowlist';
import {
  countProtected,
  experienceKey,
  LOCALE_AR,
  LOCALE_EN,
} from './build-plan';
import type { Plan, RecordChange } from './types';

/** Prisma's interactive-transaction client: the full client minus the transaction controls. */
type Tx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

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

  if (reasons.length) throw new PlanRejectedError([...new Set(reasons)]);
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

  await prisma.$transaction(
    async (tx: Tx) => {
      // ---- 1. Referenced entities first, so later FKs resolve ---------------------------------
      const skillIdBySlug = new Map<string, string>();
      for (const record of acting(plan, 'Skill', 'create')) {
        const skill = skillByCanonicalSlug.get(record.naturalKey);
        if (!skill) continue;
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
        const skill = skillByCanonicalSlug.get(record.naturalKey);
        if (!skill || !record.id) continue;
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
        const category = categoryByCanonicalSlug.get(record.naturalKey);
        if (!category) continue;
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
        const category = categoryByCanonicalSlug.get(record.naturalKey);
        if (!category || !record.id) continue;
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
        const tag = tagByCanonicalSlug.get(record.naturalKey);
        if (!tag) continue;
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
        const tag = tagByCanonicalSlug.get(record.naturalKey);
        if (!tag || !record.id) continue;
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
        const experience = experienceByCanonicalKey.get(record.naturalKey);
        if (!experience) continue;
        const created = await tx.experience.create({
          data: {
            startDate: experience.startDate,
            endDate: experience.endDate,
            isCurrent: experience.isCurrent,
            employmentType: experience.employmentType,
            order: experience.order,
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
        const experience = experienceByCanonicalKey.get(record.naturalKey);
        if (!experience || !record.id) continue;
        await tx.experience.update({
          where: { id: record.id },
          data: {
            startDate: experience.startDate,
            endDate: experience.endDate,
            isCurrent: experience.isCurrent,
            employmentType: experience.employmentType,
            order: experience.order,
          },
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
        const project = projectByCanonicalSlug.get(record.naturalKey);
        if (!project) continue;
        const created = await tx.project.create({
          data: {
            featured: project.featured,
            isPublished: true,
            order: project.order,
            year: project.year,
            liveUrl: project.liveUrl,
            repoUrl: project.repoUrl,
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
        const project = projectByCanonicalSlug.get(record.naturalKey);
        if (!project || !record.id) continue;
        await tx.project.update({
          where: { id: record.id },
          data: {
            featured: project.featured,
            isPublished: true,
            order: project.order,
            year: project.year,
            liveUrl: project.liveUrl,
            repoUrl: project.repoUrl,
          },
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
        const article = articleByCanonicalSlug.get(record.naturalKey);
        if (!article) continue;
        const created = await tx.article.create({
          data: {
            status: ContentStatus.PUBLISHED,
            publishAt: article.publishAt,
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
        const article = articleByCanonicalSlug.get(record.naturalKey);
        if (!article || !record.id) continue;
        await tx.article.update({
          where: { id: record.id },
          data: {
            status: ContentStatus.PUBLISHED,
            publishAt: article.publishAt,
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

      // ---- 5. Scoped deletes, FK-safe order ---------------------------------------------------
      // Articles before the categories and tags they reference; projects and experiences cascade
      // into their own children only. Every id below came from the plan, so the delete is scoped by
      // natural key — there is no `deleteMany` over a whole table anywhere in this file.
      for (const record of acting(plan, 'Article', 'delete'))
        if (record.id) await tx.article.delete({ where: { id: record.id } });
      for (const record of acting(plan, 'Project', 'delete'))
        if (record.id) await tx.project.delete({ where: { id: record.id } });
      for (const record of acting(plan, 'Experience', 'delete'))
        if (record.id) await tx.experience.delete({ where: { id: record.id } });
      for (const record of acting(plan, 'Tag', 'delete'))
        if (record.id) await tx.tag.delete({ where: { id: record.id } });
      for (const record of acting(plan, 'Category', 'delete'))
        if (record.id) await tx.category.delete({ where: { id: record.id } });

      // ---- 6. SiteSettings --------------------------------------------------------------------
      const settingsRecord = plan.records.find(
        (record) => record.model === 'SiteSettings',
      );
      let settingsId = settingsRecord?.id;
      if (!settingsId) {
        const created = await tx.siteSettings.create({
          data: { analyticsEnabled: false, ...toSettingsData() },
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
        await tx.siteSettingsTranslation.upsert({
          where: {
            siteSettingsId_locale: { siteSettingsId: settingsId, locale },
          },
          create: { siteSettingsId: settingsId, locale, ...governed },
          update: { ...governed },
        });
      }
    },
    { timeout: 120_000, maxWait: 20_000 },
  );

  const protectedCountsAfter = await countProtected(prisma);
  const drifted = Object.entries(plan.protectedCounts).filter(
    ([model, before]) => protectedCountsAfter[model] !== before,
  );
  if (drifted.length)
    throw new Error(
      `Operational record counts changed during synchronization: ` +
        drifted
          .map(
            ([model, before]) =>
              `${model} ${before} → ${protectedCountsAfter[model]}`,
          )
          .join(', ') +
        `. This must never happen; investigate before running again.`,
    );

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
    protectedCountsBefore: plan.protectedCounts,
    protectedCountsAfter,
  };
}

function canonicalTagSlug(key: string): string {
  const tag = TAGS.find((candidate) => candidate.key === key);
  if (!tag)
    throw new Error(`Canonical dataset references unknown tag key "${key}".`);
  return tag.en.slug;
}

function toSettingsData() {
  return {
    // Structurally cloned into a plain JSON value: `profileLinks` is a JSONB column, and the
    // canonical constant's interface type is not a Prisma `InputJsonValue`.
    profileLinks: SETTINGS_SCALARS.profileLinks.map((link) => ({
      label: link.label,
      url: link.url,
      icon: link.icon,
    })) satisfies Prisma.InputJsonValue,
    careerStartYear: SETTINGS_SCALARS.careerStartYear,
    careerStartMonth: SETTINGS_SCALARS.careerStartMonth,
    professionalEmail: SETTINGS_SCALARS.professionalEmail,
    contactEmail: SETTINGS_SCALARS.contactEmail,
    contactPhone: SETTINGS_SCALARS.contactPhone,
    whatsappPhone: SETTINGS_SCALARS.whatsappPhone,
  };
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
