import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  assertCashPaymentMethod,
  assertOpenCashierShift,
  createModifierSnapshot,
  recalculateOrderTotals,
} from "../src/modules/orders/order-guards";

/*
 * Guardlar `tx` ni PARAMETR sifatida oladi, ya'ni ularni soxta
 * tranzaksiya bilan sinash mumkin. Servis metodi bo'lib turganda bu
 * imkonsiz edi — Prisma va butun servis grafi kerak bo'lardi.
 */

type Tx = Prisma.TransactionClient;

test("filialga xos naqd usuli umumiysidan ustun", async () => {
  /*
   * `orderBy: { branchId: "desc" }` `null` ni oxiriga suradi. Filial o'z
   * naqd kassasini sozlagan bo'lsa, o'shanisi olinishi kerak.
   */
  let capturedOrderBy: unknown;
  const tx = {
    paymentMethod: {
      findFirst: async (args: { orderBy: unknown }) => {
        capturedOrderBy = args.orderBy;
        return { id: "pm1", code: "CASH", name: "Naqd" };
      },
    },
  } as unknown as Tx;

  const method = await assertCashPaymentMethod(tx, "b1");
  assert.equal(method.id, "pm1");
  assert.deepEqual(capturedOrderBy, { branchId: "desc" });
});

test("naqd usuli yo'q bo'lsa POS sotuvi to'xtaydi", async () => {
  const tx = {
    paymentMethod: { findFirst: async () => null },
  } as unknown as Tx;

  await assert.rejects(
    () => assertCashPaymentMethod(tx, "b1"),
    BadRequestException,
  );
});

test("ochiq smenasiz POS sotuvi rad etiladi", async () => {
  const tx = {
    shift: { findFirst: async () => null },
  } as unknown as Tx;

  await assert.rejects(
    () => assertOpenCashierShift(tx, "b1", "e1"),
    BadRequestException,
  );
});

test("smena tekshiruv bilan sotuv ORASIDA yopilsa rad etiladi", async () => {
  /*
   * ENG MUHIM SHART. `findFirst` smenani ochiq deb topadi, lekin
   * ular orasida boshqa jarayon uni yopishi mumkin. `updateMany`
   * qatorni qulflaydi va `count` nolga tushadi — o'shanda tushum
   * yopilgan smenaga yozilib ketmasligi kerak.
   */
  const tx = {
    shift: {
      findFirst: async () => ({ id: "s1" }),
      updateMany: async () => ({ count: 0 }),
    },
  } as unknown as Tx;

  await assert.rejects(
    () => assertOpenCashierShift(tx, "b1", "e1"),
    BadRequestException,
  );
});

test("ochiq smena topilsa qaytariladi", async () => {
  const tx = {
    shift: {
      findFirst: async () => ({ id: "s1" }),
      updateMany: async () => ({ count: 1 }),
    },
  } as unknown as Tx;

  assert.deepEqual(await assertOpenCashierShift(tx, "b1", "e1"), { id: "s1" });
});

test("jami summa faqat FAOL qatorlardan hisoblanadi", async () => {
  let capturedWhere: { status?: unknown } = {};
  let written: { subtotal: Prisma.Decimal; total: Prisma.Decimal } | null = null;
  const tx = {
    orderItem: {
      findMany: async (args: { where: { status?: unknown } }) => {
        capturedWhere = args.where;
        return [
          { totalPrice: new Prisma.Decimal(10000) },
          { totalPrice: new Prisma.Decimal(5000) },
        ];
      },
    },
    order: {
      findUnique: async () => ({
        discountTotal: new Prisma.Decimal(1000),
        serviceFeeTotal: new Prisma.Decimal(500),
        deliveryFeeTotal: new Prisma.Decimal(2000),
      }),
      update: async (args: {
        data: { subtotal: Prisma.Decimal; total: Prisma.Decimal };
      }) => {
        written = args.data;
        return {};
      },
    },
  } as unknown as Tx;

  await recalculateOrderTotals(tx, "o1");

  // Bekor qilingan qatorlar chiqarib tashlanishi kerak.
  assert.equal(capturedWhere.status, "ACTIVE");
  assert.ok(written);
  const result = written as unknown as {
    subtotal: Prisma.Decimal;
    total: Prisma.Decimal;
  };
  assert.equal(result.subtotal.toFixed(2), "15000.00");
  // 15000 - 1000 + 500 + 2000
  assert.equal(result.total.toFixed(2), "16500.00");
});

test("buyurtma topilmasa qayta hisoblash to'xtaydi", async () => {
  const tx = {
    orderItem: { findMany: async () => [] },
    order: { findUnique: async () => null },
  } as unknown as Tx;

  await assert.rejects(
    () => recalculateOrderTotals(tx, "yo'q"),
    NotFoundException,
  );
});

test("modifikatorsiz qator tashqi so'rov yubormaydi", async () => {
  let called = false;
  const tx = {
    productModifier: {
      findMany: async () => {
        called = true;
        return [];
      },
    },
  } as unknown as Tx;

  assert.deepEqual(await createModifierSnapshot(tx, "p1", []), []);
  assert.equal(called, false, "bo'sh ro'yxatda bazaga borilmasligi kerak");
});

test("mahsulotga biriktirilmagan modifikator rad etiladi", async () => {
  /*
   * So'ralgan ikkita modifikatordan faqat bittasi topildi. Jimgina
   * tashlansa, mijoz to'lamagan qo'shimchani olardi.
   */
  const tx = {
    productModifier: {
      findMany: async () => [
        {
          modifierId: "m1",
          modifier: {
            id: "m1",
            code: "C1",
            name: "Pishloq",
            price: new Prisma.Decimal(2000),
          },
        },
      ],
    },
  } as unknown as Tx;

  await assert.rejects(
    () =>
      createModifierSnapshot(tx, "p1", [
        { modifierId: "m1" },
        { modifierId: "m2" },
      ] as never),
    BadRequestException,
  );
});

test("snapshot narxni buyurtma paytidagi holatda yozadi", async () => {
  /*
   * Keyin modifikator narxi o'zgarsa, eski buyurtma va uning cheki
   * o'zgarmasligi kerak — shuning uchun narx nusxalanadi.
   */
  const tx = {
    productModifier: {
      findMany: async () => [
        {
          modifierId: "m1",
          modifier: {
            id: "m1",
            code: "CHEESE",
            name: "Pishloq",
            price: new Prisma.Decimal(2000),
          },
        },
      ],
    },
  } as unknown as Tx;

  const snapshot = await createModifierSnapshot(tx, "p1", [
    { modifierId: "m1", quantity: 3 },
  ] as never);

  assert.equal(snapshot.length, 1);
  assert.equal(snapshot[0]?.code, "CHEESE");
  assert.equal(snapshot[0]?.unitPrice, "2000.00");
  assert.equal(snapshot[0]?.quantity, "3.000");
  assert.equal(snapshot[0]?.totalPrice, "6000.00");
});
