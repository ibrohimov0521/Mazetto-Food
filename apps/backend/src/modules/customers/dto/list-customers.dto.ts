import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

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
}
