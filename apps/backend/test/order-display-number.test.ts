import assert from "node:assert/strict";
import { OrderSource } from "@prisma/client";
import test from "node:test";
import { allocateDisplayOrderNumber, parseDisplayOrderDate } from "../src/modules/orders/order-display-number";


test("offline display dates are strict and cannot be in the future", () => {
  const now = new Date("2026-10-13T07:00:00.000Z");
  assert.equal(
    parseDisplayOrderDate("2026-10-12", now)?.toISOString(),
    "2026-10-12T12:00:00.000Z",
  );
  assert.equal(parseDisplayOrderDate("2026-02-30", now), null);
  assert.equal(parseDisplayOrderDate("2026-10-13T00:00:00Z", now), null);
  assert.equal(parseDisplayOrderDate("2026-10-14", now), null);
});
test("display order sequences and locks are isolated by restaurant tenant", async () => {
  const lockKeys: string[] = [];
  const queriedTenants: string[] = [];
  const tx = {
    $executeRaw: async (_query: TemplateStringsArray, ...values: unknown[]) => {
      lockKeys.push(String(values[0]));
      return 1;
    },
    $queryRaw: async (_query: TemplateStringsArray, ...values: unknown[]) => {
      const tenantId = String(values[1]);
      queriedTenants.push(tenantId);
      return tenantId === "tenant-b" ? [{ sequence: 980 }] : [];
    },
  };

  const tenantA = await allocateDisplayOrderNumber(
    tx as never,
    "tenant-a",
    OrderSource.POS,
    new Date("2026-10-13T06:00:00.000Z"),
    1,
  );
  const tenantB = await allocateDisplayOrderNumber(
    tx as never,
    "tenant-b",
    OrderSource.POS,
    new Date("2026-10-13T06:00:00.000Z"),
    1,
  );
  const tenantC = await allocateDisplayOrderNumber(
    tx as never,
    "tenant-c",
    OrderSource.WEB,
    new Date("2026-10-13T06:00:00.000Z"),
  );
  await allocateDisplayOrderNumber(
    tx as never,
    "tenant-a",
    OrderSource.POS,
    new Date("2026-10-12T12:00:00.000Z"),
    1,
  );

  assert.equal(tenantA.displayOrderSequence, 1);
  assert.equal(tenantB.displayOrderSequence, 981);
  assert.equal(tenantC.displayOrderSequence, 101);
  assert.deepEqual(queriedTenants, ["tenant-a", "tenant-b", "tenant-c", "tenant-a"]);
  assert.equal(new Set(lockKeys).size, 4);
  assert.ok(lockKeys.includes("order-display:tenant-a:POS:2026-10-12"));
  assert.ok(lockKeys.includes("order-display:tenant-a:POS:2026-10-13"));
});
