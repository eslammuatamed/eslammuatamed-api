-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'FREELANCE');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "is_published" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "experiences" ADD COLUMN     "employment_type" "EmploymentType" NOT NULL;

-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "career_start_month" INTEGER,
ADD COLUMN     "career_start_year" INTEGER;
