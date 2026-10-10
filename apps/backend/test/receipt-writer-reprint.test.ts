import assert from "node:assert/strict";
import test from "node:test";
import { queuePrintJobsForReceipt } from "../src/modules/receipts/receipt-writer";

test("only an explicit receipt reprint opts out of local replay deduplication", async () => {
  const payloads: unknown[] = [];
  const tx = {
    printer: { findMany: async () => [] },
    printJob: {
      create: async ({ data }: { data: { payload: unknown } }) => {
        payloads.push(data.payload);
      },
    },
  } as never;
  const receipt = {
    id: "receipt-1",
    branchId: "branch-1",
    content: { documentType: "RECEIPT", orderNumber: "M-1", items: [] },
  };

  await queuePrintJobsForReceipt(tx, receipt);
  await queuePrintJobsForReceipt(tx, receipt, { allowLocalReprint: true });

  assert.deepEqual(payloads[0], receipt.content);
  assert.deepEqual(payloads[1], {
    ...receipt.content,
    __bestteamAllowLocalReprint: true,
  });
});
