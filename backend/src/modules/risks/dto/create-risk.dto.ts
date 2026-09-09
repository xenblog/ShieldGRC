import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { RiskStatus, TreatmentStrategy } from '@prisma/client';

export class CreateRiskDto {
  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsString()
  categoryId!: string;

  @IsString()
  orgUnitId!: string;

  @IsString()
  ownerId!: string;

  @IsOptional()
  @IsEnum(RiskStatus)
  status?: RiskStatus;

  @IsInt()
  @Min(1)
  @Max(5)
  likelihood!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  impact!: number;

  @IsOptional()
  @IsEnum(TreatmentStrategy)
  treatmentStrategy?: TreatmentStrategy;

  @IsOptional()
  @IsString()
  treatmentNote?: string;

  // Manually entered by the risk owner (1-25), not derived from a
  // likelihood/impact pair - see scoring.util.ts for why. Only the band is
  // computed, live, from this value.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(25)
  residualScore?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  nextReviewDate?: Date;
}
