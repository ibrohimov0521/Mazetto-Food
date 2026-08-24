import { OrderType } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, IsPositive, IsString, MaxLength } from "class-validator";

export class CreateOrderDto {
  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  tableId?: string;

  @IsEnum(OrderType)
  type!: OrderType;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  customerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  customerPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  deliveryAddress?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  guestCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  kitchenComment?: string;
}
