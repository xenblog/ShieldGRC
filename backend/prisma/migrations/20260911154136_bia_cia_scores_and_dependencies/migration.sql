-- Adds a CIA triad rating (Confidentiality/Integrity/Availability, 1-3) to
-- Business Processes, independent of the existing criticalityTier, and a
-- self-referential dependency edge (business_process_dependencies) so one
-- Business Process can record which others it depends on.
-- AlterTable
ALTER TABLE "business_processes" ADD COLUMN     "availabilityScore" INTEGER,
ADD COLUMN     "confidentialityScore" INTEGER,
ADD COLUMN     "integrityScore" INTEGER;

-- CreateTable
CREATE TABLE "business_process_dependencies" (
    "businessProcessId" TEXT NOT NULL,
    "dependsOnId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_process_dependencies_pkey" PRIMARY KEY ("businessProcessId","dependsOnId")
);

-- CreateIndex
CREATE INDEX "business_process_dependencies_dependsOnId_idx" ON "business_process_dependencies"("dependsOnId");

-- AddForeignKey
ALTER TABLE "business_process_dependencies" ADD CONSTRAINT "business_process_dependencies_businessProcessId_fkey" FOREIGN KEY ("businessProcessId") REFERENCES "business_processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_process_dependencies" ADD CONSTRAINT "business_process_dependencies_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "business_processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
