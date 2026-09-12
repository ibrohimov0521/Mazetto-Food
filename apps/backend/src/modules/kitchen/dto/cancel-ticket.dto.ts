import { IsOptional, IsString, MaxLength } from "class-validator";

/*
 * Oshxona chiptasini bekor qilish SABABI.
 *
 * Ilgari bu endpoint hech qanday tana qabul qilmasdi va servis
 * "Kitchen UI orqali bekor qilindi" degan QAT'IY satrni yozardi.
 * Natijada audit izida nima uchun bekor qilingani hech qachon
 * ko'rinmasdi — holbuki bekor qilish operatsion va moliyaviy voqea.
 *
 * Ixtiyoriy: oshxonada odam tez ishlaydi va sababni majburiy qilish
 * uni "x" yozishga majbur qilardi, ya'ni yozuv qiymatsiz bo'lardi.
 */
export class CancelKitchenTicketDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
