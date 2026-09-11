import { ArrayUnique, IsArray, IsString } from 'class-validator';

export class LinkDependenciesDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  dependsOnIds!: string[];
}
