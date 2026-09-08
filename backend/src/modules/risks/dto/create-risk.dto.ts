import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { NistCsfFunction, RiskStatus, TreatmentStrategy } from '@prisma/client';

export class CreateRiskDto {
  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsString()
  categoryId!: string;

  @IsOptional()
  @IsEnum(NistCsfFunction)
  nistCsfFunction?: NistCsfFunction;

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

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  residualLikelihood?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  residualImpact?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  nextReviewDate?: Date;
}
