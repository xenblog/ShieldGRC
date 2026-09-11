import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { BusinessProcessCriticalityTier } from '@prisma/client';

export class CreateBusinessProcessDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  orgUnitId!: string;

  @IsString()
  ownerId!: string;

  @IsEnum(BusinessProcessCriticalityTier)
  criticalityTier!: BusinessProcessCriticalityTier;

  @IsOptional()
  @IsInt()
  @Min(0)
  rtoMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  rpoMinutes?: number;

  // CIA triad rating (1-3: Low/Medium/High), independent of criticalityTier.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  confidentialityScore?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  integrityScore?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  availabilityScore?: number;
}
