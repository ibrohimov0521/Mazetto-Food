import assert from "node:assert/strict";
import test from "node:test";
import {
  AmbiguousPrintError,
  hasPrintQueueTarget,
  pollPrintJob,
  type AgentRequest,
  type PrintQueueConfig,
  type PrintQueueState,
} from "../src/print-job-runner";

const config: PrintQueueConfig = {
  agentId: "legacy-agent",
  branchId: "branch/one",
  printerIds: ["printer-receipt"],
  acceptUnassigned: false,
  unassignedRoutes: [],
  mode: "tcp",
};

function makeState(): PrintQueueState {
  return {
    mode: "idle",
    pendingCount: 0,
    printedCount: 0,
    failedCount: 0,
    lastPrintedAt: null,
    lastReceipt: null,
    lastError: null,
    pollingHalted: false,
  };
}

function jobRequest(
  onRequest: (path: string, init?: RequestInit) => unknown,
): AgentRequest {
  return async <T>(path: string, init?: RequestInit) =>
    onRequest(path, init) as T;
}

const job = {
  id: "job-1",
  receiptId: "receipt-1",
  leaseToken: "lease-token-with-enough-length",
};

const receipt = {
  id: "receipt-1",
  receiptNumber: "MZ-1001",
  printed: false,
  createdAt: "2026-10-11T10:00:00.000Z",
};

test("job claim includes branch, configured printers and unassigned routes", async () => {
  const calls: { path: string; init?: RequestInit }[] = [];
  const state = makeState();
  const request = jobRequest((path, init) => {
    calls.push({ path, init });
    if (path.includes("/claim")) return job;
    if (path === "/receipts/receipt-1") return receipt;
    return {};
  });

  await pollPrintJob(
    { ...config, acceptUnassigned: true, unassignedRoutes: ["KITCHEN"] },
    state,
    request,
    async () => undefined,
  );

  assert.equal(calls[0]?.path, "/receipts/print-jobs/claim?branchId=branch%2Fone");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    agentId: "legacy-agent",
    printerIds: ["printer-receipt"],
    acceptUnassigned: true,
    unassignedRoutes: ["KITCHEN"],
  });
  assert.equal(calls[2]?.path, "/receipts/print-jobs/job-1/complete");
  assert.equal(state.printedCount, 1);
  assert.equal(state.lastReceipt, "MZ-1001");
  assert.equal(state.mode, "ready");
});

test("jobs mode refuses to poll without an explicit printer target", async () => {
  const state = makeState();
  let requestCount = 0;

  assert.equal(
    hasPrintQueueTarget({ ...config, printerIds: [], acceptUnassigned: true }),
    false,
  );
  await pollPrintJob(
    { ...config, printerIds: [], acceptUnassigned: true },
    state,
    jobRequest(() => {
      requestCount += 1;
      return null;
    }),
    async () => undefined,
  );

  assert.equal(requestCount, 0);
  assert.equal(state.mode, "degraded");
  assert.match(state.lastError ?? "", /print routes/);
});

test("ambiguous printer output is dead-lettered instead of retried", async () => {
  let failureBody: Record<string, unknown> | undefined;
  const state = makeState();
  const request = jobRequest((path, init) => {
    if (path.includes("/claim")) return job;
    if (path === "/receipts/receipt-1") return receipt;
    if (path.endsWith("/fail")) {
      failureBody = JSON.parse(String(init?.body));
      return {};
    }
    throw new Error(`Unexpected API path: ${path}`);
  });

  await pollPrintJob(
    config,
    state,
    request,
    async () => {
      throw new AmbiguousPrintError("printer disconnected after accepting data");
    },
  );

  assert.equal(failureBody?.outcome, "AMBIGUOUS");
  assert.equal(failureBody?.leaseToken, job.leaseToken);
  assert.equal(state.failedCount, 1);
  assert.equal(state.mode, "degraded");
});

test("TCP completion failure after output is recorded as ambiguous", async () => {
  let failureBody: Record<string, unknown> | undefined;
  const state = makeState();
  const request = jobRequest((path, init) => {
    if (path.includes("/claim")) return job;
    if (path === "/receipts/receipt-1") return receipt;
    if (path.endsWith("/complete")) throw new Error("API timeout");
    if (path.endsWith("/fail")) {
      failureBody = JSON.parse(String(init?.body));
      return {};
    }
    throw new Error(`Unexpected API path: ${path}`);
  });

  await pollPrintJob(config, state, request, async () => undefined);

  assert.equal(failureBody?.outcome, "AMBIGUOUS");
  assert.match(String(failureBody?.error), /API timeout/);
});

test("pre-print API failure remains retryable, but a failed fail-call is visible", async () => {
  const state = makeState();
  const request = jobRequest((path) => {
    if (path.includes("/claim")) return job;
    if (path === "/receipts/receipt-1") throw new Error("receipt unavailable");
    if (path.endsWith("/fail")) throw new Error("backend unavailable");
    throw new Error(`Unexpected API path: ${path}`);
  });
  let printed = false;

  await pollPrintJob(config, state, request, async () => {
    printed = true;
  });

  assert.equal(printed, false);
  assert.equal(state.failedCount, 1);
  assert.match(state.lastError ?? "", /could not be saved/);
  assert.equal(state.pollingHalted, false);
});

test("file output remains safely retryable if API completion fails", async () => {
  let failureBody: Record<string, unknown> | undefined;
  const state = makeState();
  const request = jobRequest((path, init) => {
    if (path.includes("/claim")) return job;
    if (path === "/receipts/receipt-1") return receipt;
    if (path.endsWith("/complete")) throw new Error("API timeout");
    if (path.endsWith("/fail")) {
      failureBody = JSON.parse(String(init?.body));
      return {};
    }
    throw new Error(`Unexpected API path: ${path}`);
  });

  await pollPrintJob({ ...config, mode: "file" }, state, request, async () => undefined);

  assert.equal(failureBody?.outcome, "FAILED");
});

test("agent halts polling when an ambiguous paper outcome cannot be persisted", async () => {
  const state = makeState();
  const request = jobRequest((path) => {
    if (path.includes("/claim")) return job;
    if (path === "/receipts/receipt-1") return receipt;
    if (path.endsWith("/fail")) throw new Error("backend unavailable");
    throw new Error(`Unexpected API path: ${path}`);
  });

  await pollPrintJob(config, state, request, async () => {
    throw new AmbiguousPrintError("printer accepted data before disconnecting");
  });

  assert.equal(state.pollingHalted, true);
  assert.equal(state.mode, "degraded");
  assert.match(state.lastError ?? "", /could not be saved/);
});
