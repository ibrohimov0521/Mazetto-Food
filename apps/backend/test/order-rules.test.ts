import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import {
  assertOrderCanChange,
  assertPosCheckoutQuantities,
  calculateItemTotal,
  createOrderNumber,
  createPosCheckoutRequestHash,
  createPosIdempotencyKey,
  isRetryableTransactionConflict,
  isUniqueConstraintError,
  requireEmployee,
  resolveEmployeeId,
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
