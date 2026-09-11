import "reflect-metadata";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { OrderSource, OrderStatus } from "@prisma/client";
import { CourierOrderStatus } from "../src/modules/customers/dto/list-customers.dto";
import { PrismaService } from "../src/prisma/prisma.service";
import { ShiftsService } from "../src/modules/shifts/shifts.service";
import { CashRegisterService } from "../src/modules/cash-register/cash-register.service";
import { KitchenService } from "../src/modules/kitchen/kitchen.service";
import { InventoryService } from "../src/modules/inventory/inventory.service";
import { OrdersService } from "../src/modules/orders/orders.service";
import { PaymentsService } from "../src/modules/payments/payments.service";
import { CustomerCourierService } from "../src/modules/customers/customer-courier.service";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";

async function main() {
  const url = new URL(process.env.DATABASE_URL || "http://invalid");
  assert.equal(process.env.MAZETTO_CASH_DB_SMOKE, "1");
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname));
  assert.equal(url.pathname, "/cash_qa", "Only the disposable cash_qa database is allowed");
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const id = Date.now().toString();
    const branch = await prisma.branch.create({ data: { code: "CASHQA" + id, name: "Cash QA", isActive: true, acceptsOrders: true } });
    const actor = async (name: string, roles: string[]): Promise<AuthenticatedUser> => {
      const user = await prisma.user.create({ data: { email: name + id + "@example.test", displayName: name } });
      const employee = await prisma.employee.create({ data: { userId: user.id, branchId: branch.id, employeeCode: name + id, firstName: name, status: "ACTIVE" } });
      return { id: user.id, employeeId: employee.id, branchId: branch.id, roles, permissions: ["*"] };
    };
    const worker = await actor("Worker", ["KITCHEN", "CASHIER", "COURIER"]);
    const receiver = await actor("Receiver", ["CASHIER"]);
    const category = await prisma.category.create({ data: { code: "CASHQA" + id, name: "QA" } });
    const product = await prisma.product.findFirst({ where: { code: "CLASSIC_LAVASH" } }) ?? await prisma.product.create({ data: { code: "CLASSIC_LAVASH", categoryId: category.id, name: "QA item", sellingPrice: 10000, isAvailable: true } });
    await prisma.paymentMethod.create({ data: { branchId: branch.id, code: "CASH", name: "Cash", isActive: true } });
    await prisma.paymentMethod.create({ data: { branchId: branch.id, code: "CARD", name: "Card", isActive: true } });
    const customer = await prisma.customer.create({ data: { phone: "qa-cash-" + id, name: "QA customer" } });
    const shifts = new ShiftsService(prisma);
    const cash = new CashRegisterService(prisma, shifts);
    const kitchen = new KitchenService(prisma, { emitOrderCreated() {}, emitOrderConfirmed() {}, emitOrderSentToKitchen() {}, emitOrderStatusChanged() {} } as never);
    const payments = new PaymentsService(prisma);
    const courier = new CustomerCourierService(prisma, kitchen, payments);
    const orders = new OrdersService(prisma, new InventoryService(prisma), kitchen);
    const sourceShift = await shifts.openShift({ openingBalance: 0 }, worker);
    const targetShift = await shifts.openShift({ openingBalance: 0 }, receiver);
    await assert.rejects(() => shifts.openCourierShift({ openingBalance: 0 }, worker));
    const balance = async (user = worker) => (await cash.getCurrentShift(user))!.expectedCash.toNumber();
    const online = async (type: "DELIVERY" | "TAKEAWAY", total: number, status: OrderStatus = OrderStatus.READY) => {
      const order = await prisma.order.create({ data: { branchId: branch.id, source: OrderSource.WEB, type, status, total, subtotal: total, orderNumber: "QA" + crypto.randomUUID(), ...(type === "DELIVERY" ? { servedById: worker.employeeId! } : {}), kitchenTickets: { create: { status: "READY", ticketNumber: "QA" + crypto.randomUUID() } } } });
      const link = await prisma.customerOrder.create({ data: { orderId: order.id, branchId: branch.id, customerId: customer.id, type: type === "DELIVERY" ? "DELIVERY" : "PICKUP", paymentMethod: "CASH" } });
      return { order, link };
    };

    const pos = await orders.createPosCheckout({ idempotencyKey: "cash-qa-pos-" + id, cashReceived: 10000, items: [{ productId: product.id, quantity: 1 }] }, worker);
    assert.equal(await balance(), 10000);
    const pickup = await online("TAKEAWAY", 20000);
    const ticket = await prisma.kitchenTicket.findFirstOrThrow({ where: { orderId: pickup.order.id } });
    await kitchen.completeTicket(ticket.id, worker);
    await kitchen.completeTicket(ticket.id, worker);
    assert.equal(await balance(), 30000);
    assert.equal(await prisma.payment.count({ where: { orderId: pickup.order.id } }), 1);

    const delivery = await online("DELIVERY", 30000, OrderStatus.SERVED);
    await assert.rejects(() => courier.updateCourierOrderStatus(delivery.link.id, { status: CourierOrderStatus.COMPLETED }, receiver), /boshqa kuryer/);
    await assert.rejects(() => courier.updateCourierOrderStatus(delivery.link.id, { status: CourierOrderStatus.COMPLETED, amount: 1000 }, worker), /to'liq/);
    assert.equal(await prisma.payment.count({ where: { orderId: delivery.order.id } }), 0);
    const notReady = await online("DELIVERY", 30000, OrderStatus.PREPARING);
    await assert.rejects(() => courier.updateCourierOrderStatus(notReady.link.id, { status: CourierOrderStatus.COMPLETED }, worker), /tayyor bo'lmagan/);
    assert.equal(await prisma.payment.count({ where: { orderId: notReady.order.id } }), 0);

    class FailingPayments extends PaymentsService {
      override async processOrderPayment(...args: Parameters<PaymentsService["processOrderPayment"]>): Promise<never> {
        await super.processOrderPayment(...args);
        throw new Error("QA failure after payment write");
      }
    }
    const broken = new CustomerCourierService(prisma, kitchen, new FailingPayments(prisma));
    await assert.rejects(() => broken.updateCourierOrderStatus(delivery.link.id, { status: CourierOrderStatus.COMPLETED }, worker), /QA failure/);
    assert.equal(await prisma.payment.count({ where: { orderId: delivery.order.id } }), 0);
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: delivery.order.id } })).status, "SERVED");
    const completions = await Promise.allSettled([
      courier.updateCourierOrderStatus(delivery.link.id, { status: CourierOrderStatus.COMPLETED }, worker),
      courier.updateCourierOrderStatus(delivery.link.id, { status: CourierOrderStatus.COMPLETED }, worker),
    ]);
    assert.equal(completions.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(await balance(), 60000);
    assert.equal(await prisma.payment.count({ where: { orderId: delivery.order.id } }), 1);
    assert.equal(await prisma.revenueRecord.count({ where: { shiftId: sourceShift.id } }), 3);

    const transfer = await shifts.createCashTransfer({ amount: 60000, toShiftId: targetShift.id }, worker);
    await assert.rejects(() => shifts.acceptCashTransfer(transfer.id, worker), /o'zingiz qabul/);
    await assert.rejects(() => shifts.closeShift(sourceShift.id, { closingBalance: 0 }, worker), /hali tasdiqlanmagan/);
    const accepted = await Promise.allSettled([shifts.acceptCashTransfer(transfer.id, receiver), shifts.acceptCashTransfer(transfer.id, receiver)]);
    assert.equal(accepted.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(await balance(), 0);
    assert.equal(await balance(receiver), 60000);
    assert.equal(await prisma.revenueRecord.count({ where: { shiftId: targetShift.id } }), 0, "handover is not another sale");
    assert.equal(await prisma.cashTransaction.count({ where: { cashTransferId: transfer.id, type: "CASH_IN" } }), 1);

    await shifts.createCashTransaction(sourceShift.id, { type: "CASH_IN", amount: 15000 }, worker);
    const attempts = await Promise.allSettled([shifts.createCashTransfer({ amount: 10000, toShiftId: targetShift.id }, worker), shifts.createCashTransfer({ amount: 10000, toShiftId: targetShift.id }, worker)]);
    assert.equal(attempts.filter(result => result.status === "fulfilled").length, 1, "parallel submissions cannot overdraw");
    const pending = await prisma.cashTransfer.findFirstOrThrow({ where: { fromShiftId: sourceShift.id, status: "PENDING" } });
    await shifts.rejectCashTransfer(pending.id, "QA returned", receiver);
    await assert.rejects(() => shifts.rejectCashTransfer(pending.id, undefined, receiver));
    assert.equal(await balance(), 15000);
    await prisma.cashTransaction.createMany({ data: Array.from({ length: 250 }, () => ({ branchId: branch.id, employeeId: worker.employeeId!, shiftId: sourceShift.id, type: "CASH_IN" as const, amount: 1 })) });
    assert.equal(await balance(), 15250, "older ledger entries must remain in the balance");
    assert.equal((await cash.getCurrentShift(worker))!.cashTransactions.length, 50);
    assert.equal((await shifts.getCurrentCourierShift(worker))!.currentCash.toNumber(), 15250);

    const card = await online("TAKEAWAY", 10000);
    await payments.processOrderPayment({ orderId: card.order.id, idempotencyKey: "qa-card-" + id, shiftId: sourceShift.id, payments: [{ paymentMethodCode: "CARD", amount: 10000 }] }, worker);
    assert.equal(await balance(), 15250, "card revenue is not physical cash");
    const closed = await shifts.closeShift(sourceShift.id, { closingBalance: 15250 }, worker);
    assert.equal(closed.cashDifference?.toNumber(), 0);
    assert.equal(closed.cashTotal.toNumber(), 60000);
    assert.equal(closed.terminalTotal.toNumber(), 10000);
    assert.equal(closed.salesTotal.toNumber(), 70000);
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: pos.order.id } })).shiftId, sourceShift.id);

    const roleCodes = ["KITCHEN", "COURIER"];
    const permissionCodes = ["SHIFT_VIEW_OWN", "SHIFT_OPEN", "SHIFT_CLOSE", "CASH_TRANSACTION_CREATE"];
    for (const code of roleCodes) await prisma.role.upsert({ where: { code }, update: {}, create: { code, name: code } });
    for (const code of permissionCodes) await prisma.permission.upsert({ where: { code }, update: {}, create: { code, name: code } });
    const sql = readFileSync(resolve("prisma/migrations/20260911170000_employee_cash_permissions/migration.sql"), "utf8");
    await prisma.$executeRawUnsafe(sql);
    await prisma.$executeRawUnsafe(sql);
    assert.equal(await prisma.rolePermission.count({ where: { role: { code: { in: roleCodes } }, permission: { code: { in: permissionCodes } } } }), 8);
    console.info("PASS: unified POS/pickup/delivery cash, ownership, rollback, duplicate/race protection, transfers, card separation, full ledger balance, closing and idempotent permission migration");
  } finally { await prisma.onModuleDestroy(); }
}
void main();
