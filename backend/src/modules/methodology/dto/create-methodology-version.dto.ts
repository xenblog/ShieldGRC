import { IsString, IsNotEmpty } from 'class-validator';

export class CreateMethodologyVersionDto {
  @IsString()
  @IsNotEmpty()
  frameworkReference!: string;

  @IsString()
  contentHtml!: string;
}
