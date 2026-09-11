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

  // Individual Framework clauses this control satisfies (e.g. ISO 27001:2022
  // "A.5.1"), not whole Frameworks - see FrameworkControl.
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  frameworkControlIds?: string[];
}
