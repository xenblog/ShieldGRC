import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateRiskDto } from './create-risk.dto';

export class UpdateRiskDto extends PartialType(CreateRiskDto) {
  // residualScoreOverride is otherwise write-only via a positive value -
  // this is the explicit way to clear it and revert to the computed score
  // (mirrors RiskAssessment.progressOverride's on/off flag).
  @IsOptional()
  @IsBoolean()
  clearResidualOverride?: boolean;
}
