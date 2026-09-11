import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(new URL("../apps/backend/package.json", import.meta.url));
const { Prisma } = require("@prisma/client");
const { CustomerCourierService } = require("./dist/modules/customers/customer-courier.service.js");
const { orderStatusLabel } = require("./dist/common/utils/order-status-label.js");
const { kitchenEvents, kitchenOrderStatusChangedEvent } = require("./dist/modules/kitchen/kitchen-events.js");
for (const type of ["DELIVERY", "PICKUP"]) for (const status of ["NEW", "CONFIRMED", "PREPARING", "READY", "SERVED", "COMPLETED", "CANCELLED"]) {
  assert.equal(typeof orderStatusLabel(status, type), "string");
}
assert.match(orderStatusLabel("SERVED", "DELIVERY"), /Kuryer yo'lda/);
assert.match(orderStatusLabel("COMPLETED", "DELIVERY"), /Yetkazildi/);
const user = { id: "courier", employeeId: "employee", branchId: "branch", roles: ["COURIER"] };
function setup(status, type = "DELIVERY", branchId = "branch") {
  let existing = { id: "co", orderId: "order", branchId, type, order: { status, total: new Prisma.Decimal(0), payments: [] }, createdAt: new Date() };
  const events = [], writes = [], kitchen = [], histories = [];
  const tx = {
    $queryRaw: async () => [],
    customerOrder: { findUnique: async () => ({ ...existing, order: { ...existing.order, payments: [...existing.order.payments] } }), findUniqueOrThrow: async () => existing },
    order: { update: async ({data}) => { writes.push(data); existing = {...existing, order: {...existing.order, ...data}}; } },
    kitchenTicket: { updateMany: async value => kitchen.push(value) },
    orderStatusHistory: { create: async value => histories.push(value) },
  };
  const service = new CustomerCourierService({ $transaction: fn => fn(tx) }, { emitOrderStatusChanged: value => events.push(value) }, {});
  return { service, events, writes, kitchen, histories };
}
for (const [from, to, ticket] of [["READY", "SERVED", "COMPLETED"], ["SERVED", "COMPLETED", "COMPLETED"], ["READY", "CANCELLED", "CANCELLED"]]) {
  const test = setup(from);
  const notifications = [];
  const listener = value => notifications.push(value);
  kitchenEvents.on(kitchenOrderStatusChangedEvent, listener);
  try {
    const result = await test.service.updateCourierOrderStatus("co", {status: to}, user);
    assert.equal(result.order.status, to);
    assert.deepEqual(test.events, [{ orderId: "order" }]);
    assert.deepEqual(notifications, [{ orderId: "order", action: "refresh" }]);
    assert.equal(test.kitchen[0].data.status, ticket);
    assert.equal(test.histories[0].data.toStatus, to);
  } finally { kitchenEvents.off(kitchenOrderStatusChangedEvent, listener); }
}
for (const [from, to, type, branch] of [["PREPARING", "SERVED"], ["SERVED", "READY"], ["COMPLETED", "SERVED"], ["CANCELLED", "SERVED"], ["READY", "SERVED", "PICKUP"], ["READY", "SERVED", "DELIVERY", "other"]]) {
  const test = setup(from, type, branch);
  await assert.rejects(test.service.updateCourierOrderStatus("co", {status: to}, user));
  assert.equal(test.writes.length, 0);
  assert.equal(test.events.length, 0);
}
const repeat = setup("SERVED");
await repeat.service.updateCourierOrderStatus("co", {status: "SERVED"}, user);
assert.equal(repeat.writes.length, 0);
console.log("PASS: shared status labels; courier transitions; kitchen sync; customer and Telegram refresh; branch, type and terminal guards; idempotent departure.");
