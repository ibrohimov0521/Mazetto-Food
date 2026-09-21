import assert from "node:assert/strict";
import test from "node:test";
import { ReceiptsService } from "../src/modules/receipts/receipts.service";

const actor = {
  id: "manager-1",
  branchId: "branch-1",
  isGlobalScope: false,
  roles: ["BRANCH_MANAGER"],
  permissions: ["RECEIPT_PRINT"],
};

test("dead-letter print job manual retryda qayta navbatga tushadi", async () => {
  let updateData: Record<string, unknown> | undefined;
  let auditAction: string | undefined;
  const job = {
    id: "job-1",
    branchId: "branch-1",
    receiptId: "receipt-1",
    status: "DEAD_LETTER",
    attemptCount: 5,
    leaseExpiresAt: null,
  };
  const tx = {
    printJob: {
      updateMany: async (args: { data: Record<string, unknown> }) => {
        updateData = args.data;
        return { count: 1 };
      },
    },
    receipt: { update: async () => undefined },
    auditLog: {
      create: async (args: { data: { action: string } }) => {
        auditAction = args.data.action;
      },
    },
  };
  const service = new ReceiptsService({
    printJob: {
      findUnique: async () => job,
    },
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
  } as never);

  await service.retryPrintJob(job.id, actor);

  assert.equal(updateData?.status, "PENDING");
  assert.equal(updateData?.attemptCount, 0);
  assert.equal(updateData?.leaseToken, null);
  assert.equal(auditAction, "PRINT_JOB_RETRIED");
});

test("faol lease bilan chop etilayotgan ish qo'lda qayta yuborilmaydi", async () => {
  const service = new ReceiptsService({
    printJob: {
      findUnique: async () => ({
        id: "job-1",
        branchId: "branch-1",
        receiptId: "receipt-1",
        status: "PROCESSING",
        attemptCount: 1,
        leaseExpiresAt: new Date(Date.now() + 60_000),
      }),
    },
  } as never);

  await assert.rejects(
    () => service.retryPrintJob("job-1", actor),
    /still processing/,
  );
});
