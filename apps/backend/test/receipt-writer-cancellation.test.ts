import assert from "node:assert/strict";
import test from "node:test";
import { ensureCancellationReceipt } from "../src/modules/receipts/receipt-writer";

function createHarness() {
  const order = {
    id: "order-a",
    branchId: "branch-a",
    branch: { name: "Sergeli" },
    orderNumber: "M-101",
    displayOrderNumber: "M-101",
    type: "TAKEAWAY",
    source: "POS",
    status: "CANCELLED",
    customerName: "Javohir",
    customerPhone: null,
    deliveryAddress: null,
    notes: null,
    total: { toFixed: () => "36000.00" },
    items: [{
      productName: "Lavash",
      variantName: "Katta",
      quantity: 1,
      totalPrice: { toFixed: () => "36000.00" },
      notes: null,
      modifierSnapshot: null,
    }],
    payments: [{ method: { code: "CASH" }, amount: { toFixed: () => "36000.00" } }],
    receipts: [] as { documentType: string }[],
  };
  const receipts: Record<string, unknown>[] = [];
  const printJobs: Record<string, unknown>[] = [];
  let nextId = 0;
  const tx = {
    order: { findUnique: async () => order },
    receipt: {
      findUnique: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const receipt = { id: "receipt-" + ++nextId, branchId: order.branchId, ...data };
        receipts.push(data);
        order.receipts.push({ documentType: String(data.documentType) });
        return receipt;
      },
    },
    $executeRaw: async () => 1,
    printer: {
      findMany: async () => [{
        id: "cancel-printer",
        type: "THERMAL",
        metadata: { printRoles: ["CANCELLATION"] },
      }],
    },
    printJob: {
      createMany: async ({ data }: { data: Record<string, unknown>[] }) => {
        printJobs.push(...data);
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        printJobs.push(data);
      },
    },
  } as never;
  return { order, printJobs, receipts, tx };
}

test("cancellation receipt is snapshotted and created/queued only once", async () => {
  const state = createHarness();

  await ensureCancellationReceipt(state.tx, state.order.id);
  await ensureCancellationReceipt(state.tx, state.order.id);

  assert.equal(state.receipts.length, 1);
  assert.equal(state.receipts[0]?.documentType, "CANCELLATION");
  const content = state.receipts[0]?.content as Record<string, unknown>;
  assert.equal(content.documentType, "CANCELLATION");
  assert.equal(content.schemaVersion, 1);
  assert.equal(content.cancellationReason, "Buyurtma bekor qilindi");
  assert.deepEqual(content.items, [{
    name: "Lavash",
    variant: "Katta",
    quantity: "1",
    total: "36000.00",
    notes: null,
    modifiers: null,
  }]);
  assert.equal(state.printJobs.length, 1);
  assert.equal(state.printJobs[0]?.printerId, "cancel-printer");
  assert.equal((state.printJobs[0]?.payload as Record<string, unknown>).documentType, "CANCELLATION");
});
