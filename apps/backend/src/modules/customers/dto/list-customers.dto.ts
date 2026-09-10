import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  ValidateIf,
} from "class-validator";

/*
 * `GET /customers` va `GET /online-orders` uchun sahifalash.
 *
 * Ikkala endpoint ham hech qanday chegara qo'ymay butun jadvalni qaytarardi
 * va admin panel filtrlashni brauzerda bajarardi. Mijozlar bazasi o'sgani
 * sayin bu javob ham, sahifa ham og'irlashadi.
 *
 * Chegara `ListShiftsDto` bilan bir xil: standart 50, maksimum 100 —
 * so'rov bilan butun jadvalni tortib olishning oldini oladi.
 */
export class ListCustomersDto {
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

export class ListOnlineOrdersDto extends ListCustomersDto {
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
export class ListCustomerOrdersDto extends ListCustomersDto {}
