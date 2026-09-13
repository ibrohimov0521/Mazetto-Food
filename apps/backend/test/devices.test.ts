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
