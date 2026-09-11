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

  // Explicit manual override (1-25) for the live-computed residual score -
  // see ResidualScoringService. Omit to let the score be derived from
  // linked Controls (or stay null when there are none yet).
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(25)
  residualScoreOverride?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  nextReviewDate?: Date;
}
