import { PartialType } from '@nestjs/mapped-types';
import { CreateTreatmentActionDto } from './create-treatment-action.dto';

export class UpdateTreatmentActionDto extends PartialType(CreateTreatmentActionDto) {}
