import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { ShiftsService } from "../src/modules/shifts/shifts.service";

test("smena hisobotida Uzcard va Humo terminalga, naqd esa kassaga yoziladi", () => {
  const service = new ShiftsService({} as never);
  const calculate = (
    service as unknown as {
      calculateShiftTotals: (
        payments: {
          amount: Prisma.Decimal;
          method: { code: string };
        }[],
        cashTransactions: never[],
        orderCount: number,
      ) => Record<string, Prisma.Decimal | number>;
    }
  ).calculateShiftTotals.bind(service);
  const totals = calculate(
    [
      { amount: new Prisma.Decimal(10000), method: { code: "CASH" } },
      { amount: new Prisma.Decimal(20000), method: { code: "CARD" } },
      { amount: new Prisma.Decimal(30000), method: { code: "UZCARD" } },
      { amount: new Prisma.Decimal(40000), method: { code: "HUMO" } },
      { amount: new Prisma.Decimal(5000), method: { code: "CLICK" } },
      { amount: new Prisma.Decimal(7000), method: { code: "ONLINE" } },
    ],
    [],
    6,
  );

  assert.equal((totals.cashTotal as Prisma.Decimal).toFixed(0), "10000");
  assert.equal((totals.terminalTotal as Prisma.Decimal).toFixed(0), "90000");
  assert.equal((totals.clickTotal as Prisma.Decimal).toFixed(0), "5000");
  assert.equal((totals.otherPaymentTotal as Prisma.Decimal).toFixed(0), "7000");
  assert.equal(totals.orderCount, 6);
});
