import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { AssessmentStatus } from '@prisma/client';

// Deliberately does not extend CreateAssessmentDto: linking risks has its own
// endpoint (PUT /risk-assessments/:id/risks, see LinkRisksDto), and progress
// override is only ever set here, never at creation.
export class UpdateAssessmentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsString()
  orgUnitId?: string;

  @IsOptional()
  @IsString()
  leadAssessorId?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDate?: Date;

  @IsOptional()
  @IsEnum(AssessmentStatus)
  status?: AssessmentStatus;

  // When true, progressManualValue wins over the auto-computed value.
  // Turning it back off recomputes from linked Treatment Actions.
  @IsOptional()
  @IsBoolean()
  progressOverride?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progressManualValue?: number;
}
