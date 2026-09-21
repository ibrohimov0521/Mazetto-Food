import assert from "node:assert/strict";
import { createServer } from "node:net";
import test from "node:test";
import { DesktopPrintWorker } from "../src/print-worker.js";

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
    if (url.endsWith("/printers")) {
      return jsonResponse([
        { id: "printer-ready", isActive: true, status: "ONLINE", metadata: { host: "10.0.0.5", port: 9100 } },
        { id: "printer-offline", isActive: true, status: "OFFLINE", metadata: { host: "10.0.0.6", port: 9100 } },
        { id: "printer-no-host", isActive: true, status: "ONLINE", metadata: {} },
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
        { id: "receipt", name: "Kassa", status: "ONLINE", metadata: { host: "10.0.0.5", port: 9100 } },
        { id: "kitchen", name: "Oshxona", status: "ONLINE", metadata: { host: "10.0.0.6", port: 9101 } },
      ]),
    socketImpl: async (host, port) => {
      connected.push(`${host}:${port}`);
      if (port === 9101) throw new Error("connection refused");
    },
  });
  worker.setAuthorization("Bearer test-token");

  const results = await worker.testManagedConnections();

  assert.deepEqual(connected, ["10.0.0.5:9100", "10.0.0.6:9101"]);
  assert.deepEqual(results.map(({ name, ok }) => ({ name, ok })), [
    { name: "Kassa", ok: true },
    { name: "Oshxona", ok: false },
  ]);
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
  let completed = 0;
  const worker = new DesktopPrintWorker({
    apiUrl: "https://api.example.test/api/v1",
    printerHost: null,
    agentId: "desktop-device-1",
    deviceId: "device-1",
    deviceToken: "device-secret",
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.endsWith("/printers")) {
        return jsonResponse([{ id: "printer-1", name: "Kassa", status: "ONLINE", metadata: { host: "127.0.0.1", port: address.port } }]);
      }
      if (url.endsWith("/print-jobs/claim")) {
        if (claimed) return jsonResponse(null);
        claimed = true;
        return jsonResponse({ id: "job-1", receiptId: "receipt-1", leaseToken: "lease-1", printer: { id: "printer-1", name: "Kassa", metadata: { host: "127.0.0.1", port: address.port } } });
      }
      if (url.endsWith("/receipts/receipt-1")) {
        return jsonResponse({ receiptNumber: "CANCEL-1", escpos: { commands: [
          { type: "align", value: "center" },
          { type: "bold", value: true },
          { type: "text", value: "BUYURTMA BEKOR QILINDI" },
          { type: "item", quantity: "1", name: "Achchiq katta lavash qo'shimcha pishloq", total: "39000" },
          { type: "cut" },
        ] } });
      }
      if (url.endsWith("/complete")) {
        completed += 1;
        return jsonResponse({ id: "job-1", status: "PRINTED" });
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
  assert.deepEqual([...payload.subarray(0, 2)], [0x1b, 0x40]);
  assert.match(payload.toString("utf8"), /BUYURTMA BEKOR QILINDI/);
  assert.match(payload.toString("utf8"), /Achchiq katta lavash/);
  assert.deepEqual([...payload.subarray(-3)], [0x1d, 0x56, 0x00]);
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
