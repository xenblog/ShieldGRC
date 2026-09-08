import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TestResult } from '@prisma/client';

export class QueryControlTestsDto {
  @IsOptional()
  @IsEnum(TestResult)
  result?: TestResult;

  @IsOptional()
  @IsString()
  testerId?: string;

  @IsOptional()
  @IsString()
  cycle?: string;

  @IsOptional()
  @IsString()
  orgUnitId?: string;

  @IsOptional()
  @IsString()
  controlId?: string;
}
