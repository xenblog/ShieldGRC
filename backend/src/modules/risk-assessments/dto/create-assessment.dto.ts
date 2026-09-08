import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsDate, IsEnum, IsOptional, IsString } from 'class-validator';
import { AssessmentStatus } from '@prisma/client';

export class CreateAssessmentDto {
  @IsString()
  name!: string;

  @IsString()
  scope!: string;

  @IsString()
  orgUnitId!: string;

  @IsString()
  leadAssessorId!: string;

  @Type(() => Date)
  @IsDate()
  startDate!: Date;

  @Type(() => Date)
  @IsDate()
  dueDate!: Date;

  @IsOptional()
  @IsEnum(AssessmentStatus)
  status?: AssessmentStatus;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  riskIds?: string[];
}
