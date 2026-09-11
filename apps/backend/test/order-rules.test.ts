import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { OrderStatus, OrderType, Prisma } from "@prisma/client";
import {
  assertOrderCanChange,
  assertPosCheckoutQuantities,
  assertPosCheckoutType,
  calculateItemTotal,
  createOrderNumber,
  createPosCheckoutRequestHash,
  createPosIdempotencyKey,
  isRetryableTransactionConflict,
  isUniqueConstraintError,
  normalizePosCheckoutTenders,
  requireEmployee,
  resolveEmployeeId,
  summarizePosPayment,
  toStoredStatus,
  unavailableProductWhere,
} from "../src/modules/orders/order-rules";
import { PosOrderStatus } from "../src/modules/orders/dto/order-status.dto";
import type { CreatePosCheckoutDto } from "../src/modules/orders/dto/pos-checkout.dto";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";

/*
 * Bu qoidalar 1290 qatorlik servis ichida turganda hech qachon
 * to'g'ridan-to'g'ri sinalmagan — pul va idempotentlik bilan
 * bog'liqligiga qaramay.
 */

function checkout(
  overrides: Partial<CreatePosCheckoutDto> = {},
): CreatePosCheckoutDto {
  return {
    cashReceived: 100000,
    items: [{ productId: "p1", quantity: 1 }],
    ...overrides,
  } as CreatePosCheckoutDto;
}

test("idempotentlik kaliti prefikslanadi", () => {
  /*
   * `PaymentOperation` boshqa manbalarning kalitlarini ham saqlaydi;
   * prefikssiz mijoz kaliti POS kaliti bilan to'qnashardi.
   */
  assert.equal(createPosIdempotencyKey("abc"), "POS_CHECKOUT:abc");
});

test("POS miqdori 1 va 99 orasida bo'lishi shart", () => {
  assert.doesNotThrow(() =>
    assertPosCheckoutQuantities(checkout({ items: [{ productId: "p1", quantity: 99 }] } as never)),
  );
  for (const quantity of [0, -1, 100]) {
    assert.throws(
      () =>
        assertPosCheckoutQuantities(
          checkout({ items: [{ productId: "p1", quantity }] } as never),
        ),
      BadRequestException,
      `miqdor ${quantity} rad etilishi kerak edi`,
    );
  }
});

test("modifikator miqdori ham chegaralangan", () => {
  assert.throws(
    () =>
      assertPosCheckoutQuantities(
        checkout({
          items: [
            {
              productId: "p1",
              quantity: 1,
              modifiers: [{ modifierId: "m1", quantity: 100 }],
            },
          ],
        } as never),
      ),
    BadRequestException,
  );
});

test("so'rov hash'i modifikator TARTIBIGA bog'liq emas", () => {
  /*
   * Mijoz modifikatorlarni boshqa tartibda yuborishi mumkin va bu AYNI
   * buyurtma. Saralanmasa, takroriy yuborish "boshqa mazmun" deb
   * qaralib, buyurtma ikki marta tushardi.
   */
  const a = createPosCheckoutRequestHash(
    checkout({
      items: [
        {
          productId: "p1",
          quantity: 1,
          modifiers: [
            { modifierId: "m2", quantity: 1 },
            { modifierId: "m1", quantity: 1 },
          ],
        },
      ],
    } as never),
    "b1",
    "e1",
  );
  const b = createPosCheckoutRequestHash(
    checkout({
      items: [
        {
          productId: "p1",
          quantity: 1,
          modifiers: [
            { modifierId: "m1", quantity: 1 },
            { modifierId: "m2", quantity: 1 },
          ],
        },
      ],
    } as never),
    "b1",
    "e1",
  );
  assert.equal(a, b);
});

test("hash raqam ko'rinishiga bog'liq emas, mazmuniga bog'liq", () => {
  // "5" va "5.00" bir xil summa.
  const a = createPosCheckoutRequestHash(
    checkout({ cashReceived: 5 } as never),
    "b1",
    "e1",
  );
  const b = createPosCheckoutRequestHash(
    checkout({ cashReceived: 5.0 } as never),
    "b1",
    "e1",
  );
  assert.equal(a, b);

  // Boshqa filial = boshqa so'rov.
  assert.notEqual(
    a,
    createPosCheckoutRequestHash(checkout({ cashReceived: 5 } as never), "b2", "e1"),
  );
  // Boshqa summa = boshqa so'rov.
  assert.notEqual(
    a,
    createPosCheckoutRequestHash(checkout({ cashReceived: 6 } as never), "b1", "e1"),
  );
});

test("Prisma xato kodlari to'g'ri ajratiladi", () => {
  const unique = new Prisma.PrismaClientKnownRequestError("dup", {
    code: "P2002",
    clientVersion: "x",
  });
  const conflict = new Prisma.PrismaClientKnownRequestError("conflict", {
    code: "P2034",
    clientVersion: "x",
  });

  assert.equal(isUniqueConstraintError(unique), true);
  assert.equal(isUniqueConstraintError(conflict), false);
  assert.equal(isRetryableTransactionConflict(conflict), true);
  assert.equal(isRetryableTransactionConflict(unique), false);
  // Oddiy xato ikkalasiga ham tushmasligi kerak.
  assert.equal(isUniqueConstraintError(new Error("boom")), false);
  assert.equal(isRetryableTransactionConflict(new Error("boom")), false);
});

test("modifikator narxi miqdorga KO'PAYTIRILADI", () => {
  /*
   * "2 ta burger + pishloq" = (burger + pishloq) x 2. Agar modifikator
   * ko'paytmadan tashqarida qolsa, ikkinchi burgerning pishlog'i tekin
   * ketardi.
   */
  const total = calculateItemTotal(
    new Prisma.Decimal(10000),
    new Prisma.Decimal(2),
    [
      {
        id: "m1",
        code: "CHEESE",
        name: "Pishloq",
        quantity: "1",
        unitPrice: "2000",
        totalPrice: "2000",
      },
    ],
  );
  assert.equal(total.toFixed(2), "24000.00");
});

test("modifikatorsiz narx oddiy ko'paytma", () => {
  assert.equal(
    calculateItemTotal(
      new Prisma.Decimal(1500),
      new Prisma.Decimal(3),
      [],
    ).toFixed(2),
    "4500.00",
  );
});

test("xodim aniqlanmasa rad etiladi", () => {
  const withEmployee = { employeeId: "e1" } as AuthenticatedUser;
  const without = {} as AuthenticatedUser;

  assert.equal(resolveEmployeeId(undefined, withEmployee), "e1");
  // DTO'dagi qiymat ustun.
  assert.equal(resolveEmployeeId("e2", withEmployee), "e2");
  assert.equal(resolveEmployeeId("e2", without), "e2");
  assert.throws(() => resolveEmployeeId(undefined, without), ForbiddenException);

  assert.equal(requireEmployee(withEmployee), "e1");
  assert.throws(() => requireEmployee(without), ForbiddenException);
});

test("yakunlangan va bekor qilingan buyurtma o'zgarmaydi", () => {
  for (const status of [OrderStatus.COMPLETED, OrderStatus.CANCELLED]) {
    assert.throws(() => assertOrderCanChange(status), BadRequestException);
  }
  for (const status of [
    OrderStatus.NEW,
    OrderStatus.CONFIRMED,
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.SERVED,
  ]) {
    assert.doesNotThrow(() => assertOrderCanChange(status));
  }
});

test("POS holati to'liq xaritalanadi", () => {
  /*
   * Har bir POS holati saqlanadigan holatga o'girilishi SHART: biri
   * tushib qolsa `undefined` bazaga yozilardi.
   */
  for (const status of Object.values(PosOrderStatus)) {
    assert.ok(toStoredStatus(status), `${status} xaritalanmagan`);
  }
});

test("mavjudlik yozuvi yo'q mahsulot sotuvda hisoblanadi", () => {
  /*
   * ATAYLAB inkor orqali. Ijobiy filtr har yangi mahsulotni filialga
   * qo'lda qo'shilmaguncha yashirib qo'yardi.
   */
  const where = unavailableProductWhere("b1");
  assert.ok(where.NOT, "shart inkor orqali qurilishi kerak");
  assert.deepEqual(
    (where.NOT as { branchAvailabilities: { some: { status: unknown } } })
      .branchAvailabilities.some.status,
    { in: ["OUT_OF_STOCK", "UNAVAILABLE"] },
  );
});

test("buyurtma raqami o'ziga xos va formatli", () => {
  const numbers = new Set(
    Array.from({ length: 50 }, () => createOrderNumber()),
  );
  for (const value of numbers) {
    assert.match(value, /^POS-\d{8}-\d{6}-\d{4}$/);
  }
  // Bir soniyada yasalgan raqamlar ham asosan farq qilishi kerak.
  assert.ok(numbers.size > 40, `juda ko'p takror: ${numbers.size}/50`);
});

/*
 * KASSA BUYURTMA TURI VA TO'LOV USULLARI.
 *
 * Bu qoidalar pulga tegadi: tur noto'g'ri bo'lsa oshxona buyurtmani
 * noto'g'ri yo'naltiradi, to'lov bo'laklari noto'g'ri bo'lsa kassa
 * hisobi chiqmaydi. Shuning uchun har biri alohida qulflangan.
 */

test("tur berilmasa olib ketish hisoblanadi", () => {
  // Eski kassa mijozi bu maydonni yubormaydi va buzilmasligi kerak.
  assert.equal(assertPosCheckoutType(checkout()), OrderType.TAKEAWAY);
});

test("kassada yetkazib berish rad etiladi", () => {
  /*
   * Yetkazish narxi mijoz koordinatasiga bog'liq, bu endpoint esa
   * manzil qabul qilmaydi. Turni qabul qilib narxni nolga qoldirish
   * mijozdan kam pul olish bo'lardi.
   */
  assert.throws(
    () => assertPosCheckoutType(checkout({ type: OrderType.DELIVERY })),
    BadRequestException,
  );
});

test("zal buyurtmasi stolsiz bo'lmaydi", () => {
  assert.throws(
    () => assertPosCheckoutType(checkout({ type: OrderType.DINE_IN })),
    BadRequestException,
  );
  assert.equal(
    assertPosCheckoutType(
      checkout({ type: OrderType.DINE_IN, tableId: "t1" }),
    ),
    OrderType.DINE_IN,
  );
});

test("olib ketishda stol tanlanmaydi", () => {
  // Aks holda stol band bo'lib qolardi, lekin hech kim o'tirmasdi.
  assert.throws(
    () =>
      assertPosCheckoutType(
        checkout({ type: OrderType.TAKEAWAY, tableId: "t1" }),
      ),
    BadRequestException,
  );
});

test("to'lov bo'laklari berilmasa eski naqd yo'li tanlanadi", () => {
  /*
   * `null` — "server o'zi to'liq summani naqd deb yozadi" degani.
   * Summa faqat serverda ma'lum, shuning uchun bu yerda yasalmaydi.
   */
  assert.equal(normalizePosCheckoutTenders(checkout()), null);
});

test("to'lov usuli kodi bir xil shaklga keltiriladi", () => {
  const tenders = normalizePosCheckoutTenders(
    checkout({ payments: [{ paymentMethodCode: " card ", amount: 1000 }] }),
  );
  assert.equal(tenders?.[0]?.paymentMethodCode, "CARD");
});

test("bir xil to'lov usuli ikki marta rad etiladi", () => {
  /*
   * Bu deyarli har doim kassa ekranidagi xato va u ikkita alohida
   * to'lov yozuvi yaratib hisobotni chalkashtirardi.
   */
  assert.throws(
    () =>
      normalizePosCheckoutTenders(
        checkout({
          payments: [
            { paymentMethodCode: "CASH", amount: 1000 },
            { paymentMethodCode: "cash", amount: 2000 },
          ],
        }),
      ),
    BadRequestException,
  );
});

test("nol yoki manfiy to'lov summasi rad etiladi", () => {
  for (const amount of [0, -100]) {
    assert.throws(
      () =>
        normalizePosCheckoutTenders(
          checkout({ payments: [{ paymentMethodCode: "CASH", amount }] }),
        ),
      BadRequestException,
      `summa ${amount} rad etilishi kerak edi`,
    );
  }
});

test("bo'sh to'lov ro'yxati rad etiladi", () => {
  assert.throws(
    () => normalizePosCheckoutTenders(checkout({ payments: [] })),
    BadRequestException,
  );
});

test("eski yo'lda qaytim naqddan hisoblanadi", () => {
  const summary = summarizePosPayment(
    checkout({ cashReceived: 100000 }),
    new Prisma.Decimal(73000),
  );
  assert.equal(summary.method, "CASH");
  assert.equal(summary.cashReceived, "100000.00");
  assert.equal(summary.change, "27000.00");
  assert.deepEqual(summary.methods, [{ code: "CASH", amount: "73000.00" }]);
});

test("kartada qaytim bo'lmaydi", () => {
  /*
   * Karta bilan to'langan summadan qaytim chiqmaydi. Ilgari javob har
   * doim `cashReceived - total` ni hisoblardi va kartada bu manfiy
   * son chiqarardi.
   */
  /*
   * `cashReceived` ATAYLAB yuborilmaydi — kartada mijoz naqd bermaydi,
   * shuning uchun kassa ekrani bu maydonni umuman qo'shmaydi.
   */
  const summary = summarizePosPayment(
    {
      idempotencyKey: "k1",
      items: [{ productId: "p1", quantity: 1 }],
      payments: [{ paymentMethodCode: "CARD", amount: 73000 }],
    } as CreatePosCheckoutDto,
    new Prisma.Decimal(73000),
  );
  assert.equal(summary.cashReceived, "0.00");
  assert.equal(summary.change, "0.00");
});

test("aralash to'lovda qaytim faqat naqd bo'lagidan hisoblanadi", () => {
  const summary = summarizePosPayment(
    checkout({
      cashReceived: 50000,
      payments: [
        { paymentMethodCode: "CASH", amount: 40000 },
        { paymentMethodCode: "CARD", amount: 33000 },
      ],
    }),
    new Prisma.Decimal(73000),
  );
  assert.equal(summary.change, "10000.00");
  assert.equal(summary.methods.length, 2);
});

test("so'rov hash'i tur, stol va to'lovga bog'liq", () => {
  /*
   * Bir xil idempotentlik kaliti BOSHQA mazmun bilan kelsa, bu takroriy
   * yuborish emas, xato. Bu maydonlar hash'ga kirmasa, kassir turni
   * o'zgartirib qayta yuborganda server eski buyurtmani qaytarardi.
   */
  const base = createPosCheckoutRequestHash(checkout(), "b1", "e1");
  const dineIn = createPosCheckoutRequestHash(
    checkout({ type: OrderType.DINE_IN, tableId: "t1" }),
    "b1",
    "e1",
  );
  const byCard = createPosCheckoutRequestHash(
    checkout({ payments: [{ paymentMethodCode: "CARD", amount: 73000 }] }),
    "b1",
    "e1",
  );
  assert.notEqual(base, dineIn);
  assert.notEqual(base, byCard);
  assert.notEqual(dineIn, byCard);
});

test("so'rov hash'i to'lov TARTIBIGA bog'liq emas", () => {
  // Kassa ekrani bo'laklarni boshqa tartibda yuborishi mumkin.
  const a = createPosCheckoutRequestHash(
    checkout({
      payments: [
        { paymentMethodCode: "CARD", amount: 33000 },
        { paymentMethodCode: "CASH", amount: 40000 },
      ],
    }),
    "b1",
    "e1",
  );
  const b = createPosCheckoutRequestHash(
    checkout({
      payments: [
        { paymentMethodCode: "CASH", amount: 40000 },
        { paymentMethodCode: "CARD", amount: 33000 },
      ],
    }),
    "b1",
    "e1",
  );
  assert.equal(a, b);
});
