import { PartialType } from '@nestjs/mapped-types';
import { CreateBusinessProcessDto } from './create-business-process.dto';

export class UpdateBusinessProcessDto extends PartialType(CreateBusinessProcessDto) {}
