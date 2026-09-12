import { IsOptional, IsString, MaxLength } from "class-validator";

/*
 * Mijozning bekor qilish sababi — IXTIYORIY.
 *
 * Majburiy qilinmadi: sabab talab qilinsa, mijoz shoshib "asdf" yozadi
 * va yozuv qiymatsiz bo'ladi. Bo'sh sabab ham holat tarixiga "mijoz
 * bekor qildi" deb yoziladi, ya'ni kim bekor qilgani baribir ma'lum.
 */
export class CancelCustomerOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
