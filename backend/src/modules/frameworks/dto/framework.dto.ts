import { IsOptional, IsString } from 'class-validator';

export class CreateFrameworkDto {
  @IsString()
  name!: string;

  @IsString()
  description!: string;

  @IsString()
  orgUnitId!: string;

  @IsString()
  ownerId!: string;
}

export class UpdateFrameworkDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  orgUnitId?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;
}
