import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { RiskStatus, ScoreBand } from '@prisma/client';

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
}
