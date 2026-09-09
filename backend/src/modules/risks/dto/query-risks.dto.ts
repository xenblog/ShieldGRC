import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { RiskStatus, ScoreBand } from '@prisma/client';

export const RISK_SORT_FIELDS = [
  'sequenceNumber',
  'title',
  'category',
  'likelihood',
  'impact',
  'inherentScore',
  'residualScore',
  'status',
  'owner',
] as const;
export type RiskSortField = (typeof RISK_SORT_FIELDS)[number];

export class QueryRisksDto {
  @IsOptional()
  @IsString()
  orgUnitId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsEnum(RiskStatus)
  status?: RiskStatus;

  @IsOptional()
  @IsEnum(ScoreBand)
  band?: ScoreBand;

  @IsOptional()
  @IsString()
  ownerId?: string;

  // Exact-cell drill-through from the Risk Heat Map (see HeatMapPage.goToFiltered).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  likelihood?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  impact?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  // 'All' is passed as pageSize=0 by the frontend's rows-per-page selector.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pageSize?: number;

  @IsOptional()
  @IsEnum(RISK_SORT_FIELDS)
  sortBy?: RiskSortField;

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';
}
