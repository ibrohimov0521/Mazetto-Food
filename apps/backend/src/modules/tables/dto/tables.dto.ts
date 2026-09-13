import { OrderType, TableStatus } from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CreateHallDto {
  @IsString()
  branchId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder = 0;
}

export class CreateTableDto {
  @IsString()
  branchId!: string;

  @IsString()
  hallId!: string;

  @IsInt()
  @Min(1)
  number!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsInt()
  @Min(1)
  capacity!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateTableStatusDto {
  @IsEnum(TableStatus)
  status!: TableStatus;
}

export class UpdateHallDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  /** `false` bo'lsa zal arxivlanadi, qatorlari o'chirilmaydi. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTableDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  number?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  /** `false` bo'lsa stol arxivlanadi, buyurtma tarixi saqlanadi. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateTableOrderDto {
  @IsOptional()
  @IsEnum(OrderType)
  type: OrderType = OrderType.DINE_IN;

  @IsOptional()
  @IsInt()
  @Min(1)
  guestCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
