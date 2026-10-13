import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import {
  OnlineOrderTypeDto,
  OnlinePaymentMethodDto,
} from "../src/modules/customers/dto/customer.dto";
import { CustomerOrderEngineService } from "../src/modules/customers/customer-order-engine.service";
import { MaintenanceScheduler } from "../src/modules/maintenance/maintenance.scheduler";

test("customer checkout uses the tenant-configured incomplete-attempt TTL", async () => {
  const startedAt = Date.now();
  const ttlHours = 3;
  const settingsReads: unknown[][] = [];
  const createdAttempts: { expiresAt: Date }[] = [];
  const stopBeforeOrderWrites = new Error("stop after reservation");

  const service = new CustomerOrderEngineService(
    {
      customer: {
        findUnique: async () => ({
          id: "customer-a",
          tenantId: "tenant-a",
          name: "Customer",
          phone: "+998901234567",
        }),
      },
      customerOrderAttempt: {
        create: async ({ data }: { data: { expiresAt: Date } }) => {
          createdAttempts.push(data);
          return {
            id: "attempt-a",
            status: "PENDING",
            requestHash: "request-hash",
            customerOrderId: null,
            createdAt: new Date(startedAt),
            expiresAt: data.expiresAt,
          };
        },
        deleteMany: async () => ({ count: 1 }),
      },
      $transaction: async () => {
        throw stopBeforeOrderWrites;
      },
    } as never,
    { assertCustomerBranchAcceptsOrder: async () => undefined } as never,
    {} as never,
    {} as never,
    {
      getInt: async (...args: unknown[]) => {
        settingsReads.push(args);
        return ttlHours;
      },
    } as never,
  );

  await assert.rejects(
    service.createOnlineOrder("customer-a", {
      branchId: "branch-a",
      idempotencyKey: "checkout-key-a",
      type: OnlineOrderTypeDto.PICKUP,
      paymentMethod: OnlinePaymentMethodDto.CASH,
      items: [],
    } as never),
    (error) => error === stopBeforeOrderWrites,
  );

  assert.deepEqual(settingsReads[0], [
    "customer_order_attempt_ttl_hours",
    "tenant-a",
  ]);
  assert.equal(createdAttempts.length, 1);
  const expiry = createdAttempts[0]!.expiresAt.getTime();
  const expectedTtlMs = ttlHours * 60 * 60 * 1000;
  assert.ok(expiry >= startedAt + expectedTtlMs);
  assert.ok(expiry <= Date.now() + expectedTtlMs);
});

test("attempt age alone does not override the configured TTL", () => {
  const service = new CustomerOrderEngineService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const checker = service as unknown as {
    isStalePendingAttempt: (attempt: {
      status: string;
      customerOrderId: string | null;
      createdAt: Date;
      expiresAt: Date;
    }) => boolean;
  };
  const oldButUnexpired = {
    status: "PENDING",
    customerOrderId: null,
    createdAt: new Date(Date.now() - 5 * 60 * 1000),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  };

  assert.equal(checker.isStalePendingAttempt(oldButUnexpired), false);
  assert.equal(
    checker.isStalePendingAttempt({
      ...oldButUnexpired,
      expiresAt: new Date(Date.now() - 1),
    }),
    true,
  );
});

test("stale checkout cleanup follows each attempt's configured expiry", async () => {
  const queries: { where: Record<string, unknown> }[] = [];
  const scheduler = new MaintenanceScheduler({
    customerOrderAttempt: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        queries.push(args);
        return [];
      },
    },
  } as never);

  await scheduler.cleanupStaleOrderAttempts();

  assert.equal(queries.length, 1);
  const query = queries[0]!;
  assert.deepEqual(query.where.status, "PENDING");
  assert.deepEqual(query.where.customerOrderId, null);
  assert.ok(query.where.expiresAt);
  assert.equal("createdAt" in query.where, false);
});

test("checkout failure releases only an unlinked pending attempt", async () => {
  let deleteWhere: unknown;
  const service = new CustomerOrderEngineService(
    {
      customerOrderAttempt: {
        deleteMany: async (query: { where: unknown }) => {
          deleteWhere = query.where;
          return { count: 1 };
        },
      },
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const release = service as unknown as {
    releaseCustomerOrderAttempt: (id: string) => Promise<void>;
  };

  await release.releaseCustomerOrderAttempt("attempt-a");

  assert.deepEqual(deleteWhere, {
    id: "attempt-a",
    status: "PENDING",
    customerOrderId: null,
  });
});

test("stale attempt deletion uses a compare-and-delete guard", async () => {
  let deleteWhere: Record<string, unknown> | undefined;
  const service = new CustomerOrderEngineService(
    {
      customerOrderAttempt: {
        deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
          deleteWhere = where;
          return { count: 0 };
        },
      },
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const cleanup = service as unknown as {
    deleteStaleCustomerOrderAttempt: (id: string) => Promise<boolean>;
  };

  assert.equal(
    await cleanup.deleteStaleCustomerOrderAttempt("attempt-a"),
    false,
  );
  assert.equal(deleteWhere?.id, "attempt-a");
  assert.equal(deleteWhere?.status, "PENDING");
  assert.equal(deleteWhere?.customerOrderId, null);
  assert.ok(
    (deleteWhere?.expiresAt as { lte?: unknown } | undefined)?.lte instanceof
      Date,
  );
});

test("stale cleanup rechecks status and order link when deleting", async () => {
  const queries: { where: Record<string, unknown> }[] = [];
  let deletion: { where: Record<string, unknown> } | undefined;
  const scheduler = new MaintenanceScheduler({
    customerOrderAttempt: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        queries.push(args);
        return [{ id: "attempt-a" }];
      },
      deleteMany: async (args: { where: Record<string, unknown> }) => {
        deletion = args;
        return { count: 0 };
      },
    },
  } as never);

  await scheduler.cleanupStaleOrderAttempts();

  const query = queries[0]!;
  assert.equal(query.where.status, "PENDING");
  assert.equal(query.where.customerOrderId, null);
  assert.ok(query.where.expiresAt);
  assert.deepEqual(deletion?.where, {
    id: { in: ["attempt-a"] },
    status: "PENDING",
    customerOrderId: null,
    expiresAt: query.where.expiresAt,
  });
});

test("retry reuses an order completed during stale-attempt cleanup", async () => {
  const expiredAttempt = {
    id: "attempt-a",
    status: "PENDING",
    requestHash: "request-hash",
    customerOrderId: null,
    createdAt: new Date(Date.now() - 60 * 60 * 1000),
    expiresAt: new Date(Date.now() - 1),
  };
  const completedAttempt = {
    ...expiredAttempt,
    status: "COMPLETED",
    customerOrderId: "customer-order-a",
  };
  let reads = 0;
  const service = new CustomerOrderEngineService(
    {
      customerOrderAttempt: {
        findUnique: async () =>
          reads++ === 0 ? expiredAttempt : completedAttempt,
        deleteMany: async () => ({ count: 0 }),
      },
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const waiter = service as unknown as {
    waitForCustomerOrderAttempt: (
      customerId: string,
      idempotencyKey: string,
      requestHash: string,
    ) => Promise<{ customerOrderId: string | null } | null>;
  };

  const result = await waiter.waitForCustomerOrderAttempt(
    "customer-a",
    "checkout-key-a",
    "request-hash",
  );

  assert.equal(reads, 2);
  assert.equal(result?.customerOrderId, "customer-order-a");
});
