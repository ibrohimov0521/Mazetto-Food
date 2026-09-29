import assert from "node:assert/strict";
import test from "node:test";
import type { JwtService } from "@nestjs/jwt";
import { createKitchenGatewayForTest } from "./kitchen-gateway-test-factory";
import type { PrismaService } from "../src/prisma/prisma.service";

type EmittedEvent = {
  rooms: string[];
  event: string;
  payload: unknown;
};

function gatewayWithEvents(prisma: object) {
  const gateway = createKitchenGatewayForTest(
    {} as JwtService,
    prisma as PrismaService,
  );
  const events: EmittedEvent[] = [];
  Object.defineProperty(gateway, "server", {
    value: {
      to: (rooms: string[]) => ({
        emit: (event: string, payload: unknown) => {
          events.push({ rooms, event, payload });
        },
      }),
    },
  });
  return { gateway, events };
}

function flushRealtime(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

test("order broadcasts use the persisted branch, not a payload branch", async () => {
  const { gateway, events } = gatewayWithEvents({
    order: {
      findUnique: async () => ({
        branchId: "branch-a",
        customerOrder: { customerId: "customer-a" },
      }),
    },
  });

  gateway.emitOrderCreated({
    id: "order-a",
    branchId: "branch-b",
    status: "NEW",
  });
  await flushRealtime();

  assert.deepEqual(events, [
    {
      rooms: ["branch:branch-a", "staff:global", "customer:customer-a"],
      event: "order.created",
      payload: {
        orderId: "order-a",
        branchId: "branch-a",
        customerScoped: true,
        status: "NEW",
      },
    },
  ]);
});

test("missing orders cannot broadcast to a caller-supplied branch room", async () => {
  const { gateway, events } = gatewayWithEvents({
    order: { findUnique: async () => null },
  });

  gateway.emitOrderCreated({
    id: "deleted-order",
    branchId: "branch-b",
  });
  await flushRealtime();

  assert.deepEqual(events, []);
});

test("kitchen ticket broadcasts use the persisted ticket branch", async () => {
  const { gateway, events } = gatewayWithEvents({
    kitchenTicket: {
      findUnique: async () => ({
        id: "ticket-a",
        orderId: "order-a",
        order: {
          branchId: "branch-a",
          customerOrder: { customerId: null },
        },
      }),
    },
  });

  gateway.emitOrderSentToKitchen({
    ticket: { id: "ticket-a", branchId: "branch-b", status: "COOKING" },
  });
  await flushRealtime();

  assert.deepEqual(events, [
    {
      rooms: ["branch:branch-a", "staff:global"],
      event: "order.sent_to_kitchen",
      payload: {
        orderId: "order-a",
        ticketId: "ticket-a",
        branchId: "branch-a",
        ticketStatus: "COOKING",
      },
    },
  ]);
});
