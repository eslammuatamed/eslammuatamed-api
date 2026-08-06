// A fake `ReadOnlyDb` for the plan-builder unit tests.
//
// The default state is DERIVED FROM the canonical dataset, so "a database that already matches
// canonical" is not hand-transcribed — a test for the unchanged path cannot silently drift out of
// agreement with the data it is supposed to match. Each test then mutates one thing and asserts the
// plan notices exactly that.
import { ARTICLES } from '../../content/canonical/articles';
import { CATEGORIES } from '../../content/canonical/categories';
import { EXPERIENCES } from '../../content/canonical/experiences';
import { PROJECTS } from '../../content/canonical/projects';
import {
  SETTINGS_SCALARS,
  SETTINGS_TRANSLATIONS,
} from '../../content/canonical/site-settings';
import { SKILLS } from '../../content/canonical/skills';
import { TAGS } from '../../content/canonical/tags';
import type { ReadOnlyDb } from '../read-client';

export interface FakeState {
  locales: { code: string }[];
  skills: Record<string, unknown>[];
  projects: Record<string, unknown>[];
  experiences: Record<string, unknown>[];
  categories: Record<string, unknown>[];
  tags: Record<string, unknown>[];
  articles: Record<string, unknown>[];
  siteSettings: Record<string, unknown>[];
  protectedCounts: Record<string, number>;
}

const id = (prefix: string, key: string): string => `${prefix}-${key}`;

/** A database that is already exactly canonical — the fixed point the synchronization converges to. */
export function canonicalState(): FakeState {
  const skills = SKILLS.map((skill) => ({
    id: id('skill', skill.slug),
    slug: skill.slug,
    group: skill.group,
    order: skill.order,
    brandColor: skill.brandColor,
    isPublic: skill.isPublic ?? true,
    translations: [
      { locale: 'en', label: skill.labelEn },
      { locale: 'ar', label: skill.labelAr },
    ],
  }));

  const categories = CATEGORIES.map((category) => ({
    id: id('category', category.en.slug),
    translations: [
      { locale: 'en', name: category.en.name, slug: category.en.slug },
      { locale: 'ar', name: category.ar.name, slug: category.ar.slug },
    ],
    articles: ARTICLES.filter(
      (article) => article.categorySlug === category.en.slug,
    ).map((article) => ({ id: id('article', article.en.slug) })),
  }));

  const tags = TAGS.map((tag) => ({
    id: id('tag', tag.en.slug),
    translations: [
      { locale: 'en', name: tag.en.name, slug: tag.en.slug },
      { locale: 'ar', name: tag.ar.name, slug: tag.ar.slug },
    ],
  }));

  const projects = PROJECTS.map((project) => ({
    id: id('project', project.en.slug),
    featured: project.featured,
    isPublished: true,
    order: project.order,
    year: project.year,
    liveUrl: project.liveUrl,
    repoUrl: project.repoUrl,
    translations: [
      { locale: 'en', ...project.en },
      { locale: 'ar', ...project.ar },
    ],
    technologies: project.techKeys.map((slug) => ({
      skillId: id('skill', slug),
    })),
    gallery: [] as { id: string }[],
  }));

  const experiences = EXPERIENCES.map((experience) => ({
    id: id('experience', experience.en.company),
    startDate: experience.startDate,
    endDate: experience.endDate,
    isCurrent: experience.isCurrent,
    employmentType: experience.employmentType,
    order: experience.order,
    translations: [
      { locale: 'en', ...experience.en },
      { locale: 'ar', ...experience.ar },
    ],
    technologies: experience.techKeys.map((slug) => ({
      skillId: id('skill', slug),
    })),
  }));

  const articles = ARTICLES.map((article) => ({
    id: id('article', article.en.slug),
    status: 'PUBLISHED',
    publishAt: article.publishAt,
    categoryId: id('category', article.categorySlug),
    translations: [
      { locale: 'en', ...article.en },
      { locale: 'ar', ...article.ar },
    ],
    tags: article.tagKeys.map((key) => ({
      tagId: id(
        'tag',
        TAGS.find((tag) => tag.key === key)?.en.slug ?? `missing:${key}`,
      ),
    })),
  }));

  const siteSettings = [
    {
      id: 'settings-1',
      ...SETTINGS_SCALARS,
      profileLinks: SETTINGS_SCALARS.profileLinks.map((link) => ({ ...link })),
      translations: SETTINGS_TRANSLATIONS.map((translation) => ({
        ...translation,
      })),
    },
  ];

  return {
    locales: [{ code: 'en' }, { code: 'ar' }],
    skills,
    projects,
    experiences,
    categories,
    tags,
    articles,
    siteSettings,
    protectedCounts: {
      user: 1,
      role: 1,
      rolePermission: 1,
      refreshToken: 0,
      contactMessage: 3,
      mediaAsset: 2,
      mediaAssetAlt: 0,
      mediaAssetVariant: 0,
      testimonial: 2,
      testimonialTranslation: 4,
      pageSeo: 0,
      slugRedirect: 0,
    },
  };
}

/** A database with nothing in it — locales aside, which are a precondition, not governed content. */
export function emptyState(): FakeState {
  return {
    locales: [{ code: 'en' }, { code: 'ar' }],
    skills: [],
    projects: [],
    experiences: [],
    categories: [],
    tags: [],
    articles: [],
    siteSettings: [],
    protectedCounts: canonicalState().protectedCounts,
  };
}

export function fakeDb(state: FakeState): ReadOnlyDb {
  const rows =
    (list: Record<string, unknown>[] | { code: string }[]) =>
    // The plan builder passes a `select`, which this fake ignores: the state above already carries
    // exactly the fields the builder selects, so honouring `select` would add machinery without
    // adding a guarantee. A field the builder starts selecting but the fake does not provide shows
    // up as an undefined value in an assertion, which is the failure we want.
    () =>
      Promise.resolve(list);

  const counter = (n: number) => () => Promise.resolve(n);

  const db = {
    locale: {
      findMany: rows(state.locales),
      count: counter(state.locales.length),
    },
    skill: {
      findMany: rows(state.skills),
      count: counter(state.skills.length),
    },
    project: {
      findMany: rows(state.projects),
      count: counter(state.projects.length),
    },
    experience: {
      findMany: rows(state.experiences),
      count: counter(state.experiences.length),
    },
    category: {
      findMany: rows(state.categories),
      count: counter(state.categories.length),
    },
    tag: { findMany: rows(state.tags), count: counter(state.tags.length) },
    article: {
      findMany: rows(state.articles),
      count: counter(state.articles.length),
    },
    siteSettings: {
      findMany: rows(state.siteSettings),
      count: counter(state.siteSettings.length),
    },
    user: {
      findMany: rows([]),
      count: counter(state.protectedCounts.user ?? 0),
    },
    role: {
      findMany: rows([]),
      count: counter(state.protectedCounts.role ?? 0),
    },
    rolePermission: {
      findMany: rows([]),
      count: counter(state.protectedCounts.rolePermission ?? 0),
    },
    refreshToken: {
      findMany: rows([]),
      count: counter(state.protectedCounts.refreshToken ?? 0),
    },
    contactMessage: {
      findMany: rows([]),
      count: counter(state.protectedCounts.contactMessage ?? 0),
    },
    mediaAsset: {
      findMany: rows([]),
      count: counter(state.protectedCounts.mediaAsset ?? 0),
    },
    mediaAssetAlt: {
      findMany: rows([]),
      count: counter(state.protectedCounts.mediaAssetAlt ?? 0),
    },
    mediaAssetVariant: {
      findMany: rows([]),
      count: counter(state.protectedCounts.mediaAssetVariant ?? 0),
    },
    testimonial: {
      findMany: rows([]),
      count: counter(state.protectedCounts.testimonial ?? 0),
    },
    testimonialTranslation: {
      findMany: rows([]),
      count: counter(state.protectedCounts.testimonialTranslation ?? 0),
    },
    pageSeo: {
      findMany: rows([]),
      count: counter(state.protectedCounts.pageSeo ?? 0),
    },
    slugRedirect: {
      findMany: rows([]),
      count: counter(state.protectedCounts.slugRedirect ?? 0),
    },
  };

  return db as unknown as ReadOnlyDb;
}
