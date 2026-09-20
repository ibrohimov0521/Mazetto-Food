import assert from "node:assert/strict";
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
