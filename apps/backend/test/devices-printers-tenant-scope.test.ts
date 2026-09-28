import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { DevicesService } from "../src/modules/devices/devices.service";
import { PrintersService } from "../src/modules/printers/printers.service";

const owner: AuthenticatedUser = {
  id: "owner-a",
  isGlobalScope: true,
  roles: ["SUPER_ADMIN"],
  permissions: [],
};

test("device and printer lists are constrained to the active tenant", async () => {
  const filters = new Map<string, Record<string, unknown>>();
  const common = {
    restaurantTenant: { findMany: async () => [{ id: "tenant-a" }] },
    device: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        filters.set("devices", args.where);
        return [];
      },
    },
    printer: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        filters.set("printers", args.where);
        return [];
      },
    },
  };
  await new DevicesService(common as never).listDevices(undefined, owner);
  await new PrintersService(common as never).listPrinters(undefined, owner);
  assert.deepEqual(filters.get("devices")?.branch, { tenantId: "tenant-a" });
  assert.deepEqual(filters.get("printers")?.branch, { tenantId: "tenant-a" });
});

test("device enrollment only rebinds hardware within the active tenant", async () => {
  let enrollmentFilter: Record<string, unknown> | undefined;
  let claimFilter: Record<string, unknown> | undefined;
  let unbindFilter: Record<string, unknown> | undefined;
  const service = new DevicesService({
    restaurantTenant: { findMany: async () => [{ id: "tenant-a" }] },
    device: {
      findFirst: async (args: { where: Record<string, unknown> }) => {
        enrollmentFilter = args.where;
        return { id: "device-a", branchId: "branch-a" };
      },
    },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        device: {
          updateMany: async (args: { where: Record<string, unknown> }) => {
            if (Object.hasOwn(args.where, "enrollmentCodeHash")) {
              claimFilter = args.where;
              return { count: 1 };
            }
            unbindFilter = args.where;
            return { count: 0 };
          },
          update: async () => ({
            id: "device-a",
            branchId: "branch-a",
            name: "POS",
            type: "POS",
            enrolledAt: new Date(),
          }),
        },
      }),
  } as never);

  await service.enroll({ deviceId: "hardware-a", enrollmentCode: "ABC123" });
  assert.deepEqual(enrollmentFilter?.branch, { tenantId: "tenant-a" });
  assert.deepEqual(claimFilter?.branch, { tenantId: "tenant-a" });
  assert.deepEqual(unbindFilter?.branch, { tenantId: "tenant-a" });
});
