-- AlterTable
-- Risk Register is explicitly out of scope for NIST CSF (it belongs to the
-- future Control Library's Domain field instead - see Control.nistCsfFunction,
-- which is untouched). Residual scoring switches from a computed
-- likelihood x impact pair to a manually-entered integer: residualScore and
-- residualBand already exist and keep their current values unchanged, so
-- this is a pure column drop with no backfill needed.
ALTER TABLE "risks" DROP COLUMN "nistCsfFunction",
DROP COLUMN "residualImpact",
DROP COLUMN "residualLikelihood";
