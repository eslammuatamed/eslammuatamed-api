-- Per-usage localized alt for the About portrait (FR-PUB-020, D09-22).
--
-- ADDITIVE AND PRODUCTION-SAFE: one nullable column. No backfill, no constraint change, no data
-- movement, and every existing row stays valid — an absent alt keeps `/about` in the governed
-- `portrait-alt-missing` readiness state (D18-7), which is already the live behaviour.
--
-- Deliberately NOT on `media_assets`: `media_asset_alts` is asset-level DEFAULT metadata, while the
-- published accessibility text belongs to the USAGE. A reusable asset can require different
-- descriptions in different contexts, so per-usage alt takes precedence over the asset default.
ALTER TABLE "site_settings_translations" ADD COLUMN "portrait_alt" TEXT;
