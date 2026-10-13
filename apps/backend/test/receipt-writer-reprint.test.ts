import assert from "node:assert/strict";
import test from "node:test";
import { queuePrintJobsForReceipt } from "../src/modules/receipts/receipt-writer";

test("only an explicit receipt reprint opts out of local replay deduplication", async () => {
  const payloads: unknown[] = [];
  const tx = {
    $executeRaw: async () => 1,
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
test("printer target is rechecked after the deletion lock", async () => {
  const filters: Record<string, unknown>[] = [];
  const jobs: { printerId: string | null }[] = [];
  let printerReads = 0;
  let lockCount = 0;
  const tx = {
    $executeRaw: async () => {
      lockCount += 1;
      return 1;
    },
    printer: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        filters.push(args.where);
        printerReads += 1;
        return printerReads === 1
          ? [
              {
                id: "printer-a",
                type: "RECEIPT",
                metadata: { printRoles: ["RECEIPT"] },
              },
            ]
          : [];
      },
    },
    printJob: {
      create: async ({ data }: { data: { printerId: string | null } }) => {
        jobs.push(data);
      },
    },
  };
  const receipt = {
    id: "receipt-a",
    branchId: "branch-a",
    content: { documentType: "RECEIPT" },
  };

  await queuePrintJobsForReceipt(tx as never, receipt);

  assert.equal(lockCount, 2, "receipt and printer queue locks are held");
  assert.deepEqual(
    jobs.map((job) => job.printerId),
    [null],
  );
  assert.deepEqual(filters[1], {
    branchId: "branch-a",
    isActive: true,
    id: { in: ["printer-a"] },
  });
});
