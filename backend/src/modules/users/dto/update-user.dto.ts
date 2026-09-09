import { ArrayUnique, IsArray, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { UserRole } from '@prisma/client';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  // Only accepted for source=MANUAL accounts - an SSO account's email must
  // keep matching its Entra UPN, so UsersService rejects this otherwise.
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  // Full replacement of the user's org unit membership, not a delta.
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  orgUnitIds?: string[];
}
