-- AlterTable: additive nullable archival timestamp (D09-14).
-- Basis for the 12-month archived-message retention purge (doc 19 §6, D19-10):
-- set when a message is archived, cleared when un-archived; the daily purge deletes
-- rows whose archived_at is more than 12 months in the past.
-- Nullable, no default, no backfill — existing rows keep archived_at = NULL until archived.
-- Authored by hand (not `prisma migrate dev`) because this schema carries a raw-SQL FTS
-- generated column (article_translations.search_vector, D09-6) that migrate-dev's shadow
-- diff would otherwise try to drop.
ALTER TABLE "contact_messages" ADD COLUMN "archived_at" TIMESTAMP(3);
