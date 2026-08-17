-- GTM-only tracking (D02-14, owner direction 2026-08-17).
--
-- Replaces the `analytics_provider` + `analytics_measurement_id` pair with a single
-- `gtm_container_id`. Google Tag Manager becomes the one integration point; the vendors it may
-- carry (GA4, Meta Pixel, LinkedIn Insight, conversion tags) are configured inside the container,
-- never as per-vendor columns here.
--
-- Prisma's generated form dropped both columns FIRST, which would have discarded a container id
-- that is still valid under the new model. The order below is deliberate: add, carry over what
-- survives, re-establish the enabled invariant, and only then drop.

-- 1. The new column.
ALTER TABLE "site_settings" ADD COLUMN "gtm_container_id" TEXT;

-- 2. Carry over a value that was ALREADY a GTM container id. A `ga4` row holds a measurement id
--    (`G-XXXXXXXXXX`), which is not a container id and has no meaning under the new model — copying
--    it would smuggle an invalid value past the DTO regex that now guards this column. The format
--    test is applied here too, so a hand-edited or legacy value cannot arrive pre-broken.
UPDATE "site_settings"
SET "gtm_container_id" = "analytics_measurement_id"
WHERE "analytics_provider" = 'gtm'
  AND "analytics_measurement_id" ~ '^GTM-[A-Z0-9]{4,12}$';

-- 3. Never leave tracking advertised as ENABLED with nothing to load. Any row whose value did not
--    survive step 2 (a ga4 provider, a malformed id, or no id at all) is switched off rather than
--    left in a state the public contract cannot express — `analyticsEnabled` true with a null
--    container would publish an empty tag. This mirrors the service rule added with this change,
--    so the database can never hold a combination the API would reject on write.
UPDATE "site_settings"
SET "analytics_enabled" = false
WHERE "gtm_container_id" IS NULL;

-- 4. Now the old columns are safe to remove.
ALTER TABLE "site_settings"
  DROP COLUMN "analytics_provider",
  DROP COLUMN "analytics_measurement_id";
