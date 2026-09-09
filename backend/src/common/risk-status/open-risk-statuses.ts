import { RiskStatus } from '@prisma/client';

/** Every status except CLOSED - shared by dashboard tiles, the heat map, and overdue-review flagging. */
export const OPEN_RISK_STATUSES: RiskStatus[] = [
  RiskStatus.IDENTIFIED,
  RiskStatus.ASSESSED,
  RiskStatus.MITIGATING,
  RiskStatus.ACCEPTED,
];
