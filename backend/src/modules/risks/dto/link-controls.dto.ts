import { ArrayUnique, IsArray, IsString } from 'class-validator';

export class LinkControlsDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  controlIds!: string[];
}
