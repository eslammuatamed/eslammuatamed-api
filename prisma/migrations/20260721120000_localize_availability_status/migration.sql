-- Feature 007: move availability_status from the base site_settings row to the per-locale
-- site_settings_translations rows (localized like tagline; /ar must render Arabic, doc 10 §6).
-- Data-safe (additive-then-drop): the value is copied to every existing translation row before
-- the base column is dropped, so no data is lost when this runs on production.

ALTER TABLE "site_settings_translations" ADD COLUMN "availability_status" TEXT;

UPDATE "site_settings_translations" t
  SET "availability_status" = s."availability_status"
  FROM "site_settings" s
  WHERE t."site_settings_id" = s."id";

ALTER TABLE "site_settings" DROP COLUMN "availability_status";
