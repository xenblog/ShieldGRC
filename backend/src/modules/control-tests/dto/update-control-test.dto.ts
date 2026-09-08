import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateControlTestDto } from './create-control-test.dto';

export class UpdateControlTestDto extends PartialType(OmitType(CreateControlTestDto, ['controlId'] as const)) {}
