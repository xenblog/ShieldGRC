/**
 * Human-readable display codes ("R-001", "ASS-2026-001") shown throughout
 * the UI (tables, badges, breadcrumbs, matrix chips). Backed by an
 * auto-incrementing sequenceNumber column - never used for lookups, only
 * for display, so no uniqueness/parsing guarantees are needed beyond that.
 */
export function riskDisplayCode(sequenceNumber: number): string {
  return `R-${String(sequenceNumber).padStart(3, '0')}`;
}

export function assessmentDisplayCode(sequenceNumber: number, startDate: Date): string {
  return `ASS-${startDate.getFullYear()}-${String(sequenceNumber).padStart(3, '0')}`;
}

export function businessProcessDisplayCode(sequenceNumber: number): string {
  return `BP-${String(sequenceNumber).padStart(3, '0')}`;
}
