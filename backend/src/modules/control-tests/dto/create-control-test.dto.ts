import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString } from 'class-validator';
import { TestMethod, TestResult } from '@prisma/client';

export class CreateControlTestDto {
  @IsString()
  controlId!: string;

  @IsEnum(TestResult)
  result!: TestResult;

  @IsEnum(TestMethod)
  testMethod!: TestMethod;

  @IsString()
  testerId!: string;

  @IsString()
  cycle!: string;

  @Type(() => Date)
  @IsDate()
  testedDate!: Date;

  @Type(() => Date)
  @IsDate()
  dueDate!: Date;

  @IsOptional()
  @IsString()
  exceptionNotes?: string;
}
