import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { staffRoleCodes, type StaffRoleCode } from "../staff-role-codes";

export class CreateStaffDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsIn(staffRoleCodes)
  roleCode!: StaffRoleCode;

  @IsOptional()
  @IsString()
  branchId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive = true;
}

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @IsString()
  branchId?: string | null;
}

export class UpdateStaffRoleDto {
  @IsIn(staffRoleCodes)
  roleCode!: StaffRoleCode;

  @IsOptional()
  @IsString()
  branchId?: string | null;
}

export class UpdateStaffStatusDto {
  @IsBoolean()
  isActive!: boolean;
}

export class ResetStaffPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

export class ChangeOwnPasswordDto {
  @IsString()
  @MinLength(8)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;

  @IsString()
  @MinLength(8)
  confirmation!: string;
}
