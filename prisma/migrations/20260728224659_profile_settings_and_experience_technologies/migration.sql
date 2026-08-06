-- Profile pages data contract (docs 02 v1.5.0, 09 v1.8.0, 10 v1.7.0).
--
-- Authored by hand (not left as `prisma migrate dev` emitted it) following the precedent of
-- 20260720204630_add_contact_message_archived_at: this schema carries a raw-SQL FTS generated
-- column (article_translations.search_vector, D09-6) that migrate-dev's shadow diff tries to
-- drop on every run. Its DROP INDEX / DROP COLUMN statements are deliberately omitted here —
-- keeping them would destroy article full-text search (D02-3).
--
-- Purely additive: every new column is nullable, so there is no backfill and no data loss.
-- No portrait MediaAsset is invented — portrait_asset_id stays NULL until the owner uploads one.

-- About portrait reference and public addresses (D09-18). TEXT columns; length is enforced at
-- the DTO layer (emails 254, current_focus 300, Markdown fields MARKDOWN_MAX), not by the column.
ALTER TABLE "site_settings" ADD COLUMN "portrait_asset_id" TEXT;
ALTER TABLE "site_settings" ADD COLUMN "professional_email" TEXT;
ALTER TABLE "site_settings" ADD COLUMN "contact_email" TEXT;

-- Per-locale About content (FR-PUB-020, D09-18). about_bio and engineering_philosophy hold
-- Markdown source; current_focus is plain text.
ALTER TABLE "site_settings_translations" ADD COLUMN "about_bio" TEXT;
ALTER TABLE "site_settings_translations" ADD COLUMN "engineering_philosophy" TEXT;
ALTER TABLE "site_settings_translations" ADD COLUMN "current_focus" TEXT;

-- Experience ↔ Skill join (D09-17), mirroring project_technologies: the composite PK makes a
-- duplicate link structurally impossible; no order column (order derives from skills.order).
CREATE TABLE "experience_technologies" (
    "experience_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,

    CONSTRAINT "experience_technologies_pkey" PRIMARY KEY ("experience_id","skill_id")
);

CREATE INDEX "experience_technologies_skill_id_idx" ON "experience_technologies"("skill_id");

-- Cascade from Experience: deleting an entry drops its links.
ALTER TABLE "experience_technologies" ADD CONSTRAINT "experience_technologies_experience_id_fkey" FOREIGN KEY ("experience_id") REFERENCES "experiences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Restrict from Skill: a referenced skill cannot be deleted out from under an experience.
ALTER TABLE "experience_technologies" ADD CONSTRAINT "experience_technologies_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restrict from the portrait asset, matching the resume-asset rule: an in-use portrait cannot be
-- deleted; media usages surface it as `settings-portrait` and DELETE returns 409.
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_portrait_asset_id_fkey" FOREIGN KEY ("portrait_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
