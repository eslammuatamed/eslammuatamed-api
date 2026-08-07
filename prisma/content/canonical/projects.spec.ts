import { PROJECTS, type ProjectTranslationContent } from './projects';

/**
 * Guards on the canonical Projects dataset.
 *
 * The defect these exist for: `overview` shipped to Production carrying a leading `## Overview` /
 * `## نظرة عامة`, in all 4 projects × both locales. The case-study page owns the localized section
 * heading (`t('projects.sections.<key>')` in `app/pages/projects/[slug].vue`), so the field value
 * repeating it rendered the title twice.
 *
 * The contract this asserts: **the page layout owns section titles; structured Markdown fields carry
 * body content only.** That is checked here, at the source of truth, rather than patched in the
 * renderer — a renderer that stripped leading headings would also silently eat legitimate authored
 * structure, and 7 of these 8 fields already rely on nested headings working normally.
 *
 * Scope is deliberately narrow: only a heading in the FIRST position, and only when its text is one
 * of the governed section labels. A `## Rollout timeline` mid-body, or even as the first line, is
 * authored structure and stays legal.
 */

/**
 * The eight FR-CNT-020 structured fields, in the page's reading order.
 *
 * `title`, `summary`, `slug`, `metaTitle` and `metaDescription` are deliberately excluded: they are
 * plain text rendered outside the Markdown surface, so a `#` in them is not a heading at all.
 */
const STRUCTURED_FIELDS = [
  'overview',
  'businessProblem',
  'solution',
  'role',
  'architecture',
  'challenges',
  'features',
  'lessonsLearned',
] as const satisfies readonly (keyof ProjectTranslationContent)[];

/**
 * The section labels the Web layer renders, mirrored here per locale.
 *
 * This is a deliberate copy, not an oversight. The hard rule is that this repository never imports
 * from `eslammuatamed-web`, so the labels cannot be shared; and the alternative — asserting only
 * "no leading heading of any kind" — would outlaw the legitimate authored structure above. If a label
 * is reworded in the Web's `i18n/locales/{en,ar}.json`, add the new wording here; a stale entry makes
 * this guard weaker, never wrong, because it can only stop matching.
 */
const SECTION_LABELS: Readonly<Record<'en' | 'ar', readonly string[]>> = {
  en: [
    'Overview',
    'The problem',
    'The solution',
    'My role',
    'Architecture',
    'Challenges',
    'Key features',
    'What I took away',
  ],
  ar: [
    'نظرة عامة',
    'المشكلة',
    'الحل',
    'دوري',
    'المعمارية',
    'التحدّيات',
    'أبرز الميزات',
    'ما تعلّمته',
  ],
};

/** The leading ATX heading, if the value opens with one. Returns its text, else `null`. */
function leadingHeadingText(value: string): string | null {
  const match = /^\s*#{1,6}[ \t]+(.+?)[ \t]*#*\s*$/m.exec(
    value.trimStart().split('\n')[0] ?? '',
  );
  return match ? (match[1] ?? '').trim() : null;
}

/**
 * Comparison that ignores case and the Arabic tatweel/diacritics that wording tweaks tend to add, so
 * `التحدّيات` and `التحديات` are treated as the same label.
 *
 * Tatweel and the diacritics are stripped in two separate passes, using the `\p{Mn}` property escape
 * for the latter. Putting them in one character class — literally or as code points — trips
 * `no-misleading-character-class`, and rightly so: a class that mixes a base character with combining
 * marks renders as something quite different from what it matches. The property escape also covers
 * every Arabic mark rather than the handful a hand-written range happens to list.
 */
function normalize(text: string): string {
  return text
    .toLocaleLowerCase()
    .replace(/\u0640/gu, '')
    .replace(/\p{Mn}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('canonical Projects', () => {
  const cases = PROJECTS.flatMap((project) =>
    (['en', 'ar'] as const).map((locale) => ({
      locale,
      slug: project.en.slug,
      content: project[locale],
    })),
  );

  it('covers every project in both locales', () => {
    expect(cases).toHaveLength(PROJECTS.length * 2);
    expect(PROJECTS.length).toBeGreaterThan(0);
  });

  describe.each(cases)('$slug [$locale]', ({ locale, content }) => {
    it.each(STRUCTURED_FIELDS)(
      '%s does not open by repeating a governed section label',
      (field) => {
        const value = content[field];
        const heading = leadingHeadingText(value);

        if (heading === null) {
          return; // No leading heading at all — the normal, correct shape.
        }

        const repeated = SECTION_LABELS[locale].find(
          (label) => normalize(label) === normalize(heading),
        );

        expect(repeated).toBeUndefined();
      },
    );
  });

  /**
   * The positive half. Without this, deleting every `overview` value would also make the guard above
   * pass, so the suite has to know that content is still present.
   */
  describe.each(cases)('$slug [$locale] content presence', ({ content }) => {
    it.each(STRUCTURED_FIELDS)('%s is non-empty', (field) => {
      expect(content[field].trim().length).toBeGreaterThan(0);
    });
  });

  /**
   * Published links. `liveUrl` may only carry a URL whose governed case-study notes record
   * `publication.publicUrlAllowed: true`, and `repoUrl` is `null` everywhere because every source
   * lists private repository details under `avoidPublishingWithoutReview`.
   */
  describe('published links', () => {
    it.each(PROJECTS.map((p) => ({ slug: p.en.slug, liveUrl: p.liveUrl })))(
      '$slug publishes an absolute https live URL or none at all',
      ({ liveUrl }) => {
        if (liveUrl === null) {
          return;
        }
        expect(liveUrl).toMatch(/^https:\/\/[^\s/]+\.[^\s/]+/);
        expect(liveUrl).not.toMatch(/\s/);
      },
    );

    it('publishes no repository URL for any project', () => {
      expect(PROJECTS.map((p) => p.repoUrl)).toEqual(PROJECTS.map(() => null));
    });

    it('carries the three approved live URLs', () => {
      const bySlug = Object.fromEntries(
        PROJECTS.map((p) => [p.en.slug, p.liveUrl]),
      );
      expect(bySlug['samt-institution-website']).toBe(
        'https://www.samtinstitution.com',
      );
      expect(bySlug['lure-stores-multivendor-commerce']).toBe(
        'https://lurestores.com',
      );
      expect(bySlug['wavex-logistics-platform']).toBe('https://gowavex.com');
    });
  });
});
