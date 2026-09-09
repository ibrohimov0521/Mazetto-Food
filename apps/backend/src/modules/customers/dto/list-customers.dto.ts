import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

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

/*
 * `GET /customer/me/orders` uchun sahifalash (PHASE 6 H10).
 *
 * Bu endpoint mijozning O'Z tarixini qaytaradi, ya'ni filial yoki qidiruv
 * filtri kerak emas — faqat chegara. Standart va maksimum yuqoridagi bilan
 * bir xil, chunki bir xil muammoni yechadi: chegarasiz `findMany` biznes
 * hajmi bilan birga o'sadi.
 */
export class ListCustomerOrdersDto extends ListCustomersDto {}
