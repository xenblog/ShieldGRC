import { IsOptional, IsString } from 'class-validator';

export class CreateFrameworkControlDto {
  @IsString()
  frameworkId!: string;

  // e.g. "A.5.1" (ISO 27001 Annex A), "Art. 32" (GDPR) - unique within its Framework.
  @IsString()
  code!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateFrameworkControlDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
