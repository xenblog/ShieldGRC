import { IsString } from 'class-validator';

export class CreateMethodologyVersionDto {
  @IsString()
  contentHtml!: string;
}
