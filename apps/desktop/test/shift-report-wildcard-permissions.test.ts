import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DesktopGateway } from "../src/gateway.js";
import { DesktopStore } from "../src/store.js";

function globalOwnerToken(): string {
  const payload = Buffer.from(
    JSON.stringify({
      id: "owner-a",
      branchId: "global",
      employeeId: "employee-a",
      isGlobalScope: true,
      permissions: ["*"],
    }),
  ).toString("base64url");
  return `Bearer header.${payload}.signature`;
}

test("Desktop shift report accepts the wildcard all-permissions claim", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-global-shift-report-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  store.setSetting(
    "system_printers",
    JSON.stringify([{ name: "Reports", roles: ["SHIFT_REPORT"] }]),
  );
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    probeIntervalMs: 60_000,
    fetchImpl: async () =>
      new Response(JSON.stringify({ success: true, data: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  });

  try {
    const port = await gateway.start();
    const response = await fetch(
      `http://127.0.0.1:${port}/api/v1/desktop/prints/shift-report`,
      {
        method: "POST",
        headers: {
          Authorization: globalOwnerToken(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentType: "SHIFT_REPORT",
          requestId: "global-report-1",
          branchId: "branch-a",
          shift: {
            id: "shift-a",
            employeeId: "employee-b",
            branch: { id: "branch-a", name: "Sergeli" },
          },
          orders: [],
        }),
      },
    );

    assert.equal(response.status, 202);
    assert.deepEqual((await response.json()).data, {
      queued: true,
      printerConfigured: true,
    });
    assert.equal(store.summary().pendingPrintJobs, 1);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
