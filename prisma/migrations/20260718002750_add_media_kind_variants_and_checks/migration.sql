-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'PDF');

-- CreateEnum
CREATE TYPE "MediaVariantFormat" AS ENUM ('WEBP', 'AVIF');

-- AlterTable (media_assets is empty — NOT NULL columns need no backfill; D09-4/D02-7)
ALTER TABLE "media_assets" ADD COLUMN     "kind" "MediaKind" NOT NULL,
ADD COLUMN     "original_filename" TEXT NOT NULL,
ADD COLUMN     "content_hash" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "media_asset_variants" (
    "id" TEXT NOT NULL,
    "media_asset_id" TEXT NOT NULL,
    "format" "MediaVariantFormat" NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "over_budget" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_asset_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_content_hash_key" ON "media_assets"("content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "media_asset_variants_storage_key_key" ON "media_asset_variants"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "media_asset_variants_media_asset_id_format_width_key" ON "media_asset_variants"("media_asset_id", "format", "width");

-- AddForeignKey
ALTER TABLE "media_asset_variants" ADD CONSTRAINT "media_asset_variants_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data-integrity CHECK constraints (doc 09). Not expressible in the Prisma schema, so added as raw
-- SQL here (same pattern as the init migration's FTS block, D09-6). The kind<->fields rule keeps
-- IMAGE (WebP master: dimensions + blurhash + image/webp) and PDF (no dimensions, application/pdf)
-- structurally honest. Cross-row invariants (resume kind; alt/variant image-only) stay service-side.
ALTER TABLE "media_assets"
    ADD CONSTRAINT "media_assets_size_bytes_positive_check" CHECK ("size_bytes" > 0),
    ADD CONSTRAINT "media_assets_width_positive_check" CHECK ("width" IS NULL OR "width" > 0),
    ADD CONSTRAINT "media_assets_height_positive_check" CHECK ("height" IS NULL OR "height" > 0),
    ADD CONSTRAINT "media_assets_content_hash_sha256_hex_check" CHECK ("content_hash" ~ '^[0-9a-f]{64}$'),
    ADD CONSTRAINT "media_assets_kind_fields_consistent_check" CHECK (
        ("kind" = 'IMAGE' AND "width" IS NOT NULL AND "height" IS NOT NULL AND "blurhash" IS NOT NULL AND "mime_type" = 'image/webp')
        OR
        ("kind" = 'PDF' AND "width" IS NULL AND "height" IS NULL AND "blurhash" IS NULL AND "mime_type" = 'application/pdf')
    );

-- CHECK constraints (media_asset_variants — dimensions always present)
ALTER TABLE "media_asset_variants"
    ADD CONSTRAINT "media_asset_variants_size_bytes_positive_check" CHECK ("size_bytes" > 0),
    ADD CONSTRAINT "media_asset_variants_width_positive_check" CHECK ("width" > 0),
    ADD CONSTRAINT "media_asset_variants_height_positive_check" CHECK ("height" > 0);
