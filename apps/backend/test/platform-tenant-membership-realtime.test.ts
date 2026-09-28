import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { PlatformTenantMembershipService } from "../src/modules/platform-monitoring/platform-tenant-membership.service";

test("suspending a tenant membership disconnects staff sockets after the transaction commits", async () => {
  let transactionCommitted = false;
  let disconnectedUser: string | null = null;
  const tx = {
    tenantMembership: {
      findFirst: async () => ({
        id: "membership-a",
        status: "ACTIVE",
        userId: "staff-a",
      }),
      update: async () => ({ id: "membership-a", status: "SUSPENDED" }),
    },
    auditLog: { create: async () => ({}) },
  };
  const prisma = {
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => {
      const result = await callback(tx);
      transactionCommitted = true;
      return result;
    },
  };
  const gateway = {
    disconnectStaffUser: (userId: string) => {
      assert.equal(transactionCommitted, true);
      disconnectedUser = userId;
    },
  };
  const service = new PlatformTenantMembershipService(
    prisma as never,
    gateway as never,
  );

  const result = await service.setStatus(
    "tenant-a",
    "membership-a",
    "SUSPENDED",
    { id: "owner-a", roles: [], permissions: [] },
  );

  assert.deepEqual(result, { id: "membership-a", status: "SUSPENDED" });
  assert.equal(disconnectedUser, "staff-a");
});

test("replacing tenant membership roles disconnects existing staff sockets", async () => {
  let transactionCommitted = false;
  let disconnectedUser: string | null = null;
  const tx = {
    tenantMembershipRole: {
      deleteMany: async () => ({ count: 1 }),
      createMany: async () => ({ count: 1 }),
    },
    tenantMembership: {
      update: async () => ({ id: "membership-a", roles: [] }),
    },
    auditLog: { create: async () => ({}) },
  };
  const prisma = {
    tenantMembership: {
      findFirst: async () => ({
        id: "membership-a",
        userId: "staff-a",
        branchId: null,
      }),
    },
    role: {
      findMany: async () => [
        { id: "role-manager", code: "MANAGER", isBranchScoped: false },
      ],
    },
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => {
      const result = await callback(tx);
      transactionCommitted = true;
      return result;
    },
  };
  const gateway = {
    disconnectStaffUser: (userId: string) => {
      assert.equal(transactionCommitted, true);
      disconnectedUser = userId;
    },
  };
  const service = new PlatformTenantMembershipService(
    prisma as never,
    gateway as never,
  );

  await service.replaceRoles(
    "tenant-a",
    "membership-a",
    { roleCodes: ["MANAGER"] },
    { id: "owner-a", roles: [], permissions: [] },
  );

  assert.equal(disconnectedUser, "staff-a");
});
