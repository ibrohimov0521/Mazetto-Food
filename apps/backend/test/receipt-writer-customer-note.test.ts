import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import {
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
