import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { PaymentStatus, Prisma } from "@prisma/client";
import {
  planCashRefunds,
  type RefundablePayment,
} from "../src/modules/payments/refund-ledger";

function payment(
  id: string,
  code: string,
  amount: number,
  status: PaymentStatus = PaymentStatus.SUCCESS,
  refunded: number[] = [],
): RefundablePayment {
  return {
    id,
    orderId: "order-1",
    amount: new Prisma.Decimal(amount),
    status,
    method: { code },
    refunds: refunded.map((value) => ({ amount: new Prisma.Decimal(value) })),
  };
}

test("item cash refund allocates oldest available cash tenders without exceeding their balance", () => {
  const plan = planCashRefunds(
    [
      payment("cash-1", "CASH", 20000, PaymentStatus.PARTIALLY_REFUNDED, [
        5000,
      ]),
      payment("cash-2", "CASH", 30000),
      payment("card", "CARD", 50000),
    ],
    new Prisma.Decimal(40000),
  );

  assert.deepEqual(
    plan.map(({ payment: row, amount }) => [row.id, amount.toFixed(2)]),
    [
      ["cash-1", "15000.00"],
      ["cash-2", "25000.00"],
    ],
  );
});

test("item refund rejects a cash refund when only non-cash tender has refundable value", () => {
  assert.throws(
    () =>
      planCashRefunds(
        [payment("card", "CLICK", 85000)],
        new Prisma.Decimal(12000),
      ),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message.includes(
        "Naqd to'lovlardan qaytarish uchun yetarli qoldiq yo'q",
      ),
  );
});

test("item refund ignores failed and fully refunded cash tenders", () => {
  const plan = planCashRefunds(
    [
      payment("failed", "CASH", 20000, PaymentStatus.FAILED),
      payment("refunded", "CASH", 10000, PaymentStatus.REFUNDED, [10000]),
      payment("available", "CASH", 9000),
    ],
    new Prisma.Decimal(9000),
  );

  assert.equal(plan.length, 1);
  const allocation = plan[0];
  assert.ok(allocation);
  assert.equal(allocation.payment.id, "available");
  assert.equal(allocation.amount.toFixed(2), "9000.00");
});
