import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { DevicesService } from "../src/modules/devices/devices.service";
import { DevicesController } from "../src/modules/devices/devices.controller";
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

test("public enrollment selects tenant only from a verified request host", async () => {
  const calls: Array<{ dto: unknown; tenantId: string }> = [];
  const controller = new DevicesController(
    {
      enroll: async (dto: unknown, tenantId: string) => {
        calls.push({ dto, tenantId });
        return { tenantId };
      },
    } as never,
    {
      resolve: async (host: string | undefined) =>
        host === "a.restaurant.test"
          ? { kind: "TRUSTED" as const, hostname: host, tenantId: "tenant-a" }
          : host === "b.restaurant.test"
            ? { kind: "TRUSTED" as const, hostname: host, tenantId: "tenant-b" }
            : { kind: "UNREGISTERED" as const, hostname: host },
    } as never,
  );
  const dto = { deviceId: "desktop-a", enrollmentCode: "CODE-A" };

  assert.deepEqual(
    await controller.enroll(dto, { headers: { host: "a.restaurant.test" } } as never),
    { tenantId: "tenant-a" },
  );
  assert.deepEqual(
    await controller.enroll(dto, { headers: { host: "b.restaurant.test" } } as never),
    { tenantId: "tenant-b" },
  );
  await assert.rejects(
    controller.enroll(dto, { headers: { host: "unknown.test" } } as never),
    /verified active restaurant domain/,
  );
  assert.deepEqual(calls.map((call) => call.tenantId), ["tenant-a", "tenant-b"]);
});

test("device code lookup does not depend on the global active-tenant count", async () => {
  const filters: Record<string, unknown>[] = [];
  const service = new DevicesService({
    device: {
      findFirst: async (args: { where: Record<string, unknown> }) => {
        filters.push(args.where);
        return null;
      },
    },
  } as never);

  await Promise.all([
    assert.rejects(
      service.enroll({ deviceId: "desktop-a", enrollmentCode: "A" }, "tenant-a"),
      /invalid or expired/,
    ),
    assert.rejects(
      service.enroll({ deviceId: "desktop-b", enrollmentCode: "B" }, "tenant-b"),
      /invalid or expired/,
    ),
  ]);

  assert.deepEqual(filters.map((where) => where.branch), [
    { tenantId: "tenant-a" },
    { tenantId: "tenant-b" },
  ]);
  assert.ok(filters.every((where) => where.isActive === true));
});
test("device enrollment only rebinds hardware within the selected tenant", async () => {
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

  await service.enroll({ deviceId: "hardware-a", enrollmentCode: "ABC123" }, "tenant-a");
  assert.deepEqual(enrollmentFilter?.branch, { tenantId: "tenant-a" });
  assert.deepEqual(claimFilter?.branch, { tenantId: "tenant-a" });
  assert.deepEqual(unbindFilter?.branch, { tenantId: "tenant-a" });
});
