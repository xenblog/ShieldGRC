import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
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
}
