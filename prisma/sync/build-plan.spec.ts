import { PROJECTS } from '../content/canonical/projects';
import { SETTINGS_TRANSLATIONS } from '../content/canonical/site-settings';
import { SKILLS } from '../content/canonical/skills';
import { ARTICLES } from '../content/canonical/articles';
import { EXPERIENCES } from '../content/canonical/experiences';
import {
  ARTICLE_TRANSLATION_FIELDS,
  buildPlan,
  EXPERIENCE_TRANSLATION_FIELDS,
  experienceKey,
  PROJECT_TRANSLATION_FIELDS,
} from './build-plan';
import { renderPlanJson } from './report';
import { canonicalState, emptyState, fakeDb } from './testing/fake-db';
import type { FakeState } from './testing/fake-db';
import { isNoOp, summarize } from './types';

const planFor = (state: FakeState) => buildPlan(fakeDb(state));

const recordFor = (
  plan: Awaited<ReturnType<typeof buildPlan>>,
  model: string,
  naturalKey: string,
) =>
  plan.records.find(
    (record) => record.model === model && record.naturalKey === naturalKey,
  );

describe('buildPlan', () => {
  describe('empty database', () => {
    it('plans a create for every canonical record and deletes nothing', async () => {
      const plan = await planFor(emptyState());
      const summary = summarize(plan);

      expect(plan.problems).toEqual([]);
      expect(summary.deletes).toBe(0);
      expect(summary.hides).toBe(0);
      expect(summary.creates).toBe(
        SKILLS.length +
          PROJECTS.length +
          plan.records.filter(
            (record) =>
              record.action === 'create' &&
              ['Experience', 'Category', 'Tag', 'Article'].includes(
                record.model,
              ),
          ).length +
          1 + // SiteSettings singleton
          SETTINGS_TRANSLATIONS.length,
      );
      expect(summary.updates).toBe(0);
    });

    it('reports the governed scalars of a create, including the ones whose value is null', async () => {
      const plan = await planFor(emptyState());
      const project = recordFor(plan, 'Project', 'samt-institution-website');

      // `liveUrl`/`repoUrl` are null in the canonical dataset. A diff-based reporter would drop
      // them (null vs undefined both stringify to null) and the report would understate the create.
      expect(project?.fields.map((field) => field.field)).toEqual(
        expect.arrayContaining(['liveUrl', 'repoUrl', 'year']),
      );
    });
  });

  describe('a database that already matches canonical', () => {
    it('is a no-op — the property the second run must satisfy', async () => {
      const plan = await planFor(canonicalState());

      expect(plan.problems).toEqual([]);
      expect(isNoOp(plan)).toBe(true);
      expect(summarize(plan).affectedModels).toEqual([]);
    });

    it('produces byte-identical output across runs (deterministic ordering)', async () => {
      const first = renderPlanJson(await planFor(canonicalState()));
      const second = renderPlanJson(await planFor(canonicalState()));

      expect(first).toBe(second);
    });
  });

  describe('stale scalar values', () => {
    it('plans an update carrying before → after', async () => {
      const state = canonicalState();
      const samt = state.projects.find(
        (project) => project.id === 'project-samt-institution-website',
      )!;
      samt.year = 2025;

      const plan = await planFor(state);
      const record = recordFor(plan, 'Project', 'samt-institution-website');

      expect(record?.action).toBe('update');
      expect(record?.fields).toContainEqual({
        field: 'year',
        before: 2025,
        after: 2026,
      });
    });

    it('leaves every other record untouched when one scalar is stale', async () => {
      const state = canonicalState();
      state.projects.find(
        (project) => project.id === 'project-samt-institution-website',
      )!.year = 2025;

      const summary = summarize(await planFor(state));

      expect(summary.updates).toBe(1);
      expect(summary.creates).toBe(0);
      expect(summary.deletes).toBe(0);
    });
  });

  describe('stale translations', () => {
    it('detects a stale Arabic label and re-asserts it', async () => {
      const state = canonicalState();
      const skill = state.skills[0]!;
      (skill.translations as { locale: string; label: string }[])[1]!.label =
        'قديم';

      const plan = await planFor(state);
      const record = recordFor(plan, 'Skill', SKILLS[0]!.slug);

      expect(record?.action).toBe('update');
      expect(record?.fields).toContainEqual({
        field: 'label.ar',
        before: 'قديم',
        after: SKILLS[0]!.labelAr,
      });
    });

    it('detects a stale Arabic article body', async () => {
      const state = canonicalState();
      const article = state.articles[0]!;
      (article.translations as { locale: string; body: string }[])[1]!.body =
        'نص قديم';

      const plan = await planFor(state);
      const changed = plan.records.filter(
        (record) => record.model === 'Article' && record.action === 'update',
      );

      expect(changed).toHaveLength(1);
      expect(changed[0]?.fields.map((field) => field.field)).toContain(
        'body.ar',
      );
    });
  });

  describe('obsolete allowlisted records', () => {
    it('plans a delete for a Project absent from the canonical dataset', async () => {
      const state = canonicalState();
      state.projects.push({
        id: 'project-stale',
        featured: false,
        isPublished: true,
        order: 99,
        year: 2019,
        liveUrl: null,
        repoUrl: null,
        translations: [
          { locale: 'en', slug: 'an-old-project', title: 'An Old Project' },
        ],
        technologies: [],
        gallery: [],
      });

      const plan = await planFor(state);
      const record = recordFor(plan, 'Project', 'an-old-project');

      expect(record?.action).toBe('delete');
      expect(record?.id).toBe('project-stale');
    });

    it('plans a delete for an Article absent from the canonical dataset', async () => {
      const state = canonicalState();
      state.articles.push({
        id: 'article-stale',
        status: 'PUBLISHED',
        publishAt: new Date('2020-01-01T00:00:00.000Z'),
        categoryId: 'category-engineering',
        translations: [
          { locale: 'en', slug: 'an-old-post', title: 'An Old Post' },
        ],
        tags: [],
      });

      const plan = await planFor(state);

      expect(recordFor(plan, 'Article', 'an-old-post')?.action).toBe('delete');
    });

    it('refuses to delete a stale Category that a surviving article still references', async () => {
      const state = canonicalState();
      state.categories.push({
        id: 'category-stale',
        translations: [{ locale: 'en', name: 'Old', slug: 'old-category' }],
        // A canonical article that this plan KEEPS still points at it.
        articles: [{ id: 'article-keeps-pointing' }],
      });

      const plan = await planFor(state);

      expect(recordFor(plan, 'Category', 'old-category')).toBeUndefined();
      expect(plan.problems.join('\n')).toMatch(
        /Category "old-category" is not canonical but is still referenced/,
      );
    });

    it('deletes a stale Category once nothing references it', async () => {
      const state = canonicalState();
      state.categories.push({
        id: 'category-stale',
        translations: [{ locale: 'en', name: 'Old', slug: 'old-category' }],
        articles: [],
      });

      const plan = await planFor(state);

      expect(recordFor(plan, 'Category', 'old-category')?.action).toBe(
        'delete',
      );
      expect(plan.problems).toEqual([]);
    });
  });

  describe('Skill semantics', () => {
    it('hides a non-canonical skill instead of deleting it, preserving its id', async () => {
      const state = canonicalState();
      state.skills.push({
        id: 'skill-retired',
        slug: 'jquery',
        group: 'FRONTEND',
        order: 99,
        brandColor: null,
        isPublic: true,
        translations: [
          { locale: 'en', label: 'jQuery' },
          { locale: 'ar', label: 'jQuery' },
        ],
      });

      const plan = await planFor(state);
      const record = recordFor(plan, 'Skill', 'jquery');

      expect(record?.action).toBe('hide');
      expect(record?.id).toBe('skill-retired');
      expect(record?.fields).toEqual([
        { field: 'isPublic', before: true, after: false },
      ]);
      expect(
        plan.records.some(
          (candidate) =>
            candidate.model === 'Skill' && candidate.action === 'delete',
        ),
      ).toBe(false);
    });

    it('leaves an already-hidden non-canonical skill alone', async () => {
      const state = canonicalState();
      state.skills.push({
        id: 'skill-retired',
        slug: 'jquery',
        group: 'FRONTEND',
        order: 99,
        brandColor: null,
        isPublic: false,
        translations: [{ locale: 'en', label: 'jQuery' }],
      });

      const plan = await planFor(state);

      expect(recordFor(plan, 'Skill', 'jquery')?.action).toBe('unchanged');
      expect(isNoOp(await planFor(state))).toBe(true);
    });

    it('never plans a slug change — the id is found BY the slug, so a rename is an update in place', async () => {
      const state = canonicalState();
      const skill = state.skills[0]!;
      (skill.translations as { locale: string; label: string }[])[0]!.label =
        'Renamed In Place';

      const plan = await planFor(state);
      const record = recordFor(plan, 'Skill', SKILLS[0]!.slug);

      expect(record?.action).toBe('update');
      expect(record?.id).toBe(skill.id);
      expect(record?.fields.map((field) => field.field)).not.toContain('slug');
    });

    it('refuses when a different skill already holds a canonical English label', async () => {
      const state = canonicalState();
      // Same visible label, different slug — creating a second row would split one capability.
      state.skills = state.skills.filter(
        (skill) => skill.slug !== SKILLS[0]!.slug,
      );
      state.skills.push({
        id: 'skill-impostor',
        slug: 'some-other-slug',
        group: SKILLS[0]!.group,
        order: 0,
        brandColor: null,
        isPublic: true,
        translations: [{ locale: 'en', label: SKILLS[0]!.labelEn }],
      });

      const plan = await planFor(state);

      expect(plan.problems.join('\n')).toMatch(/Skill identity conflict/);
    });
  });

  describe('relation replacement', () => {
    it('reports the exact technologies added and removed', async () => {
      const state = canonicalState();
      const project = state.projects.find(
        (candidate) => candidate.id === 'project-samt-institution-website',
      )!;
      project.technologies = [
        { skillId: 'skill-nuxt' },
        { skillId: 'skill-laravel' },
      ];

      const plan = await planFor(state);
      const relation = plan.relations.find(
        (candidate) =>
          candidate.model === 'ProjectTechnology' &&
          candidate.owner === 'samt-institution-website',
      );

      expect(relation?.removed).toEqual(['laravel']);
      expect(relation?.added).toEqual(
        expect.arrayContaining(['nestjs', 'tailwind-css', 'typescript', 'vue']),
      );
      expect(relation?.added).not.toContain('nuxt');
    });

    it('reports article tag replacement', async () => {
      const state = canonicalState();
      state.articles[0]!.tags = [{ tagId: 'tag-security' }];

      const plan = await planFor(state);
      const relation = plan.relations.find(
        (candidate) => candidate.model === 'ArticleTag',
      );

      expect(relation?.removed).toEqual(['security']);
      expect(relation?.added.length).toBeGreaterThan(0);
    });
  });

  describe('SiteSettings — the create-only regression', () => {
    it('re-asserts siteName, availabilityStatus and both default meta strings when stale', async () => {
      const state = canonicalState();
      const translation = (
        state.siteSettings[0]!.translations as Record<string, unknown>[]
      )[0]!;
      translation.siteName = 'Stale Name';
      translation.availabilityStatus = 'Stale availability';
      translation.defaultMetaTitle = 'Stale title';
      translation.defaultMetaDescription = 'Stale description';

      const plan = await planFor(state);
      const record = recordFor(plan, 'SiteSettingsTranslation', 'en');

      // These four are exactly the fields the base seed treats as create-only, so an
      // already-provisioned database keeps them forever. The synchronization must move them.
      expect(record?.action).toBe('update');
      expect(record?.fields.map((field) => field.field).sort()).toEqual([
        'availabilityStatus',
        'defaultMetaDescription',
        'defaultMetaTitle',
        'siteName',
      ]);
    });

    it('does not report an update when only key ORDER differs in the profileLinks JSON', async () => {
      const state = canonicalState();
      state.siteSettings[0]!.profileLinks = (
        state.siteSettings[0]!.profileLinks as Record<string, string>[]
      ).map((link) => ({
        icon: link.icon!,
        url: link.url!,
        label: link.label!,
      }));

      const plan = await planFor(state);

      // JSONB returns keys in write order. A naive JSON.stringify comparison would report an
      // update forever, and the zero-change second run would never be reachable.
      expect(recordFor(plan, 'SiteSettings', 'singleton')?.action).toBe(
        'unchanged',
      );
    });

    it('refuses when the singleton is not singular', async () => {
      const state = canonicalState();
      state.siteSettings.push({ ...state.siteSettings[0]!, id: 'settings-2' });

      const plan = await planFor(state);

      expect(plan.problems.join('\n')).toMatch(/SiteSettings is a singleton/);
    });
  });

  describe('ambiguity fails closed', () => {
    it('refuses when two Project rows share one English slug', async () => {
      const state = canonicalState();
      state.projects.push({
        ...state.projects[0]!,
        id: 'project-duplicate',
      });

      const plan = await planFor(state);

      expect(plan.problems.join('\n')).toMatch(
        /Two Project rows share the English slug/,
      );
    });

    it('refuses when two Experience rows share one (company, role) key', async () => {
      const state = canonicalState();
      state.experiences.push({
        ...state.experiences[0]!,
        id: 'experience-duplicate',
      });

      const plan = await planFor(state);

      expect(plan.problems.join('\n')).toMatch(
        /Two Experience rows share the English \(company, role\) key/,
      );
    });

    it('refuses a governed row that has no English translation to key on', async () => {
      const state = canonicalState();
      state.projects.push({
        id: 'project-no-english',
        featured: false,
        isPublished: true,
        order: 50,
        year: 2020,
        liveUrl: null,
        repoUrl: null,
        translations: [{ locale: 'ar', slug: 'arabic-only', title: 'عربي' }],
        technologies: [],
        gallery: [],
      });

      const plan = await planFor(state);

      expect(plan.problems.join('\n')).toMatch(
        /has no English translation, so it has no natural key/,
      );
    });

    it('refuses when a required locale is missing', async () => {
      const state = canonicalState();
      state.locales = [{ code: 'en' }];

      const plan = await planFor(state);

      expect(plan.problems.join('\n')).toMatch(/Locale "ar" is missing/);
    });
  });

  describe('media safety', () => {
    it('discloses the gallery rows a stale Project delete would cascade into', async () => {
      const state = canonicalState();
      state.projects.push({
        id: 'project-stale',
        featured: false,
        isPublished: true,
        order: 99,
        year: 2019,
        liveUrl: null,
        repoUrl: null,
        translations: [{ locale: 'en', slug: 'gallery-project', title: 'G' }],
        technologies: [],
        gallery: [{ id: 'gallery-1' }, { id: 'gallery-2' }],
      });

      const plan = await planFor(state);
      const cascade = plan.cascades.find(
        (candidate) => candidate.owner === 'gallery-project',
      );

      expect(cascade).toEqual({
        model: 'ProjectGalleryItem',
        owner: 'gallery-project',
        count: 2,
        detail: ['gallery-1', 'gallery-2'],
      });
      // MediaAsset itself is never named by the plan — the relation goes, the asset stays.
      expect(
        plan.records.some((record) => record.model.startsWith('MediaAsset')),
      ).toBe(false);
    });
  });

  describe('protected models', () => {
    it('counts every protected model and names none of them as a change', async () => {
      const plan = await planFor(canonicalState());

      expect(Object.keys(plan.protectedCounts).sort()).toEqual([
        'ContactMessage',
        'Locale',
        'MediaAsset',
        'MediaAssetAlt',
        'MediaAssetVariant',
        'PageSeo',
        'RefreshToken',
        'Role',
        'RolePermission',
        'SlugRedirect',
        'Testimonial',
        'TestimonialTranslation',
        'User',
      ]);
      for (const record of plan.records)
        expect(Object.keys(plan.protectedCounts)).not.toContain(record.model);
    });
  });

  describe('what apply WRITES is what the plan DIFFS', () => {
    // `apply-plan.ts` writes a translation by spreading the whole canonical content object. The
    // builder diffs only the fields in these lists. A field present in the object but absent from
    // the list would be written on every run and never diffed — the row would mutate while the
    // report said "unchanged", which is a report that lies about a production write. The natural-key
    // field is the one legitimate absence: the row was found BY it, so it cannot differ.
    it.each([
      [
        'Project',
        Object.keys(PROJECTS[0]!.en),
        PROJECT_TRANSLATION_FIELDS,
        'slug',
      ],
      [
        'Article',
        Object.keys(ARTICLES[0]!.en),
        ARTICLE_TRANSLATION_FIELDS,
        'slug',
      ],
    ])('%s translation', (_model, written, diffed, naturalKey) => {
      expect(written.filter((field) => field !== naturalKey).sort()).toEqual(
        [...diffed].sort(),
      );
    });

    it('Experience translation — role and company ARE the natural key', () => {
      const written = Object.keys(EXPERIENCES[0]!.en);

      expect(written.sort()).toEqual([...EXPERIENCE_TRANSLATION_FIELDS].sort());
    });
  });

  describe('experienceKey', () => {
    it('distinguishes two roles at the same company', () => {
      expect(experienceKey('Findropica', 'Frontend Developer')).not.toBe(
        experienceKey('Findropica', 'Senior Frontend Developer'),
      );
    });
  });
});
