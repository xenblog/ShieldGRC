-- CreateEnum
CREATE TYPE "UserAccountStatus" AS ENUM ('ACTIVE', 'INVITED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "UserSource" AS ENUM ('MANUAL', 'ENTRA_SSO');

-- AlterTable
-- role becomes optional (a JIT-provisioned SSO user has none until an Admin
-- assigns one). status/source/lastLoginAt are added nullable first so
-- existing rows can be backfilled from the columns being replaced
-- (isActive, azureAdObjectId), then tightened to NOT NULL.
ALTER TABLE "users"
  ALTER COLUMN "role" DROP NOT NULL,
  ADD COLUMN     "status" "UserAccountStatus",
  ADD COLUMN     "source" "UserSource",
  ADD COLUMN     "lastLoginAt" TIMESTAMP(3);

UPDATE "users" SET "status" = CASE WHEN "isActive" THEN 'ACTIVE' ELSE 'DEACTIVATED' END::"UserAccountStatus";
UPDATE "users" SET "source" = CASE WHEN "azureAdObjectId" IS NOT NULL THEN 'ENTRA_SSO' ELSE 'MANUAL' END::"UserSource";

ALTER TABLE "users"
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'INVITED',
  ALTER COLUMN "source" SET NOT NULL,
  DROP COLUMN "isActive";
