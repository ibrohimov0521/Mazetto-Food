import assert from "node:assert/strict";
import { createServer } from "node:net";
import test from "node:test";
import { DesktopPrintWorker } from "../src/print-worker.js";

test("ESC/POS item notes skip whitespace and preserve real customer notes", () => {
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "test",
    deviceId: "test",
  });
  const encode = (
    worker as unknown as {
      encodeCommand: (
        value: Record<string, unknown>,
        columns: number,
      ) => Buffer;
    }
  ).encodeCommand.bind(worker);
  assert.doesNotMatch(
    encode(
      { type: "item", name: "Tea", quantity: "1", notes: "  \n\t" },
      48,
    ).toString(),
    /Izoh:/,
  );
  assert.match(
    encode(
      { type: "item", name: "Tea", quantity: "1", notes: " no sugar " },
      48,
    ).toString(),
    /Izoh: no sugar/,
  );
});

test("local print attempt is persisted before sending data to the printer", async () => {
  const order: string[] = [];
  const completedAttempts: string[] = [];
  const job = {
    id: "local-print-order",
    logicalKey: "local-print-order:RECEIPT",
    branchId: "branch-1",
    documentType: "RECEIPT",
    payloadJson: JSON.stringify({ orderId: "local-print-order" }),
    attempts: 1,
  };
  let claimed = false;
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "desktop-device-1",
    deviceId: "device-1",
    systemPrinters: [
      { name: "Till A", displayName: "Till A", roles: ["RECEIPT"] },
    ],
    printSystem: async () => {
      order.push("paper");
    },
    localQueue: {
      claim: () => {
        if (claimed) return null;
        claimed = true;
        return job;
      },
      markPrinting: () => {
        order.push("printing");
        return "attempt-1";
      },
      complete: (_id, attemptId) => {
        order.push("complete");
        if (attemptId) completedAttempts.push(attemptId);
      },
      fail: (_id, error) => assert.fail(error),
      wasPrinted: () => false,
    },
  });

  await worker.tick();
  assert.deepEqual(order, ["printing", "paper", "complete"]);
  assert.deepEqual(completedAttempts, ["attempt-1"]);
});

test("local queue database failures are reported, backed off, and do not escape the worker tick", async () => {
  const failures: unknown[] = [];
  let claimCalls = 0;
  let serverRequests = 0;
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "desktop-device-1",
    deviceId: "device-1",
    systemPrinters: [
      { name: "Till A", displayName: "Till A", roles: ["RECEIPT"] },
    ],
    printSystem: async () => undefined,
    localQueue: {
      claim: () => {
        claimCalls += 1;
        throw new Error("SQLite database is locked");
      },
      complete: () => undefined,
      fail: () => undefined,
      wasPrinted: () => false,
    },
    onError: (error) => failures.push(error),
    fetchImpl: async () => {
      serverRequests += 1;
      throw new Error("server polling should wait for local recovery");
    },
  });
  worker.setAuthorization("Bearer test-token");

  await worker.tick();
  await worker.tick();

  assert.equal(claimCalls, 1);
  assert.equal(serverRequests, 0);
  assert.equal(failures.length, 1);
  assert.match(String(failures[0]), /database is locked/);
});

test("server polling failures are reported and backed off", async () => {
  const failures: unknown[] = [];
  let requests = 0;
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "desktop-device-1",
    deviceId: "device-1",
    onError: (error) => failures.push(error),
    fetchImpl: async () => {
      requests += 1;
      throw new Error("printer registry unavailable");
    },
  });
  worker.setAuthorization("Bearer test-token");

  await worker.tick();
  await worker.tick();

  assert.equal(requests, 1);
  assert.equal(failures.length, 1);
  assert.match(String(failures[0]), /printer registry unavailable/);
});

test("failed ambiguous-job persistence after paper output cannot crash or keep polling", async () => {
  const job = {
    id: "local-ambiguous-persistence-failed",
    logicalKey: "local-ambiguous-persistence-failed:RECEIPT",
    branchId: "branch-1",
    documentType: "RECEIPT",
    payloadJson: JSON.stringify({
      orderId: "local-ambiguous-persistence-failed",
    }),
    attempts: 1,
  };
  const reported: unknown[] = [];
  let claims = 0;
  let prints = 0;
  let serverRequests = 0;
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "desktop-device-1",
    deviceId: "device-1",
    systemPrinters: [
      { name: "Till A", displayName: "Till A", roles: ["RECEIPT"] },
    ],
    printSystem: async () => {
      prints += 1;
    },
    localQueue: {
      claim: () => (claims++ === 0 ? job : null),
      markPrinting: () => "attempt-1",
      complete: () => assert.fail("ambiguous paper must not be completed"),
      fail: () => {
        throw new Error("SQLite dead-letter write failed");
      },
      wasPrinted: () => false,
      markTargetPrinted: () => {
        throw new Error("SQLite target write failed");
      },
      markTargetAmbiguous: () => undefined,
    },
    onError: (error) => reported.push(error),
    fetchImpl: async () => {
      serverRequests += 1;
      throw new Error("server polling should wait for local recovery");
    },
  });
  worker.setAuthorization("Bearer test-token");

  await worker.tick();
  await worker.tick();

  assert.equal(prints, 1);
  assert.equal(claims, 1);
  assert.equal(serverRequests, 0);
  assert.equal(reported.length, 1);
  assert.match(String(reported[0]), /dead-letter write failed/);
});

test("a printed receipt with failed result persistence is treated as ambiguous", async () => {
  let claimed = false;
  let printCalls = 0;
  const failures: Array<{
    message: string;
    ambiguous?: boolean;
    attemptId?: string;
  }> = [];
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "desktop-device-1",
    deviceId: "device-1",
    systemPrinters: [
      { name: "Till A", displayName: "Till A", roles: ["RECEIPT"] },
    ],
    printSystem: async () => {
      printCalls += 1;
    },
    localQueue: {
      claim: () => {
        if (claimed) return null;
        claimed = true;
        return {
          id: "local-print-result-write-failed",
          logicalKey: "local-print-result-write-failed:RECEIPT",
          branchId: "branch-1",
          documentType: "RECEIPT",
          payloadJson: JSON.stringify({
            orderId: "local-print-result-write-failed",
          }),
          attempts: 1,
        };
      },
      markPrinting: () => "attempt-1",
      complete: () => {
        throw new Error("SQLite result write failed");
      },
      fail: (_id, error, ambiguous, attemptId) => {
        failures.push({ message: error, ambiguous, attemptId });
      },
      wasPrinted: () => false,
    },
  });

  await worker.tick();
  assert.equal(printCalls, 1);
  assert.deepEqual(failures, [
    {
      message: "SQLite result write failed",
      ambiguous: true,
      attemptId: "attempt-1",
    },
  ]);
});

test("a printed target with failed persistence is not automatically printed twice", async () => {
  const job = {
    id: "local-target-write-failed",
    logicalKey: "local-target-write-failed:RECEIPT",
    branchId: "branch-1",
    documentType: "RECEIPT",
    payloadJson: JSON.stringify({ orderId: "local-target-write-failed" }),
    attempts: 1,
  };
  const failures: Array<{ error: string; ambiguous?: boolean }> = [];
  const ambiguousTargets: string[] = [];
  let claims = 0;
  let printed = 0;
  let deadLetter = false;
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "desktop-device-1",
    deviceId: "device-1",
    systemPrinters: [
      { name: "Till A", displayName: "Till A", roles: ["RECEIPT"] },
    ],
    printSystem: async () => {
      printed += 1;
    },
    localQueue: {
      claim: () => {
        claims += 1;
        return deadLetter || claims > 1 ? null : job;
      },
      complete: () => assert.fail("ambiguous paper must not be completed"),
      fail: (_id, error, ambiguous) => {
        failures.push({ error, ambiguous });
        deadLetter = Boolean(ambiguous);
      },
      wasPrinted: () => false,
      markTargetPrinted: () => {
        throw new Error("SQLite target write failed");
      },
      markTargetAmbiguous: (_scope, jobId, name) =>
        ambiguousTargets.push(`${jobId}:${name}`),
    },
  });

  await worker.tick();
  await worker.tick();

  assert.equal(printed, 1);
  assert.equal(failures.length, 1);
  assert.equal(failures[0]?.ambiguous, true);
  assert.match(
    failures[0]?.error ?? "",
    /qog'ozni tekshirmasdan qayta chop etmang/i,
  );
  assert.deepEqual(ambiguousTargets, ["local-target-write-failed:Till A"]);
});

test("a local printer job is not sent if its durable attempt cannot be recorded", async () => {
  let claimed = false;
  let printCalls = 0;
  let completionCalls = 0;
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "desktop-device-1",
    deviceId: "device-1",
    systemPrinters: [
      { name: "Till A", displayName: "Till A", roles: ["RECEIPT"] },
    ],
    printSystem: async () => {
      printCalls += 1;
    },
    localQueue: {
      claim: () => {
        if (claimed) return null;
        claimed = true;
        return {
          id: "local-print-untracked",
          logicalKey: "local-print-untracked:RECEIPT",
          branchId: "branch-1",
          documentType: "RECEIPT",
          payloadJson: JSON.stringify({ orderId: "local-print-untracked" }),
          attempts: 1,
        };
      },
      markPrinting: () => false,
      complete: () => {
        completionCalls += 1;
      },
      fail: () => undefined,
      wasPrinted: () => false,
    },
  });

  await worker.tick();
  assert.equal(printCalls, 0);
  assert.equal(completionCalls, 0);
});

test("offline receipt and kitchen documents print through selected Windows drivers", async () => {
  const printed: Array<{
    name: string;
    type: string;
    paperWidthMm?: number;
    paperFormat?: string;
  }> = [];
  const completed: string[] = [];
  const jobs = [
    {
      id: "local-1",
      logicalKey: "order-1:RECEIPT",
      branchId: "branch-1",
      documentType: "RECEIPT",
      payloadJson: JSON.stringify({
        documentType: "RECEIPT",
        orderId: "order-1",
      }),
      attempts: 0,
    },
    {
      id: "local-2",
      logicalKey: "order-1:KITCHEN",
      branchId: "branch-1",
      documentType: "KITCHEN",
      payloadJson: JSON.stringify({
        documentType: "KITCHEN",
        orderId: "order-1",
      }),
      attempts: 0,
    },
  ];
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "desktop-device-1",
    deviceId: "device-1",
    systemPrinters: [
      {
        name: "Windows POS",
        displayName: "Windows POS",
        roles: ["RECEIPT"],
        paperWidthMm: 58,
      },
      {
        name: "Windows Kitchen",
        displayName: "Windows Kitchen",
        roles: ["KITCHEN"],
        paperWidthMm: 210,
      },
    ],
    printSystem: async (name, receipt, paperSettings) => {
      printed.push({
        name,
        type: receipt.documentType ?? "",
        paperWidthMm: paperSettings?.paperWidthMm,
        paperFormat: paperSettings?.paperFormat,
      });
    },
    localQueue: {
      claim: (types) => {
        const index = jobs.findIndex((job) => types.includes(job.documentType));
        return index >= 0 ? jobs.splice(index, 1)[0]! : null;
      },
      complete: (id) => completed.push(id),
      fail: () => undefined,
      wasPrinted: () => false,
    },
  });

  await worker.tick();
  await worker.tick();

  assert.deepEqual(printed, [
    {
      name: "Windows POS",
      type: "RECEIPT",
      paperWidthMm: 58,
      paperFormat: "ROLL",
    },
    {
      name: "Windows Kitchen",
      type: "KITCHEN",
      paperWidthMm: 210,
      paperFormat: "A4",
    },
  ]);
  assert.deepEqual(completed, ["local-1", "local-2"]);
});

test("custom label profiles work through any installed Windows printer driver", async () => {
  let printed: {
    name: string;
    format?: string;
    width?: number;
    height?: number;
  } | null = null;
  let claimed = false;
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "desktop-device-1",
    deviceId: "device-1",
    systemPrinters: [
      {
        name: "Generic USB Label Printer",
        displayName: "Generic USB Label Printer",
        roles: ["RECEIPT"],
        paperFormat: "LABEL",
        paperWidthMm: 100,
        paperHeightMm: 60,
      },
    ],
    printSystem: async (name, _receipt, paper) => {
      printed = {
        name,
        format: paper?.paperFormat,
        width: paper?.paperWidthMm,
        height: paper?.paperHeightMm,
      };
    },
    localQueue: {
      claim: () => {
        if (claimed) return null;
        claimed = true;
        return {
          id: "label-job-1",
          logicalKey: "order-label:RECEIPT",
          branchId: "branch-1",
          documentType: "RECEIPT",
          payloadJson: JSON.stringify({ documentType: "RECEIPT" }),
          attempts: 0,
        };
      },
      complete: () => undefined,
      fail: () => undefined,
      wasPrinted: () => false,
    },
  });

  await worker.tick();

  assert.deepEqual(printed, {
    name: "Generic USB Label Printer",
    format: "LABEL",
    width: 100,
    height: 60,
  });
});

test("print worker stop waits for the active local paper job", async () => {
  let claims = 0;
  let completed = 0;
  let beginPrint: () => void = () => undefined;
  let releasePrint: () => void = () => undefined;
  const printStarted = new Promise<void>((resolve) => {
    beginPrint = resolve;
  });
  const printGate = new Promise<void>((resolve) => {
    releasePrint = resolve;
  });
  const job = {
    id: "active-print-job",
    logicalKey: "order-active:RECEIPT",
    branchId: "branch-1",
    documentType: "RECEIPT",
    payloadJson: JSON.stringify({ orderId: "order-active" }),
    attempts: 0,
  };
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "desktop-device-1",
    deviceId: "device-1",
    systemPrinters: [
      { name: "Receipt", displayName: "Receipt", roles: ["RECEIPT"] },
    ],
    printSystem: async () => {
      beginPrint();
      await printGate;
    },
    localQueue: {
      claim: () => {
        claims += 1;
        return job;
      },
      complete: () => {
        completed += 1;
      },
      fail: (_id, error) => assert.fail(error),
      wasPrinted: () => false,
    },
  });

  const ticking = worker.tick();
  await printStarted;
  let stopped = false;
  const stopping = worker.stop().then(() => {
    stopped = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(stopped, false);

  releasePrint();
  await Promise.all([ticking, stopping]);
  await worker.tick();

  assert.equal(claims, 1);
  assert.equal(completed, 1);
});

test("failed local print is not retried again before its backoff is due", async () => {
  let claims = 0;
  let failures = 0;
  let claimed = false;
  const job = {
    id: "retrying-print-job",
    logicalKey: "order-retry:RECEIPT",
    branchId: "branch-1",
    documentType: "RECEIPT",
    payloadJson: JSON.stringify({ orderId: "order-retry" }),
    attempts: 0,
  };
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "desktop-device-1",
    deviceId: "device-1",
    systemPrinters: [
      { name: "Receipt", displayName: "Receipt", roles: ["RECEIPT"] },
    ],
    printSystem: async () => {
      throw new Error("Printer is offline");
    },
    localQueue: {
      claim: () => {
        claims += 1;
        if (claimed) return null;
        claimed = true;
        return job;
      },
      complete: () => assert.fail("failed print must not complete"),
      fail: () => {
        failures += 1;
      },
      wasPrinted: () => false,
    },
  });

  await worker.tick();

  assert.equal(claims, 2);
  assert.equal(failures, 1);
});

test("offline print queue routes documents across multiple configured system printers", async () => {
  const printed: string[] = [];
  const jobs = [
    {
      id: "receipt-job",
      logicalKey: "order-2:RECEIPT",
      branchId: "branch-1",
      documentType: "RECEIPT",
      payloadJson: JSON.stringify({ orderId: "order-2" }),
      attempts: 0,
    },
    {
      id: "kitchen-job",
      logicalKey: "order-2:KITCHEN",
      branchId: "branch-1",
      documentType: "KITCHEN",
      payloadJson: JSON.stringify({ orderId: "order-2" }),
      attempts: 0,
    },
  ];
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "desktop-device-1",
    deviceId: "device-1",
    systemPrinters: [
      {
        name: "Till A",
        displayName: "Till A",
        roles: ["RECEIPT"],
        paperWidthMm: 58,
      },
      {
        name: "Till B",
        displayName: "Till B",
        roles: ["RECEIPT"],
        paperWidthMm: 80,
      },
      {
        name: "Kitchen 1",
        displayName: "Kitchen 1",
        roles: ["KITCHEN"],
        paperWidthMm: 210,
      },
    ],
    printSystem: async (name, receipt) => {
      printed.push(name + ":" + receipt.documentType);
    },
    localQueue: {
      claim: (types) => {
        const index = jobs.findIndex((job) => types.includes(job.documentType));
        return index < 0 ? null : jobs.splice(index, 1)[0]!;
      },
      complete: () => undefined,
      fail: (_id, error) => assert.fail(error),
      wasPrinted: () => false,
    },
  });

  await worker.tick();

  assert.deepEqual(
    printed.sort(),
    ["Till A:RECEIPT", "Till B:RECEIPT", "Kitchen 1:KITCHEN"].sort(),
  );
});

test("a failed printer target does not block other targets or duplicate successful copies on retry", async () => {
  const targetNames = Array.from(
    { length: 7 },
    (_, index) => "Till " + (index + 1),
  );
  const job = {
    id: "fanout-retry-job",
    logicalKey: "order-fanout-retry:RECEIPT",
    branchId: "branch-1",
    documentType: "RECEIPT",
    payloadJson: JSON.stringify({ orderId: "order-fanout-retry" }),
    attempts: 1,
  };
  const printedTargets = new Set<string>();
  const printCounts = new Map<string, number>();
  const completed: string[] = [];
  const failures: Array<{ id: string; error: string; ambiguous?: boolean }> =
    [];
  let initialClaimed = false;
  let retryRequested = false;
  let retryClaimed = false;
  let active = 0;
  let maximumActive = 0;
  let firstAttemptFailed = false;
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "desktop-device-1",
    deviceId: "device-1",
    systemPrinters: targetNames.map((name) => ({
      name,
      displayName: name,
      roles: ["RECEIPT"],
    })),
    printSystem: async (name) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      printCounts.set(name, (printCounts.get(name) ?? 0) + 1);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      if (name === "Till 1" && !firstAttemptFailed) {
        firstAttemptFailed = true;
        throw new Error("Printer offline");
      }
    },
    localQueue: {
      claim: () => {
        if (!initialClaimed) {
          initialClaimed = true;
          return job;
        }
        if (retryRequested && !retryClaimed) {
          retryClaimed = true;
          return job;
        }
        return null;
      },
      complete: (id) => completed.push(id),
      fail: (id, error, ambiguous) => failures.push({ id, error, ambiguous }),
      wasPrinted: () => false,
      wasTargetPrinted: (_scope, jobId, name) =>
        printedTargets.has(jobId + ":" + name),
      markTargetPrinted: (_scope, jobId, name) =>
        printedTargets.add(jobId + ":" + name),
    },
  });

  await worker.tick();

  assert.equal(maximumActive, 4);
  assert.deepEqual(
    [...printedTargets].sort(),
    targetNames
      .slice(1)
      .map((name) => "fanout-retry-job:" + name)
      .sort(),
  );
  assert.equal(failures.length, 1);
  assert.match(failures[0]?.error ?? "", /Till 1: Printer offline/);
  assert.deepEqual(completed, []);

  retryRequested = true;
  await worker.tick();

  assert.deepEqual(completed, ["fanout-retry-job"]);
  assert.deepEqual(failures, [
    {
      id: "fanout-retry-job",
      error: "Till 1: Printer offline",
      ambiguous: false,
    },
  ]);
  assert.equal(printCounts.get("Till 1"), 2);
  for (const name of targetNames.slice(1))
    assert.equal(printCounts.get(name), 1);
});

test("server print worker drains at most five jobs per tick without parallel printer writes", async () => {
  const jobs = Array.from({ length: 7 }, (_, index) => ({
    id: `job-${index + 1}`,
    receiptId: `receipt-${index + 1}`,
    leaseToken: `lease-${index + 1}`,
    payload: {
      documentType: "RECEIPT",
      orderNumber: String(index + 1),
      items: [{ name: "Lavash", quantity: 1 }],
    },
    receipt: { orderId: `order-${index + 1}`, documentType: "RECEIPT" },
    printer: null,
  }));
  let nextJob = 0;
  let claims = 0;
  let activePrints = 0;
  let maxActivePrints = 0;
  const printed: string[] = [];
  const completed: string[] = [];
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "desktop-device-1",
    deviceId: "device-1",
    systemPrinters: [
      { name: "Receipt", displayName: "Receipt", roles: ["RECEIPT"] },
    ],
    printSystem: async (_name, receipt) => {
      activePrints += 1;
      maxActivePrints = Math.max(maxActivePrints, activePrints);
      await new Promise((resolve) => setTimeout(resolve, 0));
      printed.push(receipt.orderId ?? "");
      activePrints -= 1;
    },
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.endsWith("/dispatching")) return jsonResponse({});
      if (url.endsWith("/printers")) return jsonResponse([]);
      if (url.endsWith("/print-jobs/claim")) {
        claims += 1;
        return jsonResponse(jobs[nextJob++] ?? null);
      }
      const completedMatch = url.match(/\/print-jobs\/([^/]+)\/complete$/);
      if (completedMatch) {
        completed.push(decodeURIComponent(completedMatch[1]!));
        return jsonResponse({});
      }
      throw new Error(`Unexpected request: ${url}`);
    },
  });
  worker.setAuthorization("Bearer test-token");

  await worker.tick();
  assert.equal(claims, 5);
  assert.equal(completed.length, 5);
  assert.deepEqual(printed, [
    "order-1",
    "order-2",
    "order-3",
    "order-4",
    "order-5",
  ]);
  assert.equal(maxActivePrints, 1);

  await worker.tick();
  assert.equal(claims, 8);
  assert.equal(completed.length, 7);
  assert.equal(maxActivePrints, 1);
});

test("offline local print jobs keep draining while a timed-out server poll backs off", async () => {
  const localJobs = ["q1", "q2"];
  const printed: string[] = [];
  let serverRequests = 0;
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "desktop-device-1",
    deviceId: "device-1",
    requestTimeoutMs: 10,
    systemPrinters: [
      { name: "Receipt", displayName: "Receipt", roles: ["RECEIPT"] },
    ],
    printSystem: async (_name, receipt) => {
      printed.push(receipt.receiptNumber ?? "");
    },
    localQueue: {
      claim: () => {
        const id = localJobs.shift();
        return id
          ? {
              id,
              logicalKey: `${id}:RECEIPT`,
              branchId: "branch-1",
              documentType: "RECEIPT",
              payloadJson: JSON.stringify({ orderId: id }),
              attempts: 0,
            }
          : null;
      },
      complete: () => undefined,
      fail: (_id, error) => assert.fail(error),
      wasPrinted: () => false,
    },
    fetchImpl: async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        serverRequests += 1;
        const signal = init?.signal;
        if (!signal) return reject(new Error("request timeout signal missing"));
        if (signal.aborted) return reject(signal.reason);
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      }),
  });
  worker.setAuthorization("Bearer test-token");

  const timeoutKeepAlive = setTimeout(() => undefined, 50);
  await worker.tick();
  clearTimeout(timeoutKeepAlive);
  assert.deepEqual(printed, ["OFFLINE-Q1", "OFFLINE-Q2"]);
  assert.equal(serverRequests, 1);

  localJobs.push("q3");
  await worker.tick();
  assert.deepEqual(printed, ["OFFLINE-Q1", "OFFLINE-Q2", "OFFLINE-Q3"]);
  assert.equal(serverRequests, 1);
});

test("assigned server printer jobs print only to the matching Windows queue", async () => {
  let claimed = false;
  let completed = 0;
  const printed: string[] = [];
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "desktop-device-1",
    deviceId: "device-1",
    systemPrinters: [
      { name: "queue-1", displayName: "Kassa 1", roles: ["RECEIPT"] },
      { name: "queue-2", displayName: "Kassa 2", roles: ["RECEIPT"] },
    ],
    printSystem: async (name) => {
      printed.push(name);
    },
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.endsWith("/dispatching")) return jsonResponse({});
      if (url.endsWith("/printers"))
        return jsonResponse([
          {
            id: "printer-1",
            name: "Kassa 1",
            isActive: true,
            status: "ONLINE",
            metadata: { printRoles: ["RECEIPT"] },
          },
        ]);
      if (url.endsWith("/print-jobs/claim")) {
        if (claimed) return jsonResponse(null);
        claimed = true;
        return jsonResponse({
          id: "job-1",
          receiptId: "receipt-1",
          leaseToken: "lease-1",
          receipt: {
            receiptNumber: "RCPT-1",
            documentType: "RECEIPT",
            orderId: "order-1",
          },
          payload: {
            documentType: "RECEIPT",
            orderNumber: "42",
            items: [{ name: "Lavash" }],
          },
          printer: { id: "printer-1", name: "Kassa 1", metadata: {} },
        });
      }
      if (url.endsWith("/complete")) {
        completed += 1;
        return jsonResponse({});
      }
      throw new Error("Unexpected request: " + url);
    },
  });
  worker.setAuthorization("Bearer test-token");

  await worker.tick();

  assert.deepEqual(printed, ["queue-1"]);
  assert.equal(completed, 1);
});

test("ambiguous Windows printer mapping fails instead of printing duplicate copies", async () => {
  let claimed = false;
  let printed = 0;
  let failure = "";
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "desktop-device-1",
    deviceId: "device-1",
    systemPrinters: [
      { name: "queue-1", displayName: "Kassa 1", roles: ["RECEIPT"] },
      { name: "queue-2", displayName: "Kassa 2", roles: ["RECEIPT"] },
    ],
    printSystem: async () => {
      printed += 1;
    },
    fetchImpl: async (input, init) => {
      const url = String(input);
      if (url.endsWith("/dispatching")) return jsonResponse({});
      if (url.endsWith("/printers"))
        return jsonResponse([
          {
            id: "printer-1",
            name: "Kassa server",
            isActive: true,
            status: "ONLINE",
            metadata: { printRoles: ["RECEIPT"] },
          },
        ]);
      if (url.endsWith("/print-jobs/claim")) {
        if (claimed) return jsonResponse(null);
        claimed = true;
        return jsonResponse({
          id: "job-1",
          receiptId: "receipt-1",
          leaseToken: "lease-1",
          receipt: {
            receiptNumber: "RCPT-1",
            documentType: "RECEIPT",
            orderId: "order-1",
          },
          payload: {
            documentType: "RECEIPT",
            orderNumber: "42",
            items: [{ name: "Lavash" }],
          },
          printer: { id: "printer-1", name: "Kassa server", metadata: {} },
        });
      }
      if (url.endsWith("/fail")) {
        failure = (JSON.parse(String(init?.body)) as { error: string }).error;
        return jsonResponse({});
      }
      throw new Error("Unexpected request: " + url);
    },
  });
  worker.setAuthorization("Bearer test-token");

  await worker.tick();

  assert.equal(printed, 0);
  assert.match(failure, /Windows queue topilmadi/);
});

test("server-assigned Windows job never falls through to the generic TCP printer", async () => {
  let claimed = false;
  let socketWrites = 0;
  let failure = "";
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: "10.0.0.5",
    agentId: "desktop-device-1",
    deviceId: "device-1",
    fetchImpl: async (input, init) => {
      const url = String(input);
      if (url.endsWith("/dispatching")) return jsonResponse({});
      if (url.endsWith("/printers"))
        return jsonResponse([
          {
            id: "printer-1",
            name: "Kassa",
            isActive: true,
            status: "ONLINE",
            metadata: { printRoles: ["RECEIPT"] },
          },
        ]);
      if (url.endsWith("/print-jobs/claim")) {
        if (claimed) return jsonResponse(null);
        claimed = true;
        return jsonResponse({
          id: "job-1",
          receiptId: "receipt-1",
          leaseToken: "lease-1",
          receipt: {
            receiptNumber: "RCPT-1",
            documentType: "RECEIPT",
            orderId: "order-1",
          },
          payload: {
            documentType: "RECEIPT",
            orderNumber: "42",
            items: [{ name: "Lavash" }],
          },
          printer: { id: "printer-1", name: "Kassa", metadata: {} },
        });
      }
      if (url.endsWith("/fail")) {
        failure = (JSON.parse(String(init?.body)) as { error: string }).error;
        return jsonResponse({});
      }
      throw new Error("Unexpected request: " + url);
    },
    socketImpl: async () => {
      socketWrites += 1;
    },
  });
  worker.setAuthorization("Bearer test-token");

  await worker.tick();

  assert.equal(socketWrites, 0);
  assert.match(failure, /Windows queue topilmadi/);
});
test("server replay is completed without duplicate paper when local document already printed", async () => {
  let completed = 0;
  let physicalPrints = 0;
  let claimed = false;
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "desktop-device-1",
    deviceId: "device-1",
    systemPrinters: [
      { name: "Windows POS", displayName: "Windows POS", roles: ["RECEIPT"] },
    ],
    printSystem: async () => {
      physicalPrints += 1;
    },
    localQueue: {
      claim: () => null,
      complete: () => undefined,
      fail: () => undefined,
      wasPrinted: (orderId, type) =>
        orderId === "server-order-1" && type === "RECEIPT",
    },
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.endsWith("/dispatching")) return jsonResponse({});
      if (url.endsWith("/printers")) return jsonResponse([]);
      if (url.endsWith("/print-jobs/claim")) {
        if (claimed) return jsonResponse(null);
        claimed = true;
        return jsonResponse({
          id: "job-1",
          receiptId: "receipt-1",
          leaseToken: "lease-1",
          printer: null,
        });
      }
      if (url.endsWith("/receipts/receipt-1"))
        return jsonResponse({
          orderId: "server-order-1",
          documentType: "RECEIPT",
          content: { documentType: "RECEIPT" },
        });
      if (url.endsWith("/complete")) {
        completed += 1;
        return jsonResponse({});
      }
      throw new Error(`Unexpected request: ${url}`);
    },
  });
  worker.setAuthorization("Bearer test-token");

  await worker.tick();

  assert.equal(physicalPrints, 0);
  assert.equal(completed, 1);
});

test("server replay does not repeat a locally ambiguous paper print", async () => {
  let claimed = false;
  let completed = 0;
  let dispatching = 0;
  let printed = 0;
  let failure: { outcome?: string } | undefined;
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "desktop-device-1",
    deviceId: "device-1",
    systemPrinters: [
      { name: "Windows POS", displayName: "Windows POS", roles: ["RECEIPT"] },
    ],
    printSystem: async () => {
      printed += 1;
    },
    localQueue: {
      claim: () => null,
      complete: () => undefined,
      fail: () => undefined,
      wasPrinted: () => false,
      wasAmbiguousLocallyOn: (orderId, type, printerName) =>
        orderId === "server-order-ambiguous" &&
        type === "RECEIPT" &&
        printerName === "Windows POS",
    },
    fetchImpl: async (input, init) => {
      const url = String(input);
      if (url.endsWith("/printers")) return jsonResponse([]);
      if (url.endsWith("/print-jobs/claim")) {
        if (claimed) return jsonResponse(null);
        claimed = true;
        return jsonResponse({
          id: "job-ambiguous-replay",
          receiptId: "receipt-ambiguous-replay",
          leaseToken: "lease-ambiguous-replay",
          receipt: {
            orderId: "server-order-ambiguous",
            documentType: "RECEIPT",
          },
          payload: {
            documentType: "RECEIPT",
            orderNumber: "A-1",
            items: [{ name: "Lavash", quantity: "1", total: "36000" }],
          },
          printer: null,
        });
      }
      if (url.endsWith("/dispatching")) {
        dispatching += 1;
        return jsonResponse({});
      }
      if (url.endsWith("/complete")) {
        completed += 1;
        return jsonResponse({});
      }
      if (url.endsWith("/fail")) {
        failure = JSON.parse(String(init?.body)) as { outcome?: string };
        return jsonResponse({});
      }
      throw new Error("Unexpected URL: " + url);
    },
  });
  worker.setAuthorization("Bearer test-token");

  await worker.tick();

  assert.equal(printed, 0);
  assert.equal(dispatching, 1);
  assert.equal(completed, 0);
  assert.equal(failure?.outcome, "AMBIGUOUS");
});
test("offline replay skips only the server printer target already printed locally", async () => {
  let completed = 0;
  let claimed = false;
  const printedTargets: string[] = [];
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "desktop-device-1",
    deviceId: "device-1",
    systemPrinters: [
      { name: "POS Receipt", displayName: "POS Receipt", roles: ["RECEIPT"] },
      {
        name: "Kitchen Receipt",
        displayName: "Kitchen Receipt",
        roles: ["RECEIPT"],
      },
    ],
    printSystem: async (name) => {
      printedTargets.push(name);
    },
    localQueue: {
      claim: () => null,
      complete: () => undefined,
      fail: () => undefined,
      wasPrinted: (_orderId, _type, printerName) =>
        printerName === "POS Receipt",
    },
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.endsWith("/printers")) return jsonResponse([]);
      if (url.endsWith("/print-jobs/claim")) {
        if (claimed) return jsonResponse(null);
        claimed = true;
        return jsonResponse({
          id: "job-multi-printer",
          receiptId: "receipt-multi-printer",
          leaseToken: "lease-multi-printer",
          receipt: { orderId: "server-order-multi-printer" },
          payload: {
            documentType: "RECEIPT",
            orderNumber: "M-2",
            items: [{ name: "Lavash", quantity: "1", total: "36000" }],
          },
          printer: null,
        });
      }
      if (url.endsWith("/dispatching")) return jsonResponse({});
      if (url.endsWith("/complete")) {
        completed += 1;
        return jsonResponse({});
      }
      throw new Error("Unexpected URL: " + url);
    },
  });
  worker.setAuthorization("Bearer test-token");

  await worker.tick();

  assert.deepEqual(printedTargets, ["Kitchen Receipt"]);
  assert.equal(completed, 1);
});

test("manual server reprint reaches the printer even when the original was printed locally", async () => {
  let completed = 0;
  let physicalPrints = 0;
  let claimed = false;
  let printedContent: Record<string, unknown> | undefined;
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "desktop-device-1",
    deviceId: "device-1",
    systemPrinters: [
      { name: "Windows POS", displayName: "Windows POS", roles: ["RECEIPT"] },
    ],
    printSystem: async (_deviceName, receipt) => {
      physicalPrints += 1;
      printedContent = receipt.content ?? undefined;
    },
    localQueue: {
      claim: () => null,
      complete: () => undefined,
      fail: () => undefined,
      wasPrinted: () => true,
    },
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.endsWith("/dispatching")) return jsonResponse({});
      if (url.endsWith("/printers")) return jsonResponse([]);
      if (url.endsWith("/print-jobs/claim")) {
        if (claimed) return jsonResponse(null);
        claimed = true;
        return jsonResponse({
          id: "job-reprint-1",
          receiptId: "receipt-1",
          leaseToken: "lease-1",
          payload: {
            documentType: "RECEIPT",
            orderNumber: "M-1",
            items: [{ name: "Lavash", quantity: "1", total: "36000" }],
            __bestteamAllowLocalReprint: true,
          },
          receipt: { orderId: "server-order-1" },
          printer: null,
        });
      }
      if (url.endsWith("/complete")) {
        completed += 1;
        return jsonResponse({});
      }
      throw new Error(`Unexpected request: ${url}`);
    },
  });
  worker.setAuthorization("Bearer test-token");

  await worker.tick();

  assert.equal(physicalPrints, 1);
  assert.equal(completed, 1);
  assert.deepEqual(printedContent, {
    documentType: "RECEIPT",
    orderNumber: "M-1",
    items: [{ name: "Lavash", quantity: "1", total: "36000" }],
  });
});

test("print worker does not claim a job when no printer is ready", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const worker = createWorker(async (input, init) => {
    requests.push({ url: String(input), init });
    return jsonResponse([]);
  });

  worker.setAuthorization("Bearer test-token");
  await worker.tick();

  assert.equal(requests.length, 1);
  assert.match(requests[0]!.url, /\/printers$/);
  assert.equal(
    new Headers(requests[0]!.init?.headers).get("x-mazetto-device-id"),
    "device-1",
  );
  assert.equal(
    new Headers(requests[0]!.init?.headers).get("x-mazetto-device-token"),
    "device-secret",
  );
});

test("print worker claims only jobs for ready managed printers", async () => {
  const requestBodies: unknown[] = [];
  const worker = createWorker(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/dispatching")) return jsonResponse({});
    if (url.endsWith("/printers")) {
      return jsonResponse([
        {
          id: "printer-ready",
          isActive: true,
          status: "ONLINE",
          metadata: { host: "10.0.0.5", port: 9100 },
        },
        {
          id: "printer-offline",
          isActive: true,
          status: "OFFLINE",
          metadata: { host: "10.0.0.6", port: 9100 },
        },
        {
          id: "printer-no-host",
          isActive: true,
          status: "ONLINE",
          metadata: {},
        },
      ]);
    }
    requestBodies.push(JSON.parse(String(init?.body)));
    return jsonResponse(null);
  });

  worker.setAuthorization("Bearer test-token");
  await worker.tick();

  assert.deepEqual(requestBodies, [
    {
      agentId: "desktop-device-1",
      printerIds: ["printer-ready"],
      acceptUnassigned: false,
      unassignedRoutes: [],
    },
  ]);
  assert.equal(worker.status().managedPrinters, 1);
  assert.deepEqual(worker.status().managedPrinterDetails, [
    {
      id: "printer-ready",
      name: "Printer",
      host: "10.0.0.5",
      port: 9100,
    },
  ]);
});

test("a kitchen-only workstation claims only unassigned kitchen documents", async () => {
  const claims: Record<string, unknown>[] = [];
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: "10.0.0.5",
    agentId: "desktop-device-1",
    deviceId: "device-1",
    systemPrinters: [
      { name: "Kitchen", displayName: "Kitchen", roles: ["KITCHEN"] },
    ],
    printSystem: async () => undefined,
    fetchImpl: async (input, init) => {
      if (String(input).endsWith("/printers")) return jsonResponse([]);
      claims.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return jsonResponse(null);
    },
  });
  worker.setAuthorization("Bearer test-token");

  await worker.tick();

  assert.deepEqual(claims, [
    {
      agentId: "desktop-device-1",
      printerIds: [],
      acceptUnassigned: true,
      unassignedRoutes: ["KITCHEN"],
    },
  ]);
});

test("a single mismatched Windows queue cannot claim an assigned printer job", async () => {
  const claims: Record<string, unknown>[] = [];
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "desktop-device-1",
    deviceId: "device-1",
    systemPrinters: [
      { name: "Wrong queue", displayName: "Wrong queue", roles: ["KITCHEN"] },
    ],
    printSystem: async () => assert.fail("wrong queue must not print"),
    fetchImpl: async (input, init) => {
      if (String(input).endsWith("/printers"))
        return jsonResponse([
          {
            id: "server-kitchen",
            name: "Kitchen",
            isActive: true,
            status: "ONLINE",
            metadata: { printRoles: ["KITCHEN"] },
          },
        ]);
      claims.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return jsonResponse(null);
    },
  });
  worker.setAuthorization("Bearer test-token");

  await worker.tick();

  assert.deepEqual(claims[0]?.printerIds, []);
});

test("all managed printer connections are tested independently", async () => {
  const connected: string[] = [];
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "desktop-device-1",
    deviceId: "device-1",
    deviceToken: "device-secret",
    fetchImpl: async () =>
      jsonResponse([
        {
          id: "receipt",
          name: "Kassa",
          status: "ONLINE",
          metadata: { host: "10.0.0.5", port: 9100 },
        },
        {
          id: "kitchen",
          name: "Oshxona",
          status: "ONLINE",
          metadata: { host: "10.0.0.6", port: 9101 },
        },
      ]),
    socketImpl: async (host, port) => {
      connected.push(`${host}:${port}`);
      if (port === 9101) throw new Error("connection refused");
    },
  });
  worker.setAuthorization("Bearer test-token");

  const results = await worker.testManagedConnections();

  assert.deepEqual(connected, ["10.0.0.5:9100", "10.0.0.6:9101"]);
  assert.deepEqual(
    results.map(({ name, ok }) => ({ name, ok })),
    [
      { name: "Kassa", ok: true },
      { name: "Oshxona", ok: false },
    ],
  );
});

test("A4 paper cannot fall through to the default TCP printer", async () => {
  let claimed = false;
  let failure = "";
  let socketWrites = 0;
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: "10.0.0.5",
    agentId: "desktop-device-1",
    deviceId: "device-1",
    deviceToken: "device-secret",
    fetchImpl: async (input, init) => {
      const url = String(input);
      if (url.endsWith("/dispatching")) return jsonResponse({});
      if (url.endsWith("/printers")) {
        return jsonResponse([
          {
            id: "printer-1",
            name: "A4",
            status: "ONLINE",
            metadata: { paperWidthMm: 210 },
          },
        ]);
      }
      if (url.endsWith("/print-jobs/claim")) {
        if (claimed) return jsonResponse(null);
        claimed = true;
        return jsonResponse({
          id: "job-a4",
          receiptId: "receipt-a4",
          leaseToken: "lease-a4",
          receipt: {
            receiptNumber: "RCPT-A4",
            documentType: "RECEIPT",
            orderId: "order-1",
          },
          payload: {
            documentType: "RECEIPT",
            orderNumber: "42",
            items: [{ name: "Lavash" }],
          },
          printer: {
            id: "printer-1",
            name: "A4",
            metadata: { paperWidthMm: 210 },
          },
        });
      }
      if (url.endsWith("/fail")) {
        failure = (JSON.parse(String(init?.body)) as { error: string }).error;
        return jsonResponse({ id: "job-a4", status: "FAILED" });
      }
      throw new Error("Unexpected request: " + url);
    },
    socketImpl: async () => {
      socketWrites += 1;
    },
  });
  worker.setAuthorization("Bearer test-token");

  await worker.tick();

  assert.equal(socketWrites, 0);
  assert.match(failure, /A4 format/);
});
test("virtual ESC/POS printer receives cancellation once and job completes", async () => {
  const chunks: Buffer[] = [];
  const server = createServer((socket) => {
    socket.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  let claimed = false;
  let receiptRequests = 0;
  let completed = 0;
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "desktop-device-1",
    deviceId: "device-1",
    deviceToken: "device-secret",
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.endsWith("/dispatching")) return jsonResponse({});
      if (url.endsWith("/printers")) {
        return jsonResponse([
          {
            id: "printer-1",
            name: "Kassa",
            status: "ONLINE",
            metadata: {
              host: "127.0.0.1",
              port: address.port,
              paperWidthMm: 58,
            },
          },
        ]);
      }
      if (url.endsWith("/print-jobs/claim")) {
        if (claimed) return jsonResponse(null);
        claimed = true;
        return jsonResponse({
          id: "job-1",
          receiptId: "receipt-1",
          leaseToken: "lease-1",
          receipt: {
            receiptNumber: "CANCEL-1",
            documentType: "CANCELLATION",
            orderId: "order-1",
          },
          payload: {
            documentType: "CANCELLATION",
            orderNumber: "42",
            items: [
              {
                name: "Achchiq katta lavash qo'shimcha pishloq",
                quantity: "1",
                total: "39000",
              },
            ],
          },
          printer: {
            id: "printer-1",
            name: "Kassa",
            metadata: {
              host: "127.0.0.1",
              port: address.port,
              paperWidthMm: 58,
            },
          },
        });
      }
      if (url.endsWith("/receipts/receipt-1")) {
        receiptRequests += 1;
        return jsonResponse({
          receiptNumber: "CANCEL-1",
          escpos: {
            commands: [
              { type: "align", value: "center" },
              { type: "bold", value: true },
              { type: "text", value: "BUYURTMA BEKOR QILINDI" },
              {
                type: "item",
                quantity: "1",
                name: "Achchiq katta lavash qo'shimcha pishloq",
                notes: "z".repeat(35),
                total: "39000",
              },
              { type: "line" },
              { type: "cut" },
            ],
          },
        });
      }
      if (url.endsWith("/complete")) {
        completed += 1;
        return jsonResponse({ id: "job-1", status: "SUBMITTED" });
      }
      throw new Error(`Unexpected request: ${url}`);
    },
  });
  worker.setAuthorization("Bearer test-token");

  try {
    await worker.tick();
    await worker.tick();
    await new Promise((resolve) => setTimeout(resolve, 20));
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }

  const payload = Buffer.concat(chunks);
  assert.equal(completed, 1);
  assert.equal(receiptRequests, 1);
  assert.deepEqual([...payload.subarray(0, 2)], [0x1b, 0x40]);
  assert.match(payload.toString("utf8"), /BUYURTMA BEKOR QILINDI/);
  assert.match(
    payload.toString("utf8"),
    /1x Achchiq katta lavash\nqo'shimcha pishloq/,
  );
  assert.ok(
    payload.includes(
      Buffer.from(
        "  " + "z".repeat(30) + "\n  " + "z".repeat(5) + "\n",
        "utf8",
      ),
    ),
  );
  assert.ok(payload.includes(Buffer.from("-".repeat(32) + "\n", "utf8")));
  assert.ok(!payload.includes(Buffer.from("-".repeat(48) + "\n", "utf8")));
  assert.deepEqual([...payload.subarray(-3)], [0x1d, 0x56, 0x00]);
});

test("lost completion and failure acknowledgements do not duplicate TCP printer output", async () => {
  const targetStates = new Map<string, "printed" | "ambiguous">();
  const key = "server:job-lost-ack:tcp://127.0.0.1:9100";
  let claimCount = 0;
  let completionCount = 0;
  let physicalPrints = 0;
  const failureOutcomes: string[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/dispatching")) return jsonResponse({});
    if (url.endsWith("/printers")) {
      return jsonResponse([
        {
          id: "tcp-printer",
          name: "Kitchen TCP",
          status: "ONLINE",
          metadata: { host: "127.0.0.1", port: 9100, paperWidthMm: 58 },
        },
      ]);
    }
    if (url.endsWith("/print-jobs/claim")) {
      claimCount += 1;
      if (claimCount > 2) return jsonResponse(null);
      return jsonResponse({
        id: "job-lost-ack",
        receiptId: "receipt-lost-ack",
        leaseToken: `lease-${claimCount}`,
        receipt: { receiptNumber: "R-1", documentType: "RECEIPT" },
        printer: {
          id: "tcp-printer",
          name: "Kitchen TCP",
          metadata: { host: "127.0.0.1", port: 9100, paperWidthMm: 58 },
        },
      });
    }
    if (url.endsWith("/receipts/receipt-lost-ack")) {
      return jsonResponse({
        receiptNumber: "R-1",
        documentType: "RECEIPT",
        escpos: { commands: [{ type: "text", value: "Order R-1" }] },
      });
    }
    if (url.endsWith("/complete")) {
      completionCount += 1;
      if (completionCount === 1) throw new Error("server acknowledgement lost");
      return jsonResponse({ id: "job-lost-ack", status: "SUBMITTED" });
    }
    if (url.endsWith("/fail")) {
      const body = JSON.parse(String(init?.body)) as { outcome?: string };
      failureOutcomes.push(body.outcome ?? "FAILED");
      throw new Error("failure acknowledgement lost");
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  const localQueue = {
    claim: () => null,
    complete: () => undefined,
    fail: () => undefined,
    wasPrinted: () => false,
    wasTargetPrinted: (
      _scope: "local" | "server",
      _jobId: string,
      name: string,
    ) => targetStates.get(`server:job-lost-ack:${name}`) === "printed",
    wasTargetAmbiguous: (
      _scope: "local" | "server",
      _jobId: string,
      name: string,
    ) => targetStates.get(`server:job-lost-ack:${name}`) === "ambiguous",
    markTargetPrinted: (
      _scope: "local" | "server",
      _jobId: string,
      name: string,
    ) => targetStates.set(`server:job-lost-ack:${name}`, "printed"),
    markTargetAmbiguous: (
      _scope: "local" | "server",
      _jobId: string,
      name: string,
    ) => targetStates.set(`server:job-lost-ack:${name}`, "ambiguous"),
    clearTargetAmbiguous: (
      _scope: "local" | "server",
      _jobId: string,
      name: string,
    ) => {
      const targetKey = `server:job-lost-ack:${name}`;
      if (targetStates.get(targetKey) === "ambiguous")
        targetStates.delete(targetKey);
    },
  };
  const createWorkerWithPersistentQueue = () => {
    const worker = new DesktopPrintWorker({
      apiUrl: "https://api.example.test/api/v1",
      printerHost: null,
      agentId: "desktop-device-1",
      deviceId: "device-1",
      deviceToken: "device-secret",
      localQueue,
      fetchImpl,
      socketImpl: async (_host, _port, payload) => {
        if (payload?.length) physicalPrints += 1;
      },
    });
    worker.setAuthorization("Bearer test-token");
    return worker;
  };

  await createWorkerWithPersistentQueue().tick();
  assert.equal(physicalPrints, 1);
  assert.equal(failureOutcomes[0], "AMBIGUOUS");
  assert.equal(targetStates.get(key), "printed");

  await createWorkerWithPersistentQueue().tick();
  assert.equal(physicalPrints, 1);
  assert.equal(completionCount, 2);
  assert.equal(claimCount, 3);
});

test("partial server fan-out success is marked ambiguous instead of replaying every printer", async () => {
  const targetStates = new Map<string, "printed" | "ambiguous">();
  let claims = 0;
  let printed = 0;
  let completed = 0;
  let failureOutcome: string | undefined;
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "desktop-device-1",
    deviceId: "device-1",
    systemPrinters: [
      { name: "Till A", displayName: "Till A", roles: ["RECEIPT"] },
      { name: "Till B", displayName: "Till B", roles: ["RECEIPT"] },
    ],
    printSystem: async (name) => {
      if (name === "Till B") throw new Error("Windows queue is offline");
      printed += 1;
    },
    localQueue: {
      claim: () => null,
      complete: () => undefined,
      fail: () => undefined,
      wasPrinted: () => false,
      wasTargetPrinted: (_scope, jobId, name) =>
        targetStates.get(`${jobId}:${name}`) === "printed",
      wasTargetAmbiguous: (_scope, jobId, name) =>
        targetStates.get(`${jobId}:${name}`) === "ambiguous",
      markTargetPrinted: (_scope, jobId, name) =>
        targetStates.set(`${jobId}:${name}`, "printed"),
      markTargetAmbiguous: (_scope, jobId, name) =>
        targetStates.set(`${jobId}:${name}`, "ambiguous"),
      clearTargetAmbiguous: (_scope, jobId, name) => {
        if (targetStates.get(`${jobId}:${name}`) === "ambiguous") {
          targetStates.delete(`${jobId}:${name}`);
        }
      },
    },
    fetchImpl: async (input, init) => {
      const url = String(input);
      if (url.endsWith("/dispatching")) return jsonResponse({});
      if (url.endsWith("/printers")) return jsonResponse([]);
      if (url.endsWith("/print-jobs/claim")) {
        claims += 1;
        return jsonResponse(
          claims === 1
            ? {
                id: "partial-fanout",
                receiptId: "partial-receipt",
                leaseToken: "lease-partial",
                payload: {
                  documentType: "RECEIPT",
                  orderNumber: "M-104",
                  items: [{ name: "Lavash", quantity: "1", total: "39000" }],
                },
                printer: null,
              }
            : null,
        );
      }
      if (url.endsWith("/complete")) {
        completed += 1;
        return jsonResponse({});
      }
      if (url.endsWith("/fail")) {
        failureOutcome = (
          JSON.parse(String(init?.body)) as { outcome?: string }
        ).outcome;
        return jsonResponse({});
      }
      throw new Error(`Unexpected request: ${url}`);
    },
  });
  worker.setAuthorization("Bearer test-token");

  await worker.tick();

  assert.equal(printed, 1);
  assert.equal(completed, 0);
  assert.equal(failureOutcome, "AMBIGUOUS");
  assert.equal(targetStates.get("partial-fanout:Till A"), "printed");
  assert.equal(targetStates.has("partial-fanout:Till B"), false);
});

function createWorker(fetchImpl: typeof fetch): DesktopPrintWorker {
  return new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "desktop-device-1",
    deviceId: "device-1",
    deviceToken: "device-secret",
    fetchImpl,
  });
}

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

test("hung Windows printer is timed out as ambiguous and the offline queue keeps draining", async () => {
  const jobs = [
    {
      id: "hung-job",
      logicalKey: "order-hung:RECEIPT",
      branchId: "branch-1",
      documentType: "RECEIPT",
      payloadJson: JSON.stringify({ orderId: "order-hung" }),
      attempts: 1,
    },
    {
      id: "next-job",
      logicalKey: "order-next:RECEIPT",
      branchId: "branch-1",
      documentType: "RECEIPT",
      payloadJson: JSON.stringify({ orderId: "order-next" }),
      attempts: 1,
    },
  ];
  const failures: Array<{ id: string; error: string; ambiguous?: boolean }> =
    [];
  const completed: string[] = [];
  const printedTargets = new Set<string>();
  const ambiguousTargets = new Set<string>();
  const printedOrders: string[] = [];
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "desktop-device-1",
    deviceId: "device-1",
    printTimeoutMs: 15,
    systemPrinters: [
      { name: "Till A", displayName: "Till A", roles: ["RECEIPT"] },
    ],
    printSystem: async (_name, receipt) => {
      if (receipt.orderId === "order-hung") return new Promise<void>(() => {});
      printedOrders.push(receipt.orderId ?? "");
    },
    localQueue: {
      claim: () => jobs.shift() ?? null,
      complete: (id) => completed.push(id),
      fail: (id, error, ambiguous) => failures.push({ id, error, ambiguous }),
      wasPrinted: () => false,
      wasTargetPrinted: (scope, jobId, name) =>
        printedTargets.has(scope + ":" + jobId + ":" + name),
      markTargetPrinted: (scope, jobId, name) => {
        const key = scope + ":" + jobId + ":" + name;
        printedTargets.add(key);
        ambiguousTargets.delete(key);
      },
      markTargetAmbiguous: (scope, jobId, name) =>
        ambiguousTargets.add(scope + ":" + jobId + ":" + name),
    },
  });

  const startedAt = Date.now();
  await worker.tick();

  assert.ok(Date.now() - startedAt < 500);
  assert.equal(failures.length, 1);
  assert.equal(failures[0]?.id, "hung-job");
  assert.equal(failures[0]?.ambiguous, true);
  assert.match(failures[0]?.error ?? "", /qog'ozni tekshir/i);
  assert.deepEqual([...ambiguousTargets], ["local:hung-job:Till A"]);
  assert.deepEqual(completed, ["next-job"]);
  assert.deepEqual(printedOrders, ["order-next"]);
});

test("noaniq printer faqat operator qayta yuborganda chop etiladi", async () => {
  const targetStates = new Map<string, "printed" | "ambiguous">([
    ["Till A", "printed"],
    ["Till B", "ambiguous"],
  ]);
  const printed: string[] = [];
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "desktop-device-1",
    deviceId: "device-1",
    systemPrinters: [
      { name: "Till A", displayName: "Till A", roles: ["RECEIPT"] },
      { name: "Till B", displayName: "Till B", roles: ["RECEIPT"] },
    ],
    printSystem: async (name) => {
      printed.push(name);
    },
    localQueue: {
      claim: () => null,
      complete: () => undefined,
      fail: () => undefined,
      wasPrinted: () => false,
      wasTargetPrinted: (_scope, _jobId, name) =>
        targetStates.get(name) === "printed",
      wasTargetAmbiguous: (_scope, _jobId, name) =>
        targetStates.get(name) === "ambiguous",
      markTargetPrinted: (_scope, _jobId, name) =>
        targetStates.set(name, "printed"),
      markTargetAmbiguous: (_scope, _jobId, name) =>
        targetStates.set(name, "ambiguous"),
    },
  });
  const printTargets = (
    worker as unknown as {
      printSystemTargets: (
        scope: "server",
        jobId: string,
        targets: Array<{ name: string; displayName: string; roles: string[] }>,
        receipt: { documentType: string; content: Record<string, unknown> },
        allowAmbiguousRetry?: boolean,
      ) => Promise<boolean>;
    }
  ).printSystemTargets.bind(worker);
  const targets = [
    { name: "Till A", displayName: "Till A", roles: ["RECEIPT"] },
    { name: "Till B", displayName: "Till B", roles: ["RECEIPT"] },
  ];
  const receipt = {
    documentType: "RECEIPT",
    content: { documentType: "RECEIPT" },
  };

  await assert.rejects(
    printTargets("server", "ambiguous-job", targets, receipt),
    /oldingi chop etish natijasi noaniq/i,
  );
  assert.deepEqual(printed, []);

  await printTargets("server", "ambiguous-job", targets, receipt, true);
  assert.deepEqual(printed, ["Till B"]);
  assert.equal(targetStates.get("Till B"), "printed");
});

test("fan-out retry skips printers already confirmed successful", async () => {
  const job = {
    id: "fanout-job",
    logicalKey: "order-fanout:RECEIPT",
    branchId: "branch-1",
    documentType: "RECEIPT",
    payloadJson: JSON.stringify({ orderId: "order-fanout" }),
    attempts: 1,
  };
  const printedTargets = new Set<string>();
  const printed: string[] = [];
  let phase = 0;
  let failed = false;
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "desktop-device-1",
    deviceId: "device-1",
    printTimeoutMs: 30,
    systemPrinters: [
      { name: "Till A", displayName: "Till A", roles: ["RECEIPT"] },
      { name: "Till B", displayName: "Till B", roles: ["RECEIPT"] },
    ],
    printSystem: async (name) => {
      printed.push(name);
      if (name === "Till B" && !failed) {
        failed = true;
        throw new Error("Printer offline");
      }
    },
    localQueue: {
      claim: () => {
        if (phase === 0) {
          phase = 1;
          return job;
        }
        if (phase === 2) {
          phase = 3;
          return job;
        }
        return null;
      },
      complete: () => undefined,
      fail: () => undefined,
      wasPrinted: () => false,
      wasTargetPrinted: (_scope, jobId, name) =>
        printedTargets.has(jobId + ":" + name),
      markTargetPrinted: (_scope, jobId, name) =>
        printedTargets.add(jobId + ":" + name),
    },
  });

  await worker.tick();
  phase = 2;
  await worker.tick();

  assert.deepEqual(printed, ["Till A", "Till B", "Till B"]);
});

test("TCP send timeout is reported as an ambiguous printer result", async () => {
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "desktop-device-1",
    deviceId: "device-1",
    printTimeoutMs: 12,
    socketImpl: () => new Promise<void>(() => {}),
  });
  const send = (
    worker as unknown as {
      send: (
        commands: Array<Record<string, unknown>>,
        host: string,
        port: number,
        paperWidthMm: number,
      ) => Promise<void>;
    }
  ).send.bind(worker);

  await assert.rejects(
    () => send([{ type: "line", value: "test" }], "printer.local", 9100, 80),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "PRINT_OUTCOME_UNKNOWN",
  );
});
