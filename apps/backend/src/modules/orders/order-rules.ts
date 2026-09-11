import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { OrderStatus, OrderType, Prisma } from "@prisma/client";
import { createHash, randomInt } from "node:crypto";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PosOrderStatus } from "./dto/order-status.dto";
import type { CreatePosCheckoutDto } from "./dto/pos-checkout.dto";

/*
 * Buyurtma QOIDALARI: tekshiruv, hisoblash, kalit yasash va so'rov
 * shakllari.
 *
 * NIMA UCHUN AJRATILDI. `orders.service.ts` 1290 qator edi va bu
 * funksiyalar na bazaga, na tranzaksiyaga murojaat qiladi. Servis
 * ichida turganda ular alohida sinalmasdi — masalan POS miqdor
 * chegarasi yoki idempotentlik hash'ining barqarorligi hech qachon
 * to'g'ridan-to'g'ri tekshirilmagan.
 *
 * BU YERGA FAQAT SOF FUNKSIYA TUSHADI: `this` ham, `tx` ham yo'q.
 */

export type ModifierSnapshot = {
  id: string;
  code: string;
  name: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
};

/*
 * POS checkout idempotentlik kaliti prefiks bilan yoziladi, chunki
 * `PaymentOperation` jadvali boshqa manbalarning kalitlarini ham
 * saqlaydi — prefikssiz mijoz kaliti POS kaliti bilan to'qnashishi
 * mumkin edi.
 */
export function createPosIdempotencyKey(idempotencyKey: string): string {
  return `POS_CHECKOUT:${idempotencyKey}`;
}

/*
 * Yuqori chegara 99 — bu texnik cheklov emas, XATODAN himoya: kassada
 * miqdor qo'lda teriladi va tasodifan qo'shilgan nol butun smenani
 * buzardi.
 */
export function assertPosCheckoutQuantities(dto: CreatePosCheckoutDto): void {
  for (const item of dto.items) {
    if (item.quantity <= 0 || item.quantity > 99) {
      throw new BadRequestException(
        "POS item quantity must be between 1 and 99",
      );
    }

    for (const modifier of item.modifiers ?? []) {
      const quantity = modifier.quantity ?? 1;

      if (quantity <= 0 || quantity > 99) {
        throw new BadRequestException(
          "POS modifier quantity must be between 1 and 99",
        );
      }
    }
  }
}

/*
 * Kassa buyurtma turi.
 *
 * `DELIVERY` ataylab rad etiladi: yetkazish narxi mijoz koordinatasiga
 * bog'liq (1 km ichida bepul, undan keyin sozlamadagi narx), bu endpoint
 * esa manzil ham, koordinata ham qabul qilmaydi. Turni qabul qilib,
 * narxni nolga qoldirish mijozdan KAM PUL olish degani bo'lardi.
 *
 * `DINE_IN` stolsiz bo'lmaydi: aks holda ovqat kimga tayyorlanganini
 * oshxona ham, ofitsiant ham bilmaydi.
 */
export function assertPosCheckoutType(dto: CreatePosCheckoutDto): OrderType {
  const type = dto.type ?? OrderType.TAKEAWAY;

  if (type === OrderType.DELIVERY) {
    throw new BadRequestException(
      "Yetkazib berish buyurtmasi kassa checkout'ida qabul qilinmaydi",
    );
  }

  if (type === OrderType.DINE_IN && !dto.tableId) {
    throw new BadRequestException("Zal buyurtmasi uchun stol tanlanishi shart");
  }

  if (type !== OrderType.DINE_IN && dto.tableId) {
    throw new BadRequestException("Stol faqat zal buyurtmasida tanlanadi");
  }

  return type;
}

/** Kod bo'yicha qidirish uchun bir xil shaklga keltirish. */
export function normalizePaymentMethodCode(code: string): string {
  return code.trim().toUpperCase();
}

export type NormalizedPosTender = {
  paymentMethodCode: string;
  amount: Prisma.Decimal;
  transactionId: string | null;
};

/*
 * To'lov bo'laklarini tekshirish va normallashtirish.
 *
 * `payments` berilmasa — eski yo'l: butun summa naqd. Bu holat `null`
 * bilan ifodalanadi, chunki summa faqat SERVERDA (mahsulot narxlari
 * hisoblangandan keyin) ma'lum bo'ladi.
 *
 * Bir xil usul ikki marta kelishi rad etiladi: bu deyarli har doim
 * kassa ekranidagi xato, va u ikkita alohida `Payment` yozuvini
 * yaratib, hisobotni chalkashtirardi.
 */
export function normalizePosCheckoutTenders(
  dto: CreatePosCheckoutDto,
): NormalizedPosTender[] | null {
  if (!dto.payments) return null;

  if (!dto.payments.length) {
    throw new BadRequestException("Kamida bitta to'lov usuli kerak");
  }

  const seen = new Set<string>();

  return dto.payments.map((tender) => {
    const code = normalizePaymentMethodCode(tender.paymentMethodCode);

    if (!code) {
      throw new BadRequestException("To'lov usuli ko'rsatilmagan");
    }

    if (seen.has(code)) {
      throw new BadRequestException(
        "Bir xil to'lov usuli ikki marta yuborilgan",
      );
    }

    seen.add(code);
    const amount = new Prisma.Decimal(tender.amount);

    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException("To'lov summasi noldan katta bo'lishi kerak");
    }

    return {
      paymentMethodCode: code,
      amount,
      transactionId: tender.transactionId ?? null,
    };
  });
}

export type PosPaymentSummary = {
  /** Asosiy usul kodi — eski kassa mijozi shu maydonni o'qiydi. */
  method: string;
  methods: { code: string; amount: string }[];
  cashReceived: string;
  change: string;
};

/*
 * Kassa javobidagi to'lov xulosasi.
 *
 * SOF FUNKSIYA, ataylab: bu xulosa ikki joyda kerak — yangi buyurtma
 * yaratilganda va TAKRORIY so'rov kelganda. Takroriy yo'lda bazada
 * qayta o'qish o'rniga shu yerda qayta hisoblanadi, chunki `requestHash`
 * mos tushgani so'rov mazmuni aynan bir xil ekanini kafolatlaydi.
 *
 * Qaytim FAQAT naqd bo'lagidan hisoblanadi: karta bilan to'langan
 * summadan qaytim bo'lmaydi.
 */
export function summarizePosPayment(
  dto: CreatePosCheckoutDto,
  orderTotal: Prisma.Decimal,
): PosPaymentSummary {
  const tenders = dto.payments?.length
    ? dto.payments.map((tender) => ({
        code: normalizePaymentMethodCode(tender.paymentMethodCode),
        amount: new Prisma.Decimal(tender.amount),
      }))
    : [{ code: "CASH", amount: orderTotal }];
  const cashTender = tenders.find((tender) => tender.code === "CASH");
  const cashReceived = cashTender
    ? new Prisma.Decimal(dto.cashReceived ?? cashTender.amount)
    : new Prisma.Decimal(0);
  const change = cashTender
    ? cashReceived.sub(cashTender.amount)
    : new Prisma.Decimal(0);

  return {
    method: tenders[0]?.code ?? "CASH",
    methods: tenders.map((tender) => ({
      code: tender.code,
      amount: tender.amount.toFixed(2),
    })),
    cashReceived: cashReceived.toFixed(2),
    change: change.toFixed(2),
  };
}

/*
 * So'rov hash'i idempotentlik uchun: bir xil kalit BOSHQA mazmun bilan
 * kelsa, bu takroriy yuborish emas, xato — va uni aniqlash kerak.
 *
 * NORMALLASHTIRISH SHART: `Decimal` ning `toFixed` i "5" va "5.00" ni
 * bir xil qiladi, modifikatorlar esa saralanadi, chunki mijoz ularni
 * boshqa tartibda yuborishi mumkin va bu bir xil buyurtma.
 *
 * Tur, stol va to'lov bo'laklari ham hash'ga KIRADI: ular buyurtmaning
 * mazmuni, va bir xil kalit bilan boshqa tur yoki boshqa to'lov usuli
 * kelsa, bu takroriy yuborish emas.
 */
export function createPosCheckoutRequestHash(
  dto: CreatePosCheckoutDto,
  branchId: string,
  employeeId: string,
): string {
  const normalized = {
    branchId,
    employeeId,
    type: dto.type ?? OrderType.TAKEAWAY,
    tableId: dto.tableId ?? null,
    cashReceived:
      dto.cashReceived === undefined
        ? null
        : new Prisma.Decimal(dto.cashReceived).toFixed(2),
    payments: dto.payments
      ? dto.payments
          .map((tender) => ({
            paymentMethodCode: normalizePaymentMethodCode(
              tender.paymentMethodCode,
            ),
            amount: new Prisma.Decimal(tender.amount).toFixed(2),
            transactionId: tender.transactionId ?? null,
          }))
          .sort((left, right) =>
            left.paymentMethodCode.localeCompare(right.paymentMethodCode),
          )
      : null,
    notes: dto.notes ?? null,
    items: dto.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId ?? null,
      quantity: new Prisma.Decimal(item.quantity).toFixed(3),
      notes: item.notes ?? null,
      modifiers: (item.modifiers ?? [])
        .map((modifier) => ({
          modifierId: modifier.modifierId,
          quantity: new Prisma.Decimal(modifier.quantity ?? 1).toFixed(3),
        }))
        .sort((left, right) => left.modifierId.localeCompare(right.modifierId)),
    })),
  };

  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

/** P2002 — unikal cheklov buzilishi. */
export function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/*
 * P2034 — tranzaksiya to'qnashuvi (write conflict / deadlock). Bu
 * XATO EMAS, qayta urinish signali: PostgreSQL bir vaqtda kelgan ikki
 * yozuvdan birini rad etadi va u qayta yuborilishi kerak.
 */
export function isRetryableTransactionConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

/*
 * Modifikator narxi MIQDORGA ko'paytirilmasdan oldin qo'shiladi:
 * "2 ta burger + pishloq" = (burger + pishloq) x 2, ya'ni har bir
 * burgerga pishloq qo'shiladi.
 */
export function calculateItemTotal(
  unitPrice: Prisma.Decimal,
  quantity: Prisma.Decimal,
  modifiers: ModifierSnapshot[],
) {
  const modifierTotal = modifiers.reduce(
    (total, modifier) => total.add(new Prisma.Decimal(modifier.totalPrice)),
    new Prisma.Decimal(0),
  );

  return unitPrice.add(modifierTotal).mul(quantity);
}

/** Buyurtma o'qishda BIR XIL shakl — javob tuzilishi joydan joyga farq qilmasin. */
export function orderInclude() {
  return {
    branch: { select: { id: true, code: true, name: true } },
    table: { select: { id: true, code: true, name: true } },
    createdBy: { select: { id: true, firstName: true, lastName: true } },
    acceptedBy: { select: { id: true, firstName: true, lastName: true } },
    closedBy: { select: { id: true, firstName: true, lastName: true } },
    items: {
      orderBy: { createdAt: "asc" },
    },
    payments: {
      orderBy: { createdAt: "asc" },
      include: {
        method: { select: { id: true, code: true, name: true } },
      },
    },
    statusHistory: {
      orderBy: { createdAt: "asc" },
      include: {
        changedByEmployee: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true },
        },
        changedByUser: {
          select: { id: true, displayName: true, email: true },
        },
      },
    },
  } satisfies Prisma.OrderInclude;
}

/*
 * DTO'dagi xodim ustun, aks holda tizimga kirgan foydalanuvchi.
 * Ikkalasi ham bo'lmasa — xato: buyurtma egasi ANIQ bo'lishi kerak.
 */
export function resolveEmployeeId(
  dtoEmployeeId: string | undefined,
  user: AuthenticatedUser,
): string {
  const employeeId = dtoEmployeeId ?? user.employeeId;

  if (!employeeId) {
    throw new ForbiddenException(
      "Authenticated user is not linked to an employee",
    );
  }

  return employeeId;
}

export function requireEmployee(user: AuthenticatedUser): string {
  if (!user.employeeId) {
    throw new ForbiddenException(
      "Authenticated user is not linked to an employee",
    );
  }

  return user.employeeId;
}

/*
 * Yakunlangan va bekor qilingan buyurtma O'ZGARMAYDI: ular hisobotga,
 * smenaga va kassaga allaqachon kirgan.
 */
export function assertOrderCanChange(status: OrderStatus): void {
  if (status === OrderStatus.COMPLETED || status === OrderStatus.CANCELLED) {
    throw new BadRequestException(
      "Completed or cancelled orders cannot be changed",
    );
  }
}

export function toStoredStatus(status: PosOrderStatus): OrderStatus {
  const statusMap: Record<PosOrderStatus, OrderStatus> = {
    [PosOrderStatus.NEW]: OrderStatus.NEW,
    [PosOrderStatus.CONFIRMED]: OrderStatus.CONFIRMED,
    [PosOrderStatus.PREPARING]: OrderStatus.PREPARING,
    [PosOrderStatus.READY]: OrderStatus.READY,
    [PosOrderStatus.SERVED]: OrderStatus.SERVED,
    [PosOrderStatus.COMPLETED]: OrderStatus.COMPLETED,
    [PosOrderStatus.CANCELLED]: OrderStatus.CANCELLED,
  };

  return statusMap[status];
}

/*
 * ATAYLAB inkor orqali: mavjudlik yozuvi UMUMAN yo'q mahsulot ham
 * sotuvda hisoblanadi. Ijobiy filtr (`status: AVAILABLE`) har yangi
 * mahsulotni filialga qo'lda qo'shilmaguncha yashirib qo'yardi.
 */
export function unavailableProductWhere(
  branchId: string,
): Prisma.ProductWhereInput {
  return {
    NOT: {
      branchAvailabilities: {
        some: {
          branchId,
          status: { in: ["OUT_OF_STOCK", "UNAVAILABLE"] },
        },
      },
    },
  };
}

/*
 * POS buyurtma raqami. Sana UTC bo'yicha olinadi, ya'ni Toshkent vaqti
 * bilan 00:00-05:00 orasidagi buyurtma raqamida OLDINGI kun turadi.
 * Bu raqam identifikator sifatida ishlatiladi (hisobot sanasi
 * `createdAt` dan olinadi), shuning uchun xatti-harakat saqlab
 * qolindi — lekin bilib turish kerak.
 */
export function createOrderNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const time = now.toISOString().slice(11, 19).replaceAll(":", "");

  return `POS-${date}-${time}-${randomInt(1000, 10000)}`;
}
