-- Stable public identity for Skill: `slug`.
--
-- WHY: the public technology filter is `/projects?technology=<value>`. Until now the only accepted
-- value was the Skill UUID, and the only stable lookup key inside the content seed was the English
-- label. Neither can be a public identifier: a UUID is meaningless in a shared URL, and a localized
-- label makes the same filter a different URL per locale and breaks every existing link the moment
-- copy is edited. `slug` is locale-independent, readable, and stable across label changes.
--
-- STAGED, in one transaction, so a partially-slugged table can never be observed:
--   1. add the column NULLABLE (backfillable),
--   2. backfill every row from an EXPLICIT canonical mapping,
--   3. validate: no NULLs, no collisions, correct format — RAISE (aborting the whole migration)
--      rather than mutate anything the mapping does not explicitly cover,
--   4. only then enforce NOT NULL + UNIQUE.
--
-- The mapping is written out by hand and is NOT generated from arbitrary stored labels: silently
-- slugifying whatever a database happens to contain is exactly how an unreviewed public URL gets
-- minted. A row this mapping does not name is a STOP condition, reported with its label and id.
--
-- Skill ids, translations, groups, ordering, visibility and every `ProjectTechnology` /
-- `ExperienceTechnology` relation are untouched — this only adds a column.
--
-- ===== RUNNING THIS AGAINST PRODUCTION — read before you do =====
--
-- 1. ATOMICITY COMES FROM THE RUNNER, NOT FROM THIS FILE. `prisma migrate deploy` sends the file as
--    one batch, which PostgreSQL wraps in an implicit transaction — that is what makes the abort
--    below leave no half-slugged table. `psql -f` does NOT: it autocommits per statement, so a
--    RAISE at step 3 would leave the column added and backfilled. Use `migrate deploy`, or
--    `psql --single-transaction` if you must run it by hand. Do NOT add BEGIN/COMMIT here — Prisma
--    wraps the file itself, and an explicit transaction block breaks that path.
--
-- 2. PRE-FLIGHT PROBE. An abort is correct behaviour, but it still costs a deploy cycle. Confirm
--    every skill is nameable by the mapping BEFORE deploying:
--      SELECT s.id, t.label FROM skills s
--        LEFT JOIN skill_translations t ON t.skill_id = s.id AND t.locale = 'en';
--    Every label returned must appear in the `canonical` list below, and no row may have a NULL
--    label. Anything else is the owner decision this migration refuses to make for you.
--
-- 3. IF IT DOES ABORT, THE PIPELINE IS WEDGED UNTIL YOU CLEAR IT. Prisma leaves the row in
--    `_prisma_migrations` with `finished_at` NULL, which blocks every later `migrate deploy`. Clear
--    it with:
--      npx prisma migrate resolve --rolled-back 20260805110000_add_skill_slug
--    then fix the mapping and redeploy. Nothing was written, so there is nothing else to undo.

-- ===== 1. Add the column, nullable so it can be backfilled =====
ALTER TABLE "skills" ADD COLUMN "slug" TEXT;

-- ===== 2. Backfill from the explicit canonical mapping =====
--
-- Keyed on the ENGLISH label, which is the key the content seed has always used to identify a
-- record. Both the CURRENT approved label and the PRE-RENAME label are listed for the three
-- renamed entries (`Vue.js`→vue, `Web Performance`→performance, `SEO`→technical-seo), because
-- Production still carries the old labels while a seeded development database already carries the
-- new ones. One mapping therefore serves both, and neither needs a separate migration path.
WITH canonical (label, slug) AS (
  VALUES
    -- Languages
    ('TypeScript',           'typescript'),
    ('JavaScript',           'javascript'),
    ('PHP',                  'php'),
    -- Frontend Engineering
    ('Vue',                  'vue'),
    ('Vue.js',               'vue'),               -- pre-rename label (Production)
    ('Nuxt',                 'nuxt'),
    ('Pinia',                'pinia'),
    ('Tailwind CSS',         'tailwind-css'),
    -- Backend Engineering
    ('Node.js',              'nodejs'),
    ('NestJS',               'nestjs'),
    ('Prisma',               'prisma'),
    ('Strapi',               'strapi'),
    ('Laravel',              'laravel'),
    -- Delivery & Quality
    ('Requirements Analysis', 'requirements-analysis'),
    ('Feature Ownership',     'feature-ownership'),
    ('Testing',               'testing'),
    ('Performance',           'performance'),
    ('Web Performance',       'performance'),      -- pre-rename label (Production)
    ('Technical SEO',         'technical-seo'),
    ('SEO',                   'technical-seo'),    -- pre-rename label (Production)
    ('Deployment',            'deployment'),
    -- Retained but hidden
    ('Vite',                  'vite'),
    ('Git',                   'git'),
    ('Accessibility (a11y)',  'accessibility')
)
UPDATE "skills" AS s
SET "slug" = c.slug
FROM "skill_translations" AS t
JOIN canonical AS c ON c.label = t.label
WHERE t.skill_id = s.id
  AND t.locale = 'en';

-- ===== 3. Validate BEFORE constraining =====
DO $$
DECLARE
  unmapped TEXT;
  collisions TEXT;
  malformed TEXT;
BEGIN
  -- 3a. Every row must be named by the mapping. An unknown skill is a STOP condition: it means the
  -- registry drifted from the approved taxonomy, and the correct response is an owner decision on
  -- its canonical slug, never an invented one.
  SELECT string_agg(
           format('%s (id=%s)', COALESCE(t.label, '<no en translation>'), s.id),
           ', ' ORDER BY s.id)
    INTO unmapped
    FROM "skills" AS s
    LEFT JOIN "skill_translations" AS t
      ON t.skill_id = s.id AND t.locale = 'en'
   WHERE s."slug" IS NULL;

  IF unmapped IS NOT NULL THEN
    RAISE EXCEPTION
      'Skill slug backfill incomplete — no canonical slug is defined for: %. '
      'Add an explicit mapping for each of these skills before migrating; '
      'slugs are public URLs and must not be generated from stored labels.', unmapped;
  END IF;

  -- 3b. Two records resolving to one slug means two identities would merge behind a single public
  -- URL. Reported explicitly rather than surfacing as an opaque unique-index violation below.
  SELECT string_agg(slug || ' (x' || n || ')', ', ' ORDER BY slug)
    INTO collisions
    FROM (SELECT "slug" AS slug, count(*) AS n FROM "skills" GROUP BY 1 HAVING count(*) > 1) dup;

  IF collisions IS NOT NULL THEN
    RAISE EXCEPTION
      'Skill slug collision — these slugs are claimed by more than one skill: %. '
      'Merge or re-map the duplicate records before migrating.', collisions;
  END IF;

  -- 3c. Format is part of the contract, not a convention: lowercase kebab-case only.
  --
  -- A uuid-shaped slug is rejected by the SAME check, because `?technology=` accepts either a slug
  -- or a legacy Skill uuid and tells them apart by shape. A uuid satisfies the kebab-case rule on
  -- its own (lowercase hex groups joined by single hyphens), so a slug in that shape would be
  -- routed to the id column forever and answer with an empty page.
  --
  -- This guard covers the BACKFILL only; the CHECK constraint added in step 4 is what governs every
  -- later write. Both exist deliberately: the constraint gives an opaque `23514`, while this names
  -- the offending slugs, which is what a failed deploy actually needs to be actionable.
  SELECT string_agg("slug", ', ' ORDER BY "slug")
    INTO malformed
    FROM "skills"
   WHERE "slug" !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      OR "slug" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  IF malformed IS NOT NULL THEN
    RAISE EXCEPTION
      'Skill slug format invalid — must be lowercase kebab-case ^[a-z0-9]+(-[a-z0-9]+)*$ '
      'and must not be shaped like a uuid: %',
      malformed;
  END IF;
END $$;

-- ===== 4. Enforce =====
ALTER TABLE "skills" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "skills_slug_key" ON "skills"("slug");

-- Format as a DATABASE INVARIANT, not merely an input rule.
--
-- The validation in step 3 runs once, over the rows that existed at migration time. Every LATER
-- write — the content seed, an admin create, a console session, a future migration — would be
-- unconstrained without this. That matters more than usual here because `?technology=` accepts a
-- slug OR a legacy Skill uuid and separates them by SHAPE: a uuid satisfies the kebab-case rule on
-- its own, so a uuid-shaped slug would be routed to the id column forever and answer with an empty
-- page. `CreateSkillDto` refuses one at the API boundary; this refuses one at the column, which is
-- the only place that also covers the seed and raw SQL.
--
-- Second CHECK constraint in the schema, after D09-19's contact at-least-one rule, and added for
-- the same reason recorded there: application validation is bypassable by whoever writes next.
-- Prisma cannot model CHECK constraints, so like that one it lives in migration SQL and is
-- invisible in `schema.prisma`.
ALTER TABLE "skills" ADD CONSTRAINT "skills_slug_format_check" CHECK (
  "slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  AND "slug" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);
