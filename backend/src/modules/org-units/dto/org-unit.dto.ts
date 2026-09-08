import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateOrgUnitDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;
}

export class UpdateOrgUnitDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
