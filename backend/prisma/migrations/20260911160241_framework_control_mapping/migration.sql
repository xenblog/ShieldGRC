/*
  Warnings:

  - You are about to drop the `control_frameworks` table. If the table is not empty, all the data it contains will be lost.

  Replaces the coarse Control<->Framework link with mapping to individual
  Framework clauses (e.g. ISO 27001:2022 "A.5.1"), via the new
  framework_controls + control_framework_controls tables. Any existing
  control_frameworks rows (Control<->whole-Framework links) are dropped
  with this migration and are NOT migrated forward - re-link each affected
  Control to the specific clause(s) it satisfies after this deploys.
*/
-- DropForeignKey
ALTER TABLE "control_frameworks" DROP CONSTRAINT "control_frameworks_controlId_fkey";

-- DropForeignKey
ALTER TABLE "control_frameworks" DROP CONSTRAINT "control_frameworks_frameworkId_fkey";

-- DropTable
DROP TABLE "control_frameworks";

-- CreateTable
CREATE TABLE "framework_controls" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "frameworkId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "framework_controls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_framework_controls" (
    "controlId" TEXT NOT NULL,
    "frameworkControlId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "control_framework_controls_pkey" PRIMARY KEY ("controlId","frameworkControlId")
);

-- CreateIndex
CREATE UNIQUE INDEX "framework_controls_frameworkId_code_key" ON "framework_controls"("frameworkId", "code");

-- CreateIndex
CREATE INDEX "control_framework_controls_frameworkControlId_idx" ON "control_framework_controls"("frameworkControlId");

-- AddForeignKey
ALTER TABLE "framework_controls" ADD CONSTRAINT "framework_controls_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "frameworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_framework_controls" ADD CONSTRAINT "control_framework_controls_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_framework_controls" ADD CONSTRAINT "control_framework_controls_frameworkControlId_fkey" FOREIGN KEY ("frameworkControlId") REFERENCES "framework_controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
