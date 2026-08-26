import {
  BranchDayOfWeek,
  ProductBranchAvailabilityStatus,
} from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export class BranchWorkingHourDto {
  @IsEnum(BranchDayOfWeek)
  dayOfWeek!: BranchDayOfWeek;

  @IsOptional()
  @IsString()
  @Matches(timePattern)
  opensAt?: string;

  @IsOptional()
  @IsString()
  @Matches(timePattern)
  closesAt?: string;

  @IsOptional()
  @IsBoolean()
  isClosed = false;
}

export class CreateBranchDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  code?: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  isActive = true;

  @IsOptional()
  @IsBoolean()
  isTemporarilyClosed = false;

  @IsOptional()
  @IsBoolean()
  acceptsOrders = true;

  @IsOptional()
  @IsBoolean()
  deliveryEnabled = true;

  @IsOptional()
  @IsBoolean()
  pickupEnabled = true;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder = 0;
}

export class UpdateBranchDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isTemporarilyClosed?: boolean;

  @IsOptional()
  @IsBoolean()
  acceptsOrders?: boolean;

  @IsOptional()
  @IsBoolean()
  deliveryEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  pickupEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class SetBranchWorkingHoursDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchWorkingHourDto)
  hours!: BranchWorkingHourDto[];
}

export class SetProductBranchAvailabilityDto {
  @IsString()
  productId!: string;

  @IsEnum(ProductBranchAvailabilityStatus)
  status!: ProductBranchAvailabilityStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
