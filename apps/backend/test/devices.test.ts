import assert from "node:assert/strict";
import test from "node:test";
import { DevicesService } from "../src/modules/devices/devices.service";

const branchManager = {
  id: "manager",
  branchId: "branch-1",
  isGlobalScope: false,
  roles: ["BRANCH_MANAGER"],
  permissions: ["DEVICE_VIEW", "DEVICE_MANAGE"],
};

test("filial qurilmalari faqat actor filialidan olinadi", async () => {
  let where: unknown;
  const service = new DevicesService({
    branch: { findUnique: async () => ({ tenantId: "tenant-a" }) },
    device: {
      findMany: async (args: { where: unknown }) => {
        where = args.where;
        return [];
      },
    },
  } as never);

  await service.listDevices(undefined, branchManager);
  assert.deepEqual(where, { branchId: "branch-1" });
  await assert.rejects(
    service.listDevices("branch-2", branchManager),
    /Boshqa filialga/,
  );
});

test("qurilma matn maydonlari normallashtirib saqlanadi", async () => {
  let data: Record<string, unknown> | undefined;
  let auditAction: string | undefined;
  const tx = {
    device: {
      create: async (args: { data: Record<string, unknown> }) => {
        data = args.data;
        return { id: "device-1", ...args.data };
      },
    },
    auditLog: {
      create: async (args: { data: { action: string } }) => {
        auditAction = args.data.action;
      },
    },
  };
  const service = new DevicesService({
    branch: {
      findUnique: async () => ({ id: "branch-1", tenantId: "tenant-a" }),
      findFirst: async () => ({ id: "branch-1" }),
    },
    $transaction: async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
  } as never);

  await service.createDevice(
    {
      branchId: "branch-1",
      name: "  Kassa 1  ",
      type: "POS_TERMINAL",
      os: "  Android  ",
      ipAddress: " ",
      softwareVersion: "  1.4.0 ",
    },
    branchManager,
  );

  assert.equal(data?.name, "Kassa 1");
  assert.equal(data?.os, "Android");
  assert.equal(data?.ipAddress, null);
  assert.equal(data?.softwareVersion, "1.4.0");
  assert.equal(auditAction, "DEVICE_CREATED");
});

test("bo'sh qurilma nomi rad etiladi", async () => {
  const service = new DevicesService({
    branch: {
      findUnique: async () => ({ id: "branch-1", tenantId: "tenant-a" }),
      findFirst: async () => ({ id: "branch-1" }),
    },
  } as never);

  await assert.rejects(
    () =>
      service.createDevice(
        {
          branchId: "branch-1",
          name: "   ",
          type: "POS_TERMINAL",
        },
        branchManager,
      ),
    /Device name is required/,
  );
});

test("boshqa filial qurilmasi tahrirlanmaydi", async () => {
  const service = new DevicesService({
    branch: { findUnique: async () => ({ tenantId: "tenant-a" }) },
    device: {
      findFirst: async () => null,
    },
  } as never);

  await assert.rejects(
    () =>
      service.updateDevice("device-2", { name: "Boshqa nom" }, branchManager),
    /Device not found/,
  );
});

test("faol qurilma heartbeatda oxirgi xodim va vaqtni yangilaydi", async () => {
  let updateData: Record<string, unknown> | undefined;
  const service = new DevicesService({
    branch: { findUnique: async () => ({ tenantId: "tenant-a" }) },
    device: {
      findFirst: async () => ({
        id: "device-1",
        branchId: "branch-1",
        isActive: true,
      }),
      update: async (args: { data: Record<string, unknown> }) => {
        updateData = args.data;
        return args;
      },
    },
  } as never);

  const result = await service.heartbeat(" device-1 ", " 0.1.0 ", {
    ...branchManager,
    employeeId: "employee-1",
  });

  assert.equal(result.deviceId, "device-1");
  assert.equal(result.branchId, "branch-1");
  assert.equal(updateData?.lastEmployeeId, "employee-1");
  assert.equal(updateData?.softwareVersion, "0.1.0");
  assert.ok(updateData?.lastSeenAt instanceof Date);
});

test("o'chirilgan qurilma heartbeat qabul qilinmaydi", async () => {
  const service = new DevicesService({
    branch: { findUnique: async () => ({ tenantId: "tenant-a" }) },
    device: {
      findFirst: async () => ({
        id: "device-1",
        branchId: "branch-1",
        isActive: false,
      }),
    },
  } as never);

  await assert.rejects(
    () => service.heartbeat("device-1", undefined, branchManager),
    /Device is disabled/,
  );
});

test("enrollment kodi muddati va hash tekshiruvidan o'tadi", async () => {
  const service = new DevicesService({
    restaurantTenant: { findMany: async () => [{ id: "tenant-a" }] },
    device: {
      findFirst: async () => null,
    },
  } as never);

  await assert.rejects(
    () => service.enroll({ deviceId: "device-1", enrollmentCode: "wrong" }),
    /invalid or expired/,
  );
});

test("enrollment muvaffaqiyatli bo'lganda kod bir martalik tozalanadi", async () => {
  let claimData: Record<string, unknown> | undefined;
  let updateData: Record<string, unknown> | undefined;
  const crypto = await import("node:crypto");
  const code = "ABC123DEF456";
  const codeHash = crypto.createHash("sha256").update(code).digest("hex");
  const service = new DevicesService({
    restaurantTenant: { findMany: async () => [{ id: "tenant-a" }] },
    device: {
      findFirst: async () => ({
        id: "device-1",
        branchId: "branch-1",
        name: "Kassa 1",
        type: "POS_TERMINAL",
        isActive: true,
        enrollmentCodeHash: codeHash,
        enrollmentExpiresAt: new Date(Date.now() + 60_000),
      }),
    },
    $transaction: async (
      callback: (client: {
        device: {
          updateMany: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<{ count: number }>;
          update: (args: { data: Record<string, unknown> }) => Promise<unknown>;
        };
      }) => Promise<unknown>,
    ) =>
      callback({
        device: {
          updateMany: async (args) => {
            if (Object.hasOwn(args.where, "enrollmentCodeHash")) {
              claimData = args.data;
              return { count: 1 };
            }
            return { count: 0 };
          },
          update: async (args) => {
            updateData = args.data;
            return {
              id: "device-1",
              branchId: "branch-1",
              name: "Kassa 1",
              type: "POS_TERMINAL",
              enrolledAt: new Date(),
            };
          },
        },
      }),
  } as never);

  const result = await service.enroll({
    deviceId: "desktop-uuid-1",
    enrollmentCode: code,
    softwareVersion: "0.1.5",
  });

  assert.equal(updateData?.hardwareId, "desktop-uuid-1");
  assert.equal(typeof result.deviceToken, "string");
  assert.ok(result.deviceToken.length >= 40);
  assert.equal(
    claimData?.deviceAuthTokenHash,
    crypto.createHash("sha256").update(result.deviceToken).digest("hex"),
  );
  assert.equal(claimData?.enrollmentCodeHash, null);
  assert.equal(claimData?.enrollmentExpiresAt, null);
  assert.ok(claimData?.enrolledAt instanceof Date);
});
test("enrollment code can only be claimed once under concurrent requests", async () => {
  const crypto = await import("node:crypto");
  const code = "ABC123DEF456";
  const codeHash = crypto.createHash("sha256").update(code).digest("hex");
  const updateManyFilters: Record<string, unknown>[] = [];
  let deviceWrites = 0;
  const service = new DevicesService({
    restaurantTenant: { findMany: async () => [{ id: "tenant-a" }] },
    device: {
      findFirst: async () => ({
        id: "device-a",
        branchId: "branch-a",
        isActive: true,
        enrollmentCodeHash: codeHash,
        enrollmentExpiresAt: new Date(Date.now() + 60_000),
      }),
    },
    $transaction: async (
      callback: (client: {
        device: {
          updateMany: (args: { where: Record<string, unknown> }) => Promise<{ count: number }>;
          update: () => Promise<unknown>;
        };
      }) => Promise<unknown>,
    ) => callback({
      device: {
        updateMany: async (args) => {
          if (Object.hasOwn(args.where, "enrollmentCodeHash")) {
            updateManyFilters.push(args.where);
            return { count: updateManyFilters.length === 1 ? 1 : 0 };
          }
          return { count: 0 };
        },
        update: async () => {
          deviceWrites += 1;
          return { id: "device-a" };
        },
      },
    }),
  } as never);

  const outcomes = await Promise.allSettled([
    service.enroll({ deviceId: "desktop-uuid-2", enrollmentCode: code }),
    service.enroll({ deviceId: "desktop-uuid-3", enrollmentCode: code }),
  ]);

  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  assert.equal(outcomes.filter((outcome) => outcome.status === "rejected").length, 1);
  assert.equal(updateManyFilters.length, 2, "both requests must compete for the one-time claim");
  for (const filter of updateManyFilters) {
    assert.deepEqual(filter.branch, { tenantId: "tenant-a" });
    assert.equal(filter.enrollmentCodeHash, codeHash);
  }
  assert.equal(deviceWrites, 1, "only the request that claims the code may write the device");
});
