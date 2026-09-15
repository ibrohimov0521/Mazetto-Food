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
    device: {
      findMany: async (args: { where: unknown }) => {
        where = args.where;
        return [];
      },
    },
  } as never);

  await service.listDevices(undefined, branchManager);
  assert.deepEqual(where, { branchId: "branch-1" });
  assert.throws(
    () => service.listDevices("branch-2", branchManager),
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
    branch: { findUnique: async () => ({ id: "branch-1" }) },
    $transaction: async (callback: (client: typeof tx) => unknown) => callback(tx),
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
    branch: { findUnique: async () => ({ id: "branch-1" }) },
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
    device: {
      findUnique: async () => ({ id: "device-2", branchId: "branch-2" }),
    },
  } as never);

  await assert.rejects(
    () =>
      service.updateDevice(
        "device-2",
        { name: "Boshqa nom" },
        branchManager,
      ),
    /Boshqa filialga/,
  );
});

test("faol qurilma heartbeatda oxirgi xodim va vaqtni yangilaydi", async () => {
  let updateData: Record<string, unknown> | undefined;
  const service = new DevicesService({
    device: {
      findUnique: async () => ({
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

  const result = await service.heartbeat(
    " device-1 ",
    " 0.1.0 ",
    { ...branchManager, employeeId: "employee-1" },
  );

  assert.equal(result.deviceId, "device-1");
  assert.equal(result.branchId, "branch-1");
  assert.equal(updateData?.lastEmployeeId, "employee-1");
  assert.equal(updateData?.softwareVersion, "0.1.0");
  assert.ok(updateData?.lastSeenAt instanceof Date);
});

test("o'chirilgan qurilma heartbeat qabul qilinmaydi", async () => {
  const service = new DevicesService({
    device: {
      findUnique: async () => ({
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
    device: {
      findUnique: async () => ({
        id: "device-1",
        branchId: "branch-1",
        name: "Kassa 1",
        type: "POS_TERMINAL",
        isActive: true,
        enrollmentCodeHash:
          "not-the-code",
        enrollmentExpiresAt: new Date(Date.now() + 60_000),
      }),
    },
  } as never);

  await assert.rejects(
    () => service.enroll({ deviceId: "device-1", enrollmentCode: "wrong" }),
    /invalid or expired/,
  );
});

test("enrollment muvaffaqiyatli bo'lganda kod bir martalik tozalanadi", async () => {
  let updateData: Record<string, unknown> | undefined;
  const crypto = await import("node:crypto");
  const code = "ABC123DEF456";
  const codeHash = crypto.createHash("sha256").update(code).digest("hex");
  const service = new DevicesService({
    device: {
      findUnique: async () => ({
        id: "device-1",
        branchId: "branch-1",
        name: "Kassa 1",
        type: "POS_TERMINAL",
        isActive: true,
        enrollmentCodeHash: codeHash,
        enrollmentExpiresAt: new Date(Date.now() + 60_000),
      }),
      update: async (args: { data: Record<string, unknown> }) => {
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
  } as never);

  await service.enroll({
    deviceId: "device-1",
    enrollmentCode: code,
    softwareVersion: "0.1.5",
  });

  assert.equal(updateData?.enrollmentCodeHash, null);
  assert.equal(updateData?.enrollmentExpiresAt, null);
  assert.ok(updateData?.enrolledAt instanceof Date);
});
