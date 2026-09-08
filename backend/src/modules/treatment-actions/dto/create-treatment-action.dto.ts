import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString } from 'class-validator';
import { TreatmentActionStatus } from '@prisma/client';

export class CreateTreatmentActionDto {
  @IsString()
  description!: string;

  @IsString()
  riskId!: string;

  // A treatment action is usually created inside an Assessment, but can also
  // be created directly from a Risk without one (see README/spec).
  @IsOptional()
  @IsString()
  assessmentId?: string;

  @IsString()
  ownerId!: string;

  @IsOptional()
  @IsEnum(TreatmentActionStatus)
  status?: TreatmentActionStatus;

  @Type(() => Date)
  @IsDate()
  dueDate!: Date;
}
