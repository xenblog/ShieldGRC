import { IsEnum, IsOptional, IsString } from 'class-validator';
import { UserAccountStatus, UserRole } from '@prisma/client';

export class QueryUsersDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsString()
  orgUnitId?: string;

  @IsOptional()
  @IsEnum(UserAccountStatus)
  status?: UserAccountStatus;

  // Matches against name or email, case-insensitive.
  @IsOptional()
  @IsString()
  search?: string;
}
