-- AlterTable
-- Backs the human-readable "R-001" / "ASS-<year>-001" display codes shown
-- throughout the UI. SERIAL forces a full-table rewrite that calls
-- nextval() once per existing row, so already-seeded risks/assessments get
-- sequential values assigned automatically - no manual backfill needed.
ALTER TABLE "risk_assessments" ADD COLUMN     "sequenceNumber" SERIAL NOT NULL;

-- AlterTable
ALTER TABLE "risks" ADD COLUMN     "sequenceNumber" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "risk_assessments_sequenceNumber_key" ON "risk_assessments"("sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "risks_sequenceNumber_key" ON "risks"("sequenceNumber");
