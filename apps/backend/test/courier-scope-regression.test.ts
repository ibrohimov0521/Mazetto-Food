import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Prisma } from "@prisma/client";
import { CustomerCourierService } from "../src/modules/customers/customer-courier.service";
import { ListOnlineOrdersDto } from "../src/modules/customers/dto/list-customers.dto";
import type { PrismaService } from "../src/prisma/prisma.service";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceSource = readFileSync(
  join(__dirname, "../src/modules/customers/customer-courier.service.ts"),
  "utf8",
);
const courierUiSource = readFileSync(
  join(__dirname, "../../pos-web/components/courier/courier-orders.tsx"),
  "utf8",
);

function methodSource(name: string): string {
  const start = serviceSource.indexOf(`async ${name}(`);
  assert.notEqual(start, -1, `${name} method must exist`);
  const next = serviceSource.indexOf("\n  async ", start + 1);
  return serviceSource.slice(start, next === -1 ? undefined : next);
}

test("courier active order search keeps courier ownership scope", () => {
  const method = methodSource("listCourierDeliveryOrders");

  assert.match(method, /const orderFilters: Prisma\.OrderWhereInput\[\]/);
  assert.match(method, /servedById: null/);
  assert.match(method, /servedById: employeeId/);
  assert.match(method, /orderFilters\.push\(buildOrderSearchWhere\(search\)\)/);
  assert.match(method, /AND: orderFilters/);
  assert.doesNotMatch(
    method, /OR: \[\{ servedById: null \}, \{ servedById: employeeId \}\],[\s\S]*\.\.\.\(search \? \{ OR:/,
    "search OR must not replace the servedBy courier scope",
  );
});

test("courier history filters are applied by the backend request", () => {
  assert.match(courierUiSource, /params\.set\("status", historyStatus\)/);
  assert.match(courierUiSource, /params\.set\("search", historySearch\.trim\(\)\)/);
  assert.match(courierUiSource, /courier\/orders\/history\?\$\{params\.toString\(\)\}/);
  assert.match(courierUiSource, /\}, \[historySearch, historyStatus\]\);/);
});

test("courier orders expose the net unpaid balance after partial payments and refunds", async () => {
  const fixtures = [
    { status: "PAID", amount: 180000, orderTotal: 180000, refunds: [], expected: "0" },
    { status: "SUCCESS", amount: 135000, orderTotal: 180000, refunds: [], expected: "45000" },
    { status: "PENDING", amount: 180000, orderTotal: 180000, refunds: [], expected: "180000" },
    {
      status: "PARTIALLY_REFUNDED",
      amount: 74000,
      orderTotal: 74000,
      refunds: [24000],
      expected: "24000",
    },
  ];
  let paymentSelection: unknown;
  const prisma = {
    customerOrder: {
      findMany: async (args: { include: Record<string, unknown> }) => {
        paymentSelection = (
          (((args.include.order as Record<string, unknown>).include as Record<string, unknown>)
            .payments as Record<string, unknown>)
        ).select;
        return fixtures.map((fixture, index) => ({
          id: `delivery-${index}`,
          type: "DELIVERY",
          branch: null,
          order: {
            id: `order-${index}`,
            status: "READY",
            total: new Prisma.Decimal(fixture.orderTotal),
            payments: [{
              amount: new Prisma.Decimal(fixture.amount),
              status: fixture.status,
              refunds: fixture.refunds.map((amount) => ({
                amount: new Prisma.Decimal(amount),
              })),
            }],
          },
        }));
      },
    },
    restaurantTenant: {
      findFirst: async () => ({ id: "tenant-a" }),
    },
    branch: {
      findFirst: async () => ({ id: "branch-1" }),
    },
  } as unknown as PrismaService;
  const user: AuthenticatedUser = {
    id: "courier-user",
    tenantId: "tenant-a",
    membershipId: "membership-a",
    employeeId: "courier-employee",
    branchId: "branch-1",
    roles: ["COURIER"],
    permissions: ["COURIER_DELIVERY_VIEW"],
  };
  const service = new CustomerCourierService(prisma, {} as never, {} as never);
  const orders = await service.listCourierDeliveryOrders(new ListOnlineOrdersDto(), user);
  assert.deepEqual(orders.map((item) => item.order.outstandingAmount), fixtures.map((item) => item.expected));
  assert.deepEqual(paymentSelection, {
    amount: true,
    status: true,
    refunds: { select: { amount: true } },
  });
  assert.ok(orders.every((item) => !("payments" in item.order)));
});
