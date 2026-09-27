import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { ShiftsService } from "../src/modules/shifts/shifts.service";

const owner: AuthenticatedUser = {
  id: "owner-a",
  isGlobalScope: true,
  roles: ["SUPER_ADMIN"],
  permissions: [],
};

test("shift list and cash-transfer detail are tenant filtered", async () => {
  const filters: Record<string, unknown>[] = [];
  const service = new ShiftsService({
    restaurantTenant: { findMany: async () => [{ id: "tenant-a" }] },
    shift: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        filters.push(args.where);
        return [];
      },
    },
    cashTransfer: {
      findFirst: async (args: { where: Record<string, unknown> }) => {
        filters.push(args.where);
        return null;
      },
    },
  } as never);

  await service.listShifts({ offset: 0, limit: 20 }, owner);
  await assert.rejects(service.getCashTransferDetail("transfer-b", owner));
  assert.deepEqual(filters[0]?.branch, { tenantId: "tenant-a" });
  assert.deepEqual(filters[1]?.branch, { tenantId: "tenant-a" });
});

test("shift data is not queried when active tenant context is ambiguous", async () => {
  let shiftReads = 0;
  const service = new ShiftsService({
    restaurantTenant: {
      findMany: async () => [{ id: "tenant-a" }, { id: "tenant-b" }],
    },
    shift: {
      findMany: async () => {
        shiftReads += 1;
        return [];
      },
    },
  } as never);

  await assert.rejects(service.listShifts({ offset: 0, limit: 20 }, owner));
  assert.equal(shiftReads, 0);
});
