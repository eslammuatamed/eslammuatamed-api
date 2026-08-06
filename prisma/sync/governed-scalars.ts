// The governed BASE scalars of each content model — ONE definition, consumed by both sides.
//
// `build-plan.ts` diffs these and `apply-plan.ts` writes them. Two hand-written lists would be
// free to drift, and drift is silent in both directions: a field written but never diffed mutates
// the row on every run while the report says `unchanged`; a field diffed but never written is
// reported as an update forever, so the zero-change second run becomes unreachable.
//
// `GovernedSettingsData` in `apply-plan.ts` solves the same problem for `SiteSettings` with a
// mapped type. These functions are the better tool for the content models, because there is no
// second list to keep in step at all — the builder diffs `Object.entries(...)` of the very object
// apply passes to Prisma.
import type { ArticleSeed } from '../content/canonical/articles';
import type { ExperienceSeed } from '../content/canonical/experiences';
import type { ProjectSeed } from '../content/canonical/projects';

/**
 * `isPublished` is a literal `true` rather than a field of the dataset: canonical content is
 * public by definition, and the synchronization asserts that rather than carrying a flag that
 * could be set to false in a data file and quietly unpublish a case study.
 */
export function projectScalars(project: ProjectSeed) {
  return {
    featured: project.featured,
    isPublished: true,
    order: project.order,
    year: project.year,
    liveUrl: project.liveUrl,
    repoUrl: project.repoUrl,
  };
}

export function experienceScalars(experience: ExperienceSeed) {
  return {
    startDate: experience.startDate,
    endDate: experience.endDate,
    isCurrent: experience.isCurrent,
    employmentType: experience.employmentType,
    order: experience.order,
  };
}

/**
 * `categoryId` is deliberately absent: it is a foreign key that can only be resolved once the
 * category's row id is known, which differs between the read side (a slug the builder reports) and
 * the write side (an id apply resolves). It is diffed and written explicitly, under the name
 * `category`, in both files.
 */
export function articleScalars(article: ArticleSeed) {
  return {
    status: 'PUBLISHED' as const,
    publishAt: article.publishAt,
  };
}
