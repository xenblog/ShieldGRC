-- Adds the BIA Register (BusinessProcess + BusinessProcessRisk) and a real
-- Risk<->Control relation (risk_controls), and switches Risk.residualScore
-- from pure manual entry to computed-by-default with an optional manual
-- override (residualScoreOverride, residualSource). No backfill: existing
-- residualScore/residualBand values are left as-is and residualSource
-- starts NULL (treated as MANUAL by the application until next recompute).
-- CreateEnum
CREATE TYPE "BusinessProcessCriticalityTier" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ResidualScoreSource" AS ENUM ('COMPUTED', 'MANUAL');

-- AlterTable
ALTER TABLE "risks" ADD COLUMN     "residualScoreOverride" INTEGER,
ADD COLUMN     "residualSource" "ResidualScoreSource";

-- CreateTable
CREATE TABLE "risk_controls" (
    "riskId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_controls_pkey" PRIMARY KEY ("riskId","controlId")
);

-- CreateTable
CREATE TABLE "business_processes" (
    "id" TEXT NOT NULL,
    "sequenceNumber" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "orgUnitId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "criticalityTier" "BusinessProcessCriticalityTier" NOT NULL,
    "rtoMinutes" INTEGER,
    "rpoMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_process_risks" (
    "businessProcessId" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_process_risks_pkey" PRIMARY KEY ("businessProcessId","riskId")
);

-- CreateIndex
CREATE INDEX "risk_controls_controlId_idx" ON "risk_controls"("controlId");

-- CreateIndex
CREATE UNIQUE INDEX "business_processes_sequenceNumber_key" ON "business_processes"("sequenceNumber");

-- CreateIndex
CREATE INDEX "business_processes_orgUnitId_idx" ON "business_processes"("orgUnitId");

-- CreateIndex
CREATE INDEX "business_processes_ownerId_idx" ON "business_processes"("ownerId");

-- CreateIndex
CREATE INDEX "business_processes_criticalityTier_idx" ON "business_processes"("criticalityTier");

-- CreateIndex
CREATE INDEX "business_process_risks_riskId_idx" ON "business_process_risks"("riskId");

-- AddForeignKey
ALTER TABLE "risk_controls" ADD CONSTRAINT "risk_controls_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_controls" ADD CONSTRAINT "risk_controls_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_processes" ADD CONSTRAINT "business_processes_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "org_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_processes" ADD CONSTRAINT "business_processes_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_process_risks" ADD CONSTRAINT "business_process_risks_businessProcessId_fkey" FOREIGN KEY ("businessProcessId") REFERENCES "business_processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_process_risks" ADD CONSTRAINT "business_process_risks_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
