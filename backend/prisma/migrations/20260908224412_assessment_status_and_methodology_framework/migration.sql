-- AlterEnum
-- Drops OVERDUE (assessment "overdue" is now a derived, visual-only flag -
-- see RiskAssessmentsService/DashboardsService) and adds UNDER_REVIEW (an
-- assessment whose work is done and is awaiting sign-off before Completed).
-- Safe only if no existing row still has status = 'OVERDUE'.
BEGIN;
CREATE TYPE "AssessmentStatus_new" AS ENUM ('PLANNED', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED');
ALTER TABLE "risk_assessments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "risk_assessments" ALTER COLUMN "status" TYPE "AssessmentStatus_new" USING ("status"::text::"AssessmentStatus_new");
ALTER TYPE "AssessmentStatus" RENAME TO "AssessmentStatus_old";
ALTER TYPE "AssessmentStatus_new" RENAME TO "AssessmentStatus";
DROP TYPE "AssessmentStatus_old";
ALTER TABLE "risk_assessments" ALTER COLUMN "status" SET DEFAULT 'PLANNED';
COMMIT;

-- AlterTable
-- Backfill existing methodology versions with the framework reference already
-- shown in the seeded/live methodology content, then drop the default so
-- every future version must set it explicitly (it's an editable field, not a
-- hardcoded constant - see CreateMethodologyVersionDto).
ALTER TABLE "methodology_versions" ADD COLUMN "frameworkReference" TEXT NOT NULL DEFAULT 'NIST SP 800-30 Rev. 1';
ALTER TABLE "methodology_versions" ALTER COLUMN "frameworkReference" DROP DEFAULT;
