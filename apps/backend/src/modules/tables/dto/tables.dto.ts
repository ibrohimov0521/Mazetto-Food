import { OrderType, TableStatus } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateHallDto {
  @IsString()
  branchId!: string;

  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
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
  @MaxLength(100)
  name!: string;

  @IsInt()
  @Min(1)
  capacity!: number;
}

export class UpdateTableStatusDto {
  @IsEnum(TableStatus)
  status!: TableStatus;
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
