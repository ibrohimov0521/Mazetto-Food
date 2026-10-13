import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import {
  allocateReceiptNumber,
  createReceiptNumber,
  writeReceiptRow,
  type OrderForReceipt,
} from "../src/modules/receipts/receipt-writer";

async function writeOrderNote(
  orderNote: string | null,
  kitchenComment: string | null,
) {
  let receiptContent: Record<string, unknown> | undefined;
  const tx = {
    $executeRaw: async () => 1,
    receipt: {
      findUnique: async () => null,
      create: async ({
        data,
      }: {
        data: { branchId: string; content: Record<string, unknown> };
      }) => {
        receiptContent = data.content;
        return {
          id: "receipt-a",
          branchId: data.branchId,
          content: data.content,
        };
      },
    },
    printer: { findMany: async () => [] },
    printJob: { create: async () => undefined },
  };
  const order = {
    id: "order-a",
    branchId: "branch-a",
    total: new Prisma.Decimal("25000"),
    branch: { name: "Sergeli" },
    orderNumber: 12,
    displayOrderNumber: "WEB12",
    type: "PICKUP",
    source: "ONLINE",
    customerName: null,
    customerPhone: null,
    deliveryAddress: null,
    kitchenComment,
    notes: orderNote,
    items: [],
    payments: [],
  } as unknown as OrderForReceipt;

  await writeReceiptRow(tx as never, order);
  assert.equal(receiptContent?.schemaVersion, 1);
  return receiptContent?.orderNotes;
}

test("receipt notes contain customer text, not generated service instructions", async () => {
  assert.equal(await writeOrderNote(null, "Pickup order"), null);
  assert.equal(
    await writeOrderNote("  Achchiq bo‘lmasin  ", "Delivery: Sergeli"),
    "Achchiq bo‘lmasin",
  );
  assert.equal(await writeOrderNote("  ", "Pickup order"), null);
});

test("receipt numbers contain a 12-character hexadecimal suffix", () => {
  for (let index = 0; index < 50; index += 1) {
    assert.match(createReceiptNumber(), /^RCPT-\d{8}-[A-F0-9]{12}$/);
  }
});

test("receipt number candidates are locked before collision checks", async () => {
  const calls: string[] = [];
  const lockKeys: string[] = [];
  let lookupCount = 0;
  const tx = {
    $executeRaw: async (_sql: TemplateStringsArray, lockKey: string) => {
      calls.push("lock");
      lockKeys.push(lockKey);
      return 1;
    },
    receipt: {
      findUnique: async ({ where }: { where: { receiptNumber: string } }) => {
        calls.push("lookup");
        lookupCount += 1;
        return lookupCount === 1 ? { id: where.receiptNumber } : null;
      },
    },
  };

  const allocated = await allocateReceiptNumber(tx as never);

  assert.equal(lookupCount, 2);
  assert.deepEqual(calls, ["lock", "lookup", "lock", "lookup"]);
  assert.notEqual(lockKeys[0], lockKeys[1]);
  assert.equal(lockKeys[1], `receipt-number:${allocated}`);
});
