import { DeviceType } from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class EnrollDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  deviceId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  enrollmentCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  softwareVersion?: string;
}

export class CreateDeviceDto {
  @IsString()
  branchId!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsEnum(DeviceType)
  type!: DeviceType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  os?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  ipAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  softwareVersion?: string;
}

export class UpdateDeviceDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEnum(DeviceType)
  type?: DeviceType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  os?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  ipAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  softwareVersion?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
