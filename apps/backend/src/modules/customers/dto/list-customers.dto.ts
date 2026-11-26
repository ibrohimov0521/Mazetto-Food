import { Type } from "class-transformer";
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";

/*
 * Barcha mijoz va buyurtma ro'yxatlarida ishlatiladigan sahifalash.
 * Standart 50, maksimum 100 — bitta so'rov butun jadvalni yuklamasligi uchun.
 */
export class ListPageDto {
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
  @Max(1_000_000)
  offset = 0;
}

export class ListCustomersDto extends ListPageDto {}

export class ListCustomerDirectoryDto extends ListCustomersDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn(["WEB", "TELEGRAM", "BOTH"])
  channel?: "WEB" | "TELEGRAM" | "BOTH";
}

export class ListOnlineOrdersDto extends ListPageDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export enum CourierOrderStatus {
  READY = "READY",
  SERVED = "SERVED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export class UpdateCourierOrderStatusDto {
  @IsEnum(CourierOrderStatus)
  status!: CourierOrderStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedVersion?: number;

  @IsOptional()
  @IsString()
  @Max(160)
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  shiftId?: string;

  @IsOptional()
  @IsString()
  paymentMethodCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount?: number;
}

export class AssignCourierDto {
  /*
   * `null` — biriktirishni BEKOR QILISH, ya'ni buyurtma yana erkin bo'ladi
   * va uni istalgan kuryer olishi mumkin. Bu asosiy holat: kuryerning
   * telefoni o'chdi yoki u ishdan chiqdi.
   *
   * `ValidateIf` ataylab: `IsOptional` `null` ni ham tashlab yuborardi va
   * "bekor qilish" ni "hech narsa yubormaslik" dan ajratib bo'lmasdi.
   */
  @ValidateIf((_, value) => value !== null)
  @IsString()
  employeeId!: string | null;
}

/*
 * `GET /customer/me/orders` uchun sahifalash (PHASE 6 H10).
 *
 * Bu endpoint mijozning O'Z tarixini qaytaradi, ya'ni filial yoki qidiruv
 * filtri kerak emas — faqat chegara. Standart va maksimum yuqoridagi bilan
 * bir xil, chunki bir xil muammoni yechadi: chegarasiz `findMany` biznes
 * hajmi bilan birga o'sadi.
 */
export class ListCustomerOrdersDto extends ListPageDto {}
