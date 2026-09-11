import { OrderStatus, OrderType, PaymentStatus } from "@prisma/client";
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export class ListOrdersDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(OrderType)
  type?: OrderType;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  /*
   * Erkin qidiruv: buyurtma raqami, mijoz ismi/telefoni, manzil va
   * taom nomi. Ilgari admin buyurtmalar ro'yxatida qidiruv UMUMAN
   * yo'q edi — aniq buyurtmani topish uchun 50 tadan varaqlash kerak
   * bo'lardi, holbuki `buildOrderSearchWhere` allaqachon mavjud va
   * kuryer ro'yxatida ishlatilardi.
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  /** Yaratilgan vaqt oralig'i (ISO). Ikkalasi ham ixtiyoriy. */
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}
