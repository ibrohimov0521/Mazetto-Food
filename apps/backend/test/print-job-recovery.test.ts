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

test("kitchen-only agent leaves receipt jobs for another printer", async () => {
  let where: Record<string, unknown> | undefined;
  const service = new ReceiptsService({
    branch: { findUnique: async () => ({ tenantId: "tenant-a" }) },
    receipt: { findMany: async () => [] },
    printJob: {
      findFirst: async (args: { where: Record<string, unknown> }) => {
        where = args.where;
        return null;
      },
    },
  } as never);

  const job = await service.claimPrintJob(
    undefined,
    "desktop-device-1",
    actor,
    [],
    true,
    ["KITCHEN"],
  );

  assert.equal(job, null);
  assert.deepEqual((where?.AND as { OR: unknown[] }[])[0]?.OR, [
    { printerId: null, OR: [{ receipt: { documentType: "KITCHEN" } }] },
  ]);
});

test("server printer dispatch marker requires the current active lease", async () => {
  let attemptWhere: Record<string, unknown> | undefined;
  let attemptData: Record<string, unknown> | undefined;
  const job = {
    id: "job-dispatching",
    branchId: "branch-1",
    status: "PROCESSING",
    leaseToken: "lease-current",
    leaseExpiresAt: new Date(Date.now() + 60_000),
  };
  const service = new ReceiptsService({
    branch: { findUnique: async () => ({ tenantId: "tenant-a" }) },
    printJob: { findFirst: async () => job },
    printAttempt: {
      updateMany: async (args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        attemptWhere = args.where;
        attemptData = args.data;
        return { count: 1 };
      },
    },
  } as never);

  const result = await service.markPrintJobDispatching(
    job.id,
    job.leaseToken,
    actor,
  );

  assert.equal(result.outcome, "DISPATCHING");
  assert.equal(attemptData?.outcome, "DISPATCHING");
  assert.equal(attemptWhere?.jobId, job.id);
  assert.equal(attemptWhere?.leaseToken, job.leaseToken);
  assert.equal(attemptWhere?.outcome, "CLAIMED");
});

test("expired claimed or dispatching attempts are dead-lettered before another agent can print", async () => {
  for (const outcome of ["CLAIMED", "DISPATCHING"]) {
    let jobUpdate: Record<string, unknown> | undefined;
    let attemptUpdate: Record<string, unknown> | undefined;
    const leaseToken = `expired-${outcome.toLowerCase()}`;
    const job = {
      id: `job-${outcome.toLowerCase()}`,
      branchId: "branch-1",
      receiptId: "receipt-1",
      status: "PROCESSING",
      payload: { documentType: "RECEIPT" },
      leaseToken,
      leaseExpiresAt: new Date(Date.now() - 1_000),
      attempts: [{ leaseToken, outcome }],
    };
    const tx = {
      printJob: {
        updateMany: async (args: { data: Record<string, unknown> }) => {
          jobUpdate = args.data;
          return { count: 1 };
        },
      },
      printAttempt: {
        updateMany: async (args: { data: Record<string, unknown> }) => {
          attemptUpdate = args.data;
          return { count: 1 };
        },
      },
    };
    const service = new ReceiptsService({
      branch: {
        findUnique: async () => ({ tenantId: "tenant-a" }),
        findFirst: async () => ({ id: "branch-1" }),
      },
      receipt: { findMany: async () => [] },
      printJob: { findFirst: async () => job },
      $transaction: async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
    } as never);

    const claimed = await service.claimPrintJob(
      "branch-1",
      "another-desktop",
      actor,
      ["printer-1"],
      false,
      [],
    );

    assert.equal(claimed, null);
    assert.equal(jobUpdate?.status, "DEAD_LETTER");
    assert.equal(jobUpdate?.leaseToken, null);
    assert.equal(attemptUpdate?.outcome, "AMBIGUOUS");
  }
});

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
    payload: { documentType: "RECEIPT", orderId: "order-1" },
    attempts: [{ outcome: "AMBIGUOUS" }],
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
    receipt: { findMany: async () => [] },
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
  assert.equal(
    (updateData?.payload as Record<string, unknown>)["__bestteamAllowAmbiguousRetry"],
    true,
  );
  assert.equal(auditAction, "PRINT_JOB_RETRIED");
});

test("oddiy retry eski scalar payloadni o'zgartirmaydi", async () => {
  let updateData: Record<string, unknown> | undefined;
  const job = {
    id: "job-scalar-payload",
    branchId: "branch-1",
    receiptId: "receipt-1",
    status: "DEAD_LETTER",
    attemptCount: 5,
    leaseExpiresAt: null,
    payload: "legacy-payload",
    attempts: [{ outcome: "FAILED" }],
  };
  const tx = {
    printJob: {
      updateMany: async (args: { data: Record<string, unknown> }) => {
        updateData = args.data;
        return { count: 1 };
      },
    },
    receipt: { update: async () => undefined },
    auditLog: { create: async () => undefined },
  };
  const service = new ReceiptsService({
    branch: { findUnique: async () => ({ tenantId: "tenant-a" }) },
    printJob: { findFirst: async () => job, findUnique: async () => job },
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
  } as never);

  await service.retryPrintJob(job.id, actor);

  assert.equal(updateData?.payload, "legacy-payload");
});

test("ambiguous retry marker is consumed by the next server claim", async () => {
  let updateData: Record<string, unknown> | undefined;
  const job = {
    id: "job-ambiguous-retry",
    branchId: "branch-1",
    receiptId: "receipt-1",
    status: "PENDING",
    payload: {
      documentType: "RECEIPT",
      __bestteamAllowAmbiguousRetry: true,
    },
  };
  const service = new ReceiptsService({
    branch: { findUnique: async () => ({ tenantId: "tenant-a" }) },
    receipt: { findMany: async () => [] },
    printJob: {
      findFirst: async () => job,
      updateMany: async (args: { data: Record<string, unknown> }) => {
        updateData = args.data;
        return { count: 1 };
      },
      findUnique: async () => ({ ...job, payload: { documentType: "RECEIPT" } }),
    },
    printAttempt: { create: async () => undefined },
    $transaction: async (callback: (client: Record<string, never>) => Promise<unknown>) =>
      callback({}),
  } as never);

  const claimed = await service.claimPrintJob(
    undefined,
    "desktop-device-1",
    actor,
    [],
    true,
    ["RECEIPT"],
  );

  assert.equal(
    (updateData?.payload as Record<string, unknown>)["__bestteamAllowAmbiguousRetry"],
    undefined,
  );
  assert.equal((claimed as { allowAmbiguousRetry?: boolean } | null)?.allowAmbiguousRetry, true);
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

test("parallel print queue recovery creates only one job per receipt", async () => {
  const lockTails = new Map<string, Promise<void>>();
  let createdJobs = 0;

  const acquire = async (key: string): Promise<() => void> => {
    const previous = lockTails.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    lockTails.set(key, current);
    await previous;
    return () => {
      release();
      if (lockTails.get(key) === current) lockTails.delete(key);
    };
  };

  const service = new ReceiptsService({
    branch: { findUnique: async () => ({ tenantId: "tenant-a" }) },
    receipt: {
      findMany: async () => [
        {
          id: "receipt-recovery-race",
          branchId: "branch-1",
          content: { documentType: "RECEIPT" },
        },
      ],
    },
    printJob: { findMany: async () => [] },
    $transaction: async (callback: (tx: Record<string, unknown>) => Promise<unknown>) => {
      const held = new Set<string>();
      const releases: Array<() => void> = [];
      const tx = {
        $executeRaw: async (_strings: TemplateStringsArray, ...values: unknown[]) => {
          const key = String(values[0]);
          if (!held.has(key)) {
            held.add(key);
            releases.push(await acquire(key));
          }
          return 1;
        },
        printJob: {
          findFirst: async () =>
            createdJobs > 0 ? { id: "recovered-job" } : null,
          create: async () => {
            createdJobs += 1;
          },
        },
        printer: { findMany: async () => [] },
      };
      try {
        return await callback(tx);
      } finally {
        releases.reverse().forEach((release) => release());
      }
    },
  } as never);

  await Promise.all([
    service.listPrintJobs({} as never, actor),
    service.listPrintJobs({} as never, actor),
  ]);

  assert.equal(createdJobs, 1);
});
