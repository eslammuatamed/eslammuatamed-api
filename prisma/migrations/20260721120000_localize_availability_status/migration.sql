-- Feature 007: move availability_status from the base site_settings row to the per-locale
-- site_settings_translations rows (localized like tagline; /ar must render Arabic, doc 10 §6).
-- The hosted environment is disposable pre-launch staging, so this unpublished migration records
-- only the intended final schema; deterministic seeds write each locale's value directly.

ALTER TABLE "site_settings_translations" ADD COLUMN "availability_status" TEXT;

ALTER TABLE "site_settings" DROP COLUMN "availability_status";
