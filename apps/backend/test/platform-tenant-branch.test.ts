import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PlatformTenantBranchService } from "../src/modules/platform-monitoring/platform-tenant-branch.service";

function makeService(
  tenantStatus: string,
  branchCreate: (args: { data: Record<string, unknown> }) => Promise<unknown>,
  auditCreate: (args: { data: Record<string, unknown> }) => Promise<unknown> = async () => ({}),
) {
  const calls: string[] = [];
  const captured: { branchData?: Record<string, unknown>; auditData?: Record<string, unknown> } = {};
  const prisma = {
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        restaurantTenant: {
          findUnique: async () => {
            calls.push("tenant");
            return tenantStatus === "MISSING" ? null : { id: "tenant-a", status: tenantStatus };
          },
        },
        branch: {
          create: async (args: { data: Record<string, unknown> }) => {
            calls.push("branch");
            captured.branchData = args.data;
            return branchCreate(args);
          },
        },
        auditLog: {
          create: async (args: { data: Record<string, unknown> }) => {
            calls.push("audit");
            captured.auditData = args.data;
            return auditCreate(args);
          },
        },
      }),
  };
  return { calls, captured, service: new PlatformTenantBranchService(prisma as never) };
}

test("first branch is explicitly linked to its provisioning tenant and audited", async () => {
  const branch = {
    id: "branch-a",
    tenantId: "tenant-a",
    code: "NORTH_MAIN",
    name: "North main",
    address: "Yunusobod",
    phone: "+998901234567",
    isActive: true,
  };
  const { calls, captured, service } = makeService("PROVISIONING", async () => branch);

  const result = await service.create(
    "tenant-a",
    { code: " north_main ", name: " North main ", address: " Yunusobod ", phone: " +998901234567 " } as never,
    { id: "owner-1" } as never,
  );

  assert.deepEqual(calls, ["tenant", "branch", "audit"]);
  assert.deepEqual(captured.branchData, {
    tenantId: "tenant-a",
    code: "NORTH_MAIN",
    name: "North main",
    address: "Yunusobod",
    phone: "+998901234567",
    isActive: false,
    acceptsOrders: false,
    deliveryEnabled: false,
    pickupEnabled: false,
  });
  assert.equal(result.tenantId, "tenant-a");
  assert.deepEqual(captured.auditData, {
    userId: "owner-1",
    action: "PLATFORM_TENANT_BRANCH_CREATED",
    entity: "BRANCH",
    entityId: "branch-a",
    metadata: { tenantId: "tenant-a", branchId: "branch-a", code: "NORTH_MAIN", name: "North main" },
  });
});

test("branch creation is blocked for active tenants before any write", async () => {
  const { calls, service } = makeService("ACTIVE", async () => {
    assert.fail("Active tenant branch creation must stop before writing.");
  });

  await assert.rejects(
    () => service.create("tenant-a", { code: "NORTH_MAIN", name: "North main" } as never, { id: "owner-1" } as never),
    ConflictException,
  );
  assert.deepEqual(calls, ["tenant"]);
});

test("missing tenant is not found and duplicate branch codes conflict", async () => {
  const missing = makeService("MISSING", async () => assert.fail("No branch should be created."));
  await assert.rejects(
    () => missing.service.create("tenant-a", { code: "NORTH_MAIN", name: "North main" } as never, { id: "owner-1" } as never),
    NotFoundException,
  );

  const duplicate = new Prisma.PrismaClientKnownRequestError("duplicate", {
    code: "P2002",
    clientVersion: "7.2.0",
  });
  const existing = makeService("PROVISIONING", async () => { throw duplicate; });
  await assert.rejects(
    () => existing.service.create("tenant-a", { code: "NORTH_MAIN", name: "North main" } as never, { id: "owner-1" } as never),
    ConflictException,
  );
  assert.equal(existing.calls.includes("audit"), false);
});
