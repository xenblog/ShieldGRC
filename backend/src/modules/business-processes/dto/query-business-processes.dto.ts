import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { BusinessProcessCriticalityTier } from '@prisma/client';

export const BUSINESS_PROCESS_SORT_FIELDS = ['sequenceNumber', 'name', 'criticalityTier', 'rtoMinutes', 'rpoMinutes', 'owner'] as const;
export type BusinessProcessSortField = (typeof BUSINESS_PROCESS_SORT_FIELDS)[number];

export class QueryBusinessProcessesDto {
  @IsOptional()
  @IsString()
  orgUnitId?: string;

  @IsOptional()
  @IsEnum(BusinessProcessCriticalityTier)
  criticalityTier?: BusinessProcessCriticalityTier;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  // 'All' is passed as pageSize=0 (see QueryRisksDto).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pageSize?: number;

  @IsOptional()
  @IsEnum(BUSINESS_PROCESS_SORT_FIELDS)
  sortBy?: BusinessProcessSortField;

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';
}
