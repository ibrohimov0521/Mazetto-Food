import { OrderType } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { OrderItemModifierDto } from "./order-item.dto";

export class PosCheckoutItemDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsNumber()
  @IsPositive()
  @Max(99)
  quantity!: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => OrderItemModifierDto)
  modifiers?: OrderItemModifierDto[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}

/*
 * Kassadagi bitta to'lov bo'lagi ("tender").
 *
 * Nima uchun kod bilan, id bilan emas: kassa ekrani filialning sozlangan
 * usullarini KOD bo'yicha biladi ("CASH", "CARD", ...), id esa filialga
 * qarab farq qiladi. Usulni serverda `code` bo'yicha topish filialga xos
 * sozlamani ham hurmat qiladi (`orderBy: branchId desc`).
 */
export class PosCheckoutTenderDto {
  @IsString()
  @MaxLength(40)
  paymentMethodCode!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  transactionId?: string;
}

export class CreatePosCheckoutDto {
  @IsString()
  @MaxLength(160)
  idempotencyKey!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => PosCheckoutItemDto)
  items!: PosCheckoutItemDto[];

  /*
   * Buyurtma turi. Berilmasa `TAKEAWAY` — eski kassa mijozi bu maydonni
   * yubormaydi va uning xatti-harakati o'zgarmasligi kerak.
   *
   * `DELIVERY` bu endpointda QABUL QILINMAYDI: yetkazish buyurtmasi
   * mijoz manzili va koordinatasini talab qiladi, ularsiz yetkazish
   * narxini hisoblab bo'lmaydi (1 km ichida bepul qoidasi). Narxsiz
   * yozilgan yetkazish mijozdan kam pul olish degani bo'lardi, shuning
   * uchun bu yerda ataylab rad etiladi — qarang `assertPosCheckoutType`.
   */
  @IsOptional()
  @IsEnum(OrderType)
  type?: OrderType;

  /** `DINE_IN` uchun majburiy, boshqa turlarda qabul qilinmaydi. */
  @IsOptional()
  @IsString()
  tableId?: string;

  /*
   * Mijoz bergan naqd pul. FAQAT qaytimni hisoblash uchun — bu summa
   * daromad sifatida yozilmaydi, yozilgani buyurtma summasi bo'ladi.
   *
   * Ilgari majburiy edi va kassani naqd bilan chegaralab qo'yardi. Endi
   * ixtiyoriy: naqd bo'lagi bo'lmagan to'lovda (karta, Click) mantiqiy
   * ma'nosi yo'q.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  cashReceived?: number;

  /*
   * To'lov bo'laklari. Berilmasa eski yo'l ishlaydi: butun summa naqd.
   *
   * Yuqori chegara 4 — kassada to'rttadan ortiq usulni aralashtirish
   * amalda uchramaydi va har bo'lak alohida `Payment` yozuvi yaratadi.
   */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => PosCheckoutTenderDto)
  payments?: PosCheckoutTenderDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
