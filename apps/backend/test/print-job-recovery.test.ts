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
    branch: { findUnique: async () => ({ tenantId: "tenant-a" }) },
    printJob: {
      findFirst: async () => job,
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
    branch: { findUnique: async () => ({ tenantId: "tenant-a" }) },
    printJob: {
      findFirst: async () => ({
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

test("ambiguous printer timeout goes to dead letter without automatic reprint", async () => {
  let jobUpdate: Record<string, unknown> | undefined;
  let attemptUpdate: Record<string, unknown> | undefined;
  const job = {
    id: "job-ambiguous",
    branchId: "branch-1",
    receiptId: "receipt-1",
    status: "PROCESSING",
    attemptCount: 1,
    maxAttempts: 5,
    leaseExpiresAt: new Date(Date.now() + 60_000),
  };
  const tx = {
    printJob: {
      updateMany: async (args: { data: Record<string, unknown> }) => {
        jobUpdate = args.data;
        return { count: 1 };
      },
    },
    printAttempt: {
      update: async (args: { data: Record<string, unknown> }) => {
        attemptUpdate = args.data;
      },
    },
  };
  const service = new ReceiptsService({
    branch: { findUnique: async () => ({ tenantId: "tenant-a" }) },
    printJob: {
      findFirst: async () => job,
      findUnique: async () => job,
    },
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
  } as never);

  await service.failPrintJob(
    job.id,
    "lease-token-with-enough-length",
    "Windows printer callback timed out",
    actor,
    "AMBIGUOUS",
  );

  assert.equal(jobUpdate?.status, "DEAD_LETTER");
  assert.ok(jobUpdate?.nextAttemptAt instanceof Date);
  assert.equal(jobUpdate?.leaseToken, null);
  assert.equal(attemptUpdate?.outcome, "AMBIGUOUS");
  assert.match(String(attemptUpdate?.error), /timed out/);
});

test("driver acceptance is recorded as submitted, not as paper printed", async () => {
  let jobUpdate: Record<string, unknown> | undefined;
  let attemptUpdate: Record<string, unknown> | undefined;
  let receiptUpdated = false;
  const job = {
    id: "job-submitted",
    branchId: "branch-1",
    receiptId: "receipt-1",
    status: "PROCESSING",
    attemptCount: 1,
    leaseExpiresAt: new Date(Date.now() + 60_000),
  };
  const tx = {
    printJob: {
      updateMany: async (args: { data: Record<string, unknown> }) => {
        jobUpdate = args.data;
        return { count: 1 };
      },
    },
    printAttempt: {
      update: async (args: { data: Record<string, unknown> }) => {
        attemptUpdate = args.data;
      },
    },
    receipt: { update: async () => { receiptUpdated = true; } },
  };
  const service = new ReceiptsService({
    branch: { findUnique: async () => ({ tenantId: "tenant-a" }) },
    printJob: {
      findFirst: async () => job,
      findUnique: async () => ({ ...job, status: "SUBMITTED" }),
    },
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
  } as never);

  await service.completePrintJob(job.id, "lease-token-with-enough-length", actor);

  assert.equal(jobUpdate?.status, "SUBMITTED");
  assert.ok(jobUpdate?.submittedAt instanceof Date);
  assert.equal(jobUpdate?.printedAt, null);
  assert.equal(attemptUpdate?.outcome, "SUBMITTED");
  assert.equal(receiptUpdated, false);
});

test("driver-submitted print jobs cannot be automatically retried", async () => {
  const service = new ReceiptsService({
    branch: { findUnique: async () => ({ tenantId: "tenant-a" }) },
    printJob: {
      findFirst: async () => ({
        id: "job-submitted",
        branchId: "branch-1",
        receiptId: "receipt-1",
        status: "SUBMITTED",
        attemptCount: 1,
        leaseExpiresAt: null,
      }),
    },
  } as never);

  await assert.rejects(
    () => service.retryPrintJob("job-submitted", actor),
    /Completed print job cannot be retried/,
  );
});
