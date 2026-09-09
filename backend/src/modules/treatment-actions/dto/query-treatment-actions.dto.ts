import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString } from 'class-validator';
import { TreatmentActionStatus } from '@prisma/client';

export class QueryTreatmentActionsDto {
  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsEnum(TreatmentActionStatus)
  status?: TreatmentActionStatus;

  @IsOptional()
  @IsString()
  orgUnitId?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueBefore?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueAfter?: Date;
}
