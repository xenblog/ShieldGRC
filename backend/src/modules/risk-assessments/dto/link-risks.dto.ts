import { ArrayUnique, IsArray, IsString } from 'class-validator';

export class LinkRisksDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  riskIds!: string[];
}
