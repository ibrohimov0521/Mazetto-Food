import assert from "node:assert/strict";
import test from "node:test";
import {
  OrderItemStatus,
  OrderState,
  OrderStatus,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { ORDER_EVENTS } from "../src/modules/orders/order-events";
import { OrdersService } from "../src/modules/orders/orders.service";

const actor: AuthenticatedUser = {
  id: "user-1",
  employeeId: "employee-1",
  branchId: "branch-1",
  tenantId: "tenant-1",
  membershipId: "membership-1",
  isGlobalScope: false,
  roles: ["BRANCH_MANAGER"],
  permissions: ["ORDER_UPDATE", "PAYMENT_REFUND"],
};

function createHarness(options: {
  paymentCode?: string;
  paymentAmount?: number;
  previousRefundAmount?: number;
  shiftOpen?: boolean;
} = {}) {
  const events: Record<string, unknown>[] = [];
  const refunds: Record<string, unknown>[] = [];
  const revenues: Record<string, unknown>[] = [];
  const cashTransactions: Record<string, unknown>[] = [];
  const receipts: Record<string, unknown>[] = [];
  const payment = {
    id: "payment-1",
    orderId: "order-1",
    amount: new Prisma.Decimal(options.paymentAmount ?? 10000),
    status: (options.previousRefundAmount
      ? PaymentStatus.PARTIALLY_REFUNDED
      : PaymentStatus.SUCCESS) as PaymentStatus,
    method: {
      id: "method-1",
      code: options.paymentCode ?? "CASH",
      name: options.paymentCode ?? "CASH",
    },
    refunds: options.previousRefundAmount
      ? [{ amount: new Prisma.Decimal(options.previousRefundAmount) }]
      : ([] as { amount: Prisma.Decimal }[]),
  };
  const item = {
    id: "item-1",
    orderId: "order-1",
    productId: "product-1",
    productName: "Lavash",
    quantity: new Prisma.Decimal(1),
    unitPrice: new Prisma.Decimal(3000),
    totalPrice: new Prisma.Decimal(3000),
    modifierSnapshot: null,
    status: OrderItemStatus.ACTIVE as OrderItemStatus,
    stockDeductedAt: null,
    notes: null,
  };
  const remainingItem = {
    id: "item-2",
    orderId: "order-1",
    productId: "product-2",
    productName: "Ichimlik",
    quantity: new Prisma.Decimal(1),
    unitPrice: new Prisma.Decimal(7000),
    totalPrice: new Prisma.Decimal(7000),
    modifierSnapshot: null,
    status: OrderItemStatus.ACTIVE as OrderItemStatus,
    stockDeductedAt: null,
    notes: null,
  };
  const order = {
    id: "order-1",
    branchId: "branch-1",
    shiftId: "shift-1",
    status: OrderStatus.SERVED,
    orderState: OrderState.ACCEPTED,
    version: 1,
    total: new Prisma.Decimal(10000),
    subtotal: new Prisma.Decimal(10000),
    discountTotal: new Prisma.Decimal(0),
    serviceFeeTotal: new Prisma.Decimal(0),
    deliveryFeeTotal: new Prisma.Decimal(0),
    paymentStatus: (options.previousRefundAmount
      ? PaymentStatus.PARTIALLY_REFUNDED
      : PaymentStatus.PENDING) as PaymentStatus,
    payments: [payment],
    items: [item, remainingItem],
  };
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray) =>
      strings.join("").includes('UPDATE "branches"')
        ? [{ branchRevision: 1n }]
        : [],
    employee: { findFirst: async () => ({ id: "employee-1" }) },
    shift: {
      updateMany: async () => ({ count: options.shiftOpen === false ? 0 : 1 }),
      findUnique: async () => ({
        id: "shift-1",
        branchId: "branch-1",
        employeeId: "employee-1",
        status: "OPEN",
      }),
    },
    order: {
      findUnique: async (args: {
        select?: Record<string, boolean>;
      }) => {
        if (args.select?.shiftId) return { id: order.id, shiftId: order.shiftId };
        if (args.select?.discountTotal) {
          return {
            discountTotal: order.discountTotal,
            serviceFeeTotal: order.serviceFeeTotal,
            deliveryFeeTotal: order.deliveryFeeTotal,
          };
        }
        return order;
      },
      update: async (args: {
        data: {
          subtotal?: Prisma.Decimal;
          total?: Prisma.Decimal;
          version?: { increment: number };
          paymentStatus?: PaymentStatus;
        };
      }) => {
        if (args.data.subtotal) order.subtotal = args.data.subtotal;
        if (args.data.total) order.total = args.data.total;
        if (args.data.version) order.version += args.data.version.increment;
        if (args.data.paymentStatus) {
          order.paymentStatus = args.data.paymentStatus;
        }
        return order;
      },
    },
    orderItem: {
      findFirst: async () => item,
      findMany: async () =>
        [item, remainingItem]
          .filter((row) => row.status === OrderItemStatus.ACTIVE)
          .map((row) => ({ totalPrice: row.totalPrice })),
      update: async (args: { data: Record<string, unknown> }) => {
        Object.assign(item, args.data);
        return item;
      },
    },
    payment: {
      findMany: async () => [payment],
      findUnique: async () => ({
        ...payment,
        order: {
          ...order,
          orderNumber: "104",
          branch: { name: "Sergeli" },
        },
      }),
      update: async (args: { data: { status: PaymentStatus } }) => {
        payment.status = args.data.status;
        return payment;
      },
    },
    paymentRefund: {
      create: async (args: { data: Record<string, unknown> }) => {
        const refund = { id: `refund-${refunds.length + 1}`, ...args.data };
        refunds.push(refund);
        return refund;
      },
    },
    revenueRecord: {
      create: async (args: { data: Record<string, unknown> }) => {
        revenues.push(args.data);
        return args.data;
      },
    },
    cashTransaction: {
      create: async (args: { data: Record<string, unknown> }) => {
        cashTransactions.push(args.data);
        return args.data;
      },
    },
    receipt: {
      findUnique: async () => null,
      create: async (args: { data: Record<string, unknown> }) => {
        receipts.push(args.data);
        return {
          id: `receipt-${receipts.length}`,
          branchId: args.data.branchId,
          content: args.data.content,
        };
      },
    },
    printer: { findMany: async () => [] },
    printJob: {
      create: async () => ({}),
      createMany: async () => ({ count: 0 }),
    },
    auditLog: { create: async () => ({}) },
    kitchenTicketItem: { findMany: async () => [] },
    orderEvent: {
      create: async (args: { data: Record<string, unknown> }) => {
        events.push(args.data);
        return { id: "event-1", createdAt: new Date() };
      },
    },
    outboxEvent: { create: async () => ({}) },
  };
  const prisma = {
    restaurantTenant: { findFirst: async () => ({ id: "tenant-1" }) },
    branch: { findFirst: async () => ({ id: "branch-1" }) },
    $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
      callback(tx),
  };
  const idempotency = {
    start: async () => ({ kind: "CLAIMED" as const, record: { id: "idem-1" } }),
    complete: async () => undefined,
    fail: async () => undefined,
  };
  const kitchen = { recordItemCancellation: async () => undefined };
  const service = new OrdersService(
    prisma as never,
    {} as never,
    kitchen as never,
    undefined,
    idempotency as never,
  );

  return {
    events,
    refunds,
    revenues,
    cashTransactions,
    receipts,
    item,
    payment,
    order,
    service,
  };
}

function cancelItem(service: OrdersService) {
  return service.updateItem(
    "order-1",
    "item-1",
    {
      status: OrderItemStatus.CANCELLED,
      cancellationReason: "Mijoz bekor qildi",
    },
    actor,
    {
      shiftId: "shift-1",
      expectedVersion: 1,
      correlationId: "correlation-1",
      idempotencyKey: "cancel-item-key-1",
      eventType: ORDER_EVENTS.ITEM_CANCELLED,
      reasonCode: "CASHIER_ITEM_CANCELLED",
      source: "API",
    },
  );
}

test("paid item cancellation records one item-linked cash refund in the same open shift", async () => {
  const state = createHarness();

  const result = await cancelItem(state.service);

  assert.equal(state.item.status, OrderItemStatus.CANCELLED);
  assert.equal(result.total.toFixed(2), "7000.00");
  assert.equal(result.paymentStatus, PaymentStatus.PAID);
  assert.equal(state.payment.status, PaymentStatus.PARTIALLY_REFUNDED);
  assert.equal(state.refunds.length, 1);
  assert.equal(state.refunds[0]?.orderItemId, "item-1");
  assert.equal(state.refunds[0]?.shiftId, "shift-1");
  assert.equal(
    (state.refunds[0]?.amount as Prisma.Decimal).toFixed(2),
    "3000.00",
  );
  assert.equal(state.cashTransactions.length, 1);
  assert.equal(state.cashTransactions[0]?.type, "REFUND");
  assert.equal(state.cashTransactions[0]?.shiftId, "shift-1");
  assert.equal(
    (state.revenues[0]?.amount as Prisma.Decimal).toFixed(2),
    "-3000.00",
  );
  assert.equal(state.receipts.length, 1);
  assert.equal(state.events[0]?.eventType, ORDER_EVENTS.ITEM_CANCELLED);
});

test("underpaid item cancellation reduces the order without creating a cash refund", async () => {
  const state = createHarness({ paymentAmount: 6000 });

  const result = await cancelItem(state.service);

  assert.equal(state.item.status, OrderItemStatus.CANCELLED);
  assert.equal(result.total.toFixed(2), "7000.00");
  assert.equal(result.paymentStatus, PaymentStatus.PENDING);
  assert.equal(state.refunds.length, 0);
  assert.equal(state.cashTransactions.length, 0);
});

test("an earlier refund does not hide a remaining balance from the cashier", async () => {
  const state = createHarness({
    paymentAmount: 7000,
    previousRefundAmount: 1000,
  });

  const result = await cancelItem(state.service);

  assert.equal(result.total.toFixed(2), "7000.00");
  assert.equal(result.paymentStatus, PaymentStatus.PENDING);
  assert.equal(state.payment.status, PaymentStatus.PARTIALLY_REFUNDED);
  assert.equal(state.refunds.length, 0);
  assert.equal(state.cashTransactions.length, 0);
});

test("exactly paid remaining balance stays paid after item cancellation", async () => {
  const state = createHarness({ paymentAmount: 7000 });

  const result = await cancelItem(state.service);

  assert.equal(result.total.toFixed(2), "7000.00");
  assert.equal(result.paymentStatus, PaymentStatus.PAID);
  assert.equal(state.refunds.length, 0);
  assert.equal(state.cashTransactions.length, 0);
});

test("item cancellation refuses non-cash refunds and closed shifts before mutating the item", async () => {
  const nonCash = createHarness({ paymentCode: "CLICK" });
  await assert.rejects(cancelItem(nonCash.service), /Naqd to'lovlardan qaytarish/);
  assert.equal(nonCash.item.status, OrderItemStatus.ACTIVE);
  assert.equal(nonCash.refunds.length, 0);
  assert.equal(nonCash.cashTransactions.length, 0);

  const closedShift = createHarness({ shiftOpen: false });
  await assert.rejects(cancelItem(closedShift.service), /smenasi yopilgan/);
  assert.equal(closedShift.item.status, OrderItemStatus.ACTIVE);
  assert.equal(closedShift.refunds.length, 0);
});
