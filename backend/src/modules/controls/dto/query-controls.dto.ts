import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ControlEffectiveness, ControlType } from '@prisma/client';

export class QueryControlsDto {
  @IsOptional()
  @IsString()
  orgUnitId?: string;

  @IsOptional()
  @IsString()
  domainCategoryId?: string;

  @IsOptional()
  @IsEnum(ControlType)
  type?: ControlType;

  @IsOptional()
  @IsString()
  frameworkId?: string;

  @IsOptional()
  @IsEnum(ControlEffectiveness)
  effectiveness?: ControlEffectiveness;
}
