import { ArrayUnique, IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { ControlFrequency, ControlType, NistCsfFunction } from '@prisma/client';

export class CreateControlDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsString()
  domainCategoryId!: string;

  @IsOptional()
  @IsEnum(NistCsfFunction)
  nistCsfFunction?: NistCsfFunction;

  @IsString()
  orgUnitId!: string;

  @IsEnum(ControlType)
  type!: ControlType;

  @IsEnum(ControlFrequency)
  frequency!: ControlFrequency;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  frameworkIds?: string[];
}
