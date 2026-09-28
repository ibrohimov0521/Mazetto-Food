import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException, BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PlatformTenantLifecycleService } from "../src/modules/platform-monitoring/platform-tenant-lifecycle.service";

test("new restaurant is created only as PROVISIONING and audited atomically", async () => {
  const calls: string[] = [];
  let tenantData: Record<string, unknown> | undefined;
  let auditData: Record<string, unknown> | undefined;
  const tenant = {
    id: "tenant-new",
    code: "MAZETTO_NORTH",
    name: "Mazetto North",
    status: "PROVISIONING",
    createdAt: new Date("2026-09-28T00:00:00.000Z"),
    updatedAt: new Date("2026-09-28T00:00:00.000Z"),
  };
  const prisma = {
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        restaurantTenant: {
          create: async (args: { data: Record<string, unknown> }) => {
            calls.push("tenant");
            tenantData = args.data;
            return tenant;
          },
        },
        auditLog: {
          create: async (args: { data: Record<string, unknown> }) => {
            calls.push("audit");
            auditData = args.data;
            return { id: "audit-1" };
          },
        },
      }),
  };
  const service = new PlatformTenantLifecycleService(prisma as never);

  const result = await service.create(
    { code: " mazetto_north ", name: "  Mazetto North  ", status: "ACTIVE" } as never,
    { id: "owner-1" } as never,
  );

  assert.deepEqual(calls, ["tenant", "audit"]);
  assert.deepEqual(tenantData, { code: "MAZETTO_NORTH", name: "Mazetto North", status: "PROVISIONING" });
  assert.equal(result.status, "PROVISIONING");
  assert.deepEqual(auditData, {
    userId: "owner-1",
    action: "PLATFORM_TENANT_CREATED",
    entity: "RESTAURANT_TENANT",
    entityId: "tenant-new",
    metadata: { tenantId: "tenant-new", code: "MAZETTO_NORTH", name: "Mazetto North", status: "PROVISIONING" },
  });
});

test("tenant creation rejects malformed identifiers before opening a transaction", async () => {
  let transactionCalls = 0;
  const service = new PlatformTenantLifecycleService({
    $transaction: async () => {
      transactionCalls += 1;
      return null;
    },
  } as never);

  await assert.rejects(
    () => service.create({ code: "bad code", name: "Mazetto" } as never, { id: "owner-1" } as never),
    BadRequestException,
  );
  assert.equal(transactionCalls, 0);
});

test("duplicate restaurant codes become a conflict and do not write an audit row", async () => {
  let auditCalls = 0;
  const duplicate = new Prisma.PrismaClientKnownRequestError("duplicate", {
    code: "P2002",
    clientVersion: "7.2.0",
  });
  const service = new PlatformTenantLifecycleService({
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        restaurantTenant: { create: async () => { throw duplicate; } },
        auditLog: { create: async () => { auditCalls += 1; return {}; } },
      }),
  } as never);

  await assert.rejects(
    () => service.create({ code: "MAZETTO_NORTH", name: "Mazetto North" } as never, { id: "owner-1" } as never),
    ConflictException,
  );
  assert.equal(auditCalls, 0);
});
