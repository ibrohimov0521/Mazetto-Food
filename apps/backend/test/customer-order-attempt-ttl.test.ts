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
        delete: async () => ({ id: "attempt-a" }),
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
