import { Injectable } from "@nestjs/common";
import {
  OrderItemStatus,
  OrderSource,
  OrderStatus,
  PaymentStatus,
  Prisma,
  ShiftStatus,
} from "@prisma/client";
import { resolveBranchScope } from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import type { ProductReportQueryDto, ReportQueryDto } from "./dto/report-query.dto";
import { ReportPreset } from "./dto/report-query.dto";
import { resolveReportRange, toTashkentDateKey, toTashkentMonthKey } from "./report-range";

const successfulPaymentStatuses = [PaymentStatus.PAID, PaymentStatus.SUCCESS] as const;
const successfulOrderStatuses = [
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.SERVED,
  OrderStatus.COMPLETED,
] as const;
const cashPaymentCodes = new Set(["CASH"]);

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSalesReport(query: ReportQueryDto, user: AuthenticatedUser) {
    const range = resolveReportRange(query);
    const branchId = resolveBranchScope(user, query.branchId);
    const source = query.source;
    const paymentWhere = this.successfulPaymentWhere(range, branchId, source);
    const cancelledOrderWhere = this.cancelledOrderWhere(range, branchId, source);

    const [payments, cancelledOrders, orderItems, shifts] = await Promise.all([
      this.prisma.payment.findMany({
        where: paymentWhere,
        select: {
          id: true,
          amount: true,
          paidAt: true,
          methodCode: true,
          acceptedById: true,
          method: { select: { id: true, code: true, name: true } },
          order: {
            select: {
              id: true,
              orderNumber: true,
              source: true,
              status: true,
              total: true,
              createdAt: true,
              branch: { select: { id: true, code: true, name: true } },
              createdBy: {
                select: {
                  id: true,
                  employeeCode: true,
                  firstName: true,
                  lastName: true,
                },
              },
              shiftId: true,
            },
          },
        },
        orderBy: { paidAt: "asc" },
      }),
      this.prisma.order.count({ where: cancelledOrderWhere }),
      this.prisma.orderItem.findMany({
        where: {
          status: OrderItemStatus.ACTIVE,
          order: {
            status: { in: [...successfulOrderStatuses] },
            paymentStatus: { in: [...successfulPaymentStatuses] },
            ...(branchId ? { branchId } : {}),
            ...(source ? { source } : {}),
            payments: {
              some: {
                status: { in: [...successfulPaymentStatuses] },
                paidAt: { gte: range.from, lte: range.to },
              },
            },
          },
        },
        select: {
          productId: true,
          productName: true,
          quantity: true,
          totalPrice: true,
          product: {
            select: {
              category: { select: { id: true, code: true, name: true } },
            },
          },
        },
      }),
      this.prisma.shift.findMany({
        where: this.shiftWhere(range, branchId, source),
        select: {
          id: true,
          branchId: true,
          employeeId: true,
          shiftNumber: true,
          status: true,
          openedAt: true,
          closedAt: true,
          salesTotal: true,
          cashTotal: true,
          terminalTotal: true,
          clickTotal: true,
          paymeTotal: true,
          otherPaymentTotal: true,
          expectedCash: true,
          closingBalance: true,
          cashDifference: true,
          orderCount: true,
          branch: { select: { id: true, code: true, name: true } },
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { openedAt: "desc" },
      }),
    ]);

    const revenue = this.sum(payments.map((payment) => payment.amount));
    const uniqueOrderIds = new Set(payments.map((payment) => payment.order.id));
    const orderCount = uniqueOrderIds.size;
    const cashSales = this.sum(
      payments
        .filter((payment) => cashPaymentCodes.has(payment.methodCode ?? payment.method.code))
        .map((payment) => payment.amount),
    );
    const sourceBreakdown = this.sourceBreakdown(payments);
    const branchBreakdown = this.branchBreakdown(payments);
    const cashierBreakdown = this.cashierBreakdown(payments);
    const shiftBreakdown = this.shiftBreakdown(shifts, payments);
    const topProducts = this.topProducts(orderItems);
    const categorySales = this.categorySales(orderItems);
    const timeSeries = this.timeSeries(payments, range);

    return {
      period: range,
      branchId: branchId ?? null,
      source: source ?? null,
      salesRule: {
        paymentStatuses: [...successfulPaymentStatuses],
        orderStatuses: [...successfulOrderStatuses],
        excludedOrderStatuses: [OrderStatus.CANCELLED],
        basis: "Successful payments paid inside the selected Asia/Tashkent period. Cancelled, failed, pending, unpaid, and refunded payments are excluded from successful sales.",
      },
      revenue,
      totalSales: revenue,
      orderCount,
      averageOrderValue:
        orderCount > 0 ? revenue.div(new Prisma.Decimal(orderCount)) : new Prisma.Decimal(0),
      cashSales,
      cancelledOrders,
      refundHandling: {
        supported: false,
        amount: null,
        note: "Refund/provider reconciliation is pending integration; refunded payments are not counted as successful sales.",
      },
      paymentBreakdown: this.paymentBreakdown(payments),
      sourceBreakdown,
      branchBreakdown,
      cashierBreakdown,
      shiftBreakdown,
      topProducts,
      categorySales,
      timeSeries,
      limitations: {
        categorySales:
          "OrderItem stores product snapshots but not category snapshots; category sales use the current product-category relation.",
        onlinePayments:
          "Click/Payme/Card provider reconciliation is not active; those totals remain N/A until real provider records exist.",
      },
    };
  }

  async getProductReport(query: ProductReportQueryDto, user: AuthenticatedUser) {
    const range = resolveReportRange(query);
    const branchId = resolveBranchScope(user, query.branchId);
    const groups = await this.prisma.orderItem.groupBy({
      by: ["productId", "productName"],
      where: {
        status: OrderItemStatus.ACTIVE,
        createdAt: { gte: range.from, lte: range.to },
        order: {
          status: { not: OrderStatus.CANCELLED },
          ...(branchId ? { branchId } : {}),
        },
      },
      _sum: {
        quantity: true,
        totalPrice: true,
      },
      _count: { _all: true },
      orderBy: {
        _sum: {
          totalPrice: "desc",
        },
      },
      take: query.limit,
    });

    return {
      period: range,
      branchId: branchId ?? null,
      products: groups.map((group) => ({
        productId: group.productId,
        productName: group.productName,
        quantitySold: group._sum.quantity ?? new Prisma.Decimal(0),
        revenue: group._sum.totalPrice ?? new Prisma.Decimal(0),
        itemCount: group._count._all,
      })),
    };
  }

  async getEmployeeReport(query: ReportQueryDto, user: AuthenticatedUser) {
    const range = resolveReportRange(query);
    const branchId = resolveBranchScope(user, query.branchId);
    const branchFilter = branchId ? { branchId } : {};
    const [ordersHandled, salesByEmployee, shifts] = await Promise.all([
      this.prisma.order.groupBy({
        by: ["createdById"],
        where: {
          createdAt: { gte: range.from, lte: range.to },
          status: { not: OrderStatus.CANCELLED },
          ...branchFilter,
          createdById: { not: null },
        },
        _count: { _all: true },
      }),
      this.prisma.payment.groupBy({
        by: ["acceptedById"],
        where: {
          status: { in: [...successfulPaymentStatuses] },
          paidAt: { gte: range.from, lte: range.to },
          acceptedById: { not: null },
          ...(branchId ? { order: { branchId } } : {}),
        },
        _sum: { amount: true },
      }),
      this.prisma.shift.findMany({
        where: {
          openedAt: { gte: range.from, lte: range.to },
          ...branchFilter,
        },
        select: {
          id: true,
          employeeId: true,
          shiftNumber: true,
          status: true,
          openedAt: true,
          closedAt: true,
          salesTotal: true,
          cashTotal: true,
          terminalTotal: true,
          orderCount: true,
        },
        orderBy: { openedAt: "desc" },
      }),
    ]);
    const employeeIds = [
      ...new Set([
        ...ordersHandled.flatMap((group) => (group.createdById ? [group.createdById] : [])),
        ...salesByEmployee.flatMap((group) => (group.acceptedById ? [group.acceptedById] : [])),
        ...shifts.map((shift) => shift.employeeId),
      ]),
    ];
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        branchId: true,
      },
    });
    const employeeById = new Map(employees.map((employee) => [employee.id, employee]));

    return {
      period: range,
      branchId: branchId ?? null,
      employees: employeeIds.map((employeeId) => ({
        employee: employeeById.get(employeeId) ?? null,
        ordersHandled:
          ordersHandled.find((group) => group.createdById === employeeId)?._count._all ?? 0,
        salesAmount:
          salesByEmployee.find((group) => group.acceptedById === employeeId)?._sum.amount ??
          new Prisma.Decimal(0),
        shifts: shifts.filter((shift) => shift.employeeId === employeeId),
      })),
    };
  }

  async getExpenseReport(query: ReportQueryDto, user: AuthenticatedUser) {
    const range = resolveReportRange(query);
    const branchId = resolveBranchScope(user, query.branchId);
    const where = {
      expenseDate: { gte: range.from, lte: range.to },
      ...(branchId ? { branchId } : {}),
    } satisfies Prisma.ExpenseWhereInput;
    const [total, categories, expenses] = await Promise.all([
      this.prisma.expense.aggregate({
        where,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.expense.groupBy({
        by: ["category"],
        where,
        _sum: { amount: true },
        _count: { _all: true },
        orderBy: {
          _sum: {
            amount: "desc",
          },
        },
      }),
      this.prisma.expense.findMany({
        where,
        orderBy: { expenseDate: "desc" },
        select: {
          id: true,
          branchId: true,
          shiftId: true,
          employeeId: true,
          category: true,
          amount: true,
          description: true,
          expenseDate: true,
        },
      }),
    ]);

    return {
      period: range,
      branchId: branchId ?? null,
      totalAmount: total._sum.amount ?? new Prisma.Decimal(0),
      expenseCount: total._count._all,
      categories: categories.map((category) => ({
        category: category.category,
        amount: category._sum.amount ?? new Prisma.Decimal(0),
        count: category._count._all,
      })),
      expenses,
    };
  }

  async getZReport(query: ReportQueryDto, user: AuthenticatedUser) {
    const report = await this.getSalesReport(query, user);
    const range = report.period;
    const branchId = report.branchId ?? undefined;
    const expenseWhere = {
      expenseDate: { gte: range.from, lte: range.to },
      ...(branchId ? { branchId } : {}),
    } satisfies Prisma.ExpenseWhereInput;
    const expenses = await this.prisma.expense.aggregate({ where: expenseWhere, _sum: { amount: true } });
    const expenseTotal = expenses._sum.amount ?? new Prisma.Decimal(0);

    return {
      date: range.from,
      period: range,
      branchId: report.branchId,
      totalSales: report.totalSales,
      cashSales: report.cashSales,
      cardSales: null,
      clickSales: null,
      paymeSales: null,
      ordersCount: report.orderCount,
      averageOrder: report.averageOrderValue,
      expenses: expenseTotal,
      profit: report.totalSales.sub(expenseTotal),
      paymentBreakdown: report.paymentBreakdown.map((group) => ({
        paymentMethod: group.paymentMethod,
        amount: group.amount,
      })),
      unavailableMetrics: ["cardSales", "clickSales", "paymeSales"],
    };
  }

  private successfulPaymentWhere(
    range: { from: Date; to: Date },
    branchId: string | undefined,
    source: OrderSource | undefined,
  ) {
    return {
      status: { in: [...successfulPaymentStatuses] },
      paidAt: { gte: range.from, lte: range.to },
      order: {
        status: { in: [...successfulOrderStatuses] },
        ...(branchId ? { branchId } : {}),
        ...(source ? { source } : {}),
      },
    } satisfies Prisma.PaymentWhereInput;
  }

  private cancelledOrderWhere(
    range: { from: Date; to: Date },
    branchId: string | undefined,
    source: OrderSource | undefined,
  ) {
    return {
      createdAt: { gte: range.from, lte: range.to },
      status: OrderStatus.CANCELLED,
      ...(branchId ? { branchId } : {}),
      ...(source ? { source } : {}),
    } satisfies Prisma.OrderWhereInput;
  }

  private shiftWhere(
    range: { from: Date; to: Date },
    branchId: string | undefined,
    source: OrderSource | undefined,
  ) {
    if (source && source !== OrderSource.POS) {
      return { id: "__no_pos_shift_for_selected_source__" } satisfies Prisma.ShiftWhereInput;
    }

    return {
      ...(branchId ? { branchId } : {}),
      openedAt: { lte: range.to },
      OR: [{ closedAt: null }, { closedAt: { gte: range.from } }],
    } satisfies Prisma.ShiftWhereInput;
  }

  private paymentBreakdown(payments: ReportPayment[]) {
    const groups = new Map<string, {
      paymentMethod: ReportPayment["method"];
      amount: Prisma.Decimal;
      count: number;
    }>();

    for (const payment of payments) {
      const key = payment.method.id;
      const group = groups.get(key) ?? {
        paymentMethod: payment.method,
        amount: new Prisma.Decimal(0),
        count: 0,
      };
      group.amount = group.amount.add(payment.amount);
      group.count += 1;
      groups.set(key, group);
    }

    return [...groups.values()].sort((left, right) => right.amount.comparedTo(left.amount));
  }

  private sourceBreakdown(payments: ReportPayment[]) {
    return Object.values(OrderSource).map((source) => {
      const sourcePayments = payments.filter((payment) => payment.order.source === source);
      const amount = this.sum(sourcePayments.map((payment) => payment.amount));

      return {
        source,
        amount,
        orderCount: new Set(sourcePayments.map((payment) => payment.order.id)).size,
        paymentCount: sourcePayments.length,
      };
    });
  }

  private branchBreakdown(payments: ReportPayment[]) {
    const groups = new Map<string, {
      branch: ReportPayment["order"]["branch"];
      amount: Prisma.Decimal;
      orderIds: Set<string>;
    }>();

    for (const payment of payments) {
      const key = payment.order.branch.id;
      const group = groups.get(key) ?? {
        branch: payment.order.branch,
        amount: new Prisma.Decimal(0),
        orderIds: new Set<string>(),
      };
      group.amount = group.amount.add(payment.amount);
      group.orderIds.add(payment.order.id);
      groups.set(key, group);
    }

    return [...groups.values()]
      .map((group) => ({
        branch: group.branch,
        amount: group.amount,
        orderCount: group.orderIds.size,
      }))
      .sort((left, right) => right.amount.comparedTo(left.amount));
  }

  private cashierBreakdown(payments: ReportPayment[]) {
    const groups = new Map<string, {
      cashier: NonNullable<ReportPayment["order"]["createdBy"]>;
      amount: Prisma.Decimal;
      orderIds: Set<string>;
    }>();

    for (const payment of payments) {
      if (payment.order.source !== OrderSource.POS || !payment.order.createdBy) {
        continue;
      }

      const key = payment.order.createdBy.id;
      const group = groups.get(key) ?? {
        cashier: payment.order.createdBy,
        amount: new Prisma.Decimal(0),
        orderIds: new Set<string>(),
      };
      group.amount = group.amount.add(payment.amount);
      group.orderIds.add(payment.order.id);
      groups.set(key, group);
    }

    return [...groups.values()]
      .map((group) => ({
        cashier: group.cashier,
        amount: group.amount,
        orderCount: group.orderIds.size,
      }))
      .sort((left, right) => right.amount.comparedTo(left.amount));
  }

  private shiftBreakdown(shifts: ReportShift[], payments: ReportPayment[]) {
    const paymentsByShift = new Map<string, ReportPayment[]>();

    for (const payment of payments) {
      if (!payment.order.shiftId) {
        continue;
      }

      paymentsByShift.set(payment.order.shiftId, [
        ...(paymentsByShift.get(payment.order.shiftId) ?? []),
        payment,
      ]);
    }

    return shifts.map((shift) => {
      const shiftPayments = paymentsByShift.get(shift.id) ?? [];
      const liveGrossSales = this.sum(shiftPayments.map((payment) => payment.amount));
      const liveCashSales = this.sum(
        shiftPayments
          .filter((payment) => cashPaymentCodes.has(payment.methodCode ?? payment.method.code))
          .map((payment) => payment.amount),
      );
      const liveOrderCount = new Set(shiftPayments.map((payment) => payment.order.id)).size;

      return {
        id: shift.id,
        branch: shift.branch,
        cashier: shift.employee,
        shiftNumber: shift.shiftNumber,
        status: shift.status,
        openedAt: shift.openedAt,
        closedAt: shift.closedAt,
        orderCount: shift.status === ShiftStatus.CLOSED ? shift.orderCount : liveOrderCount,
        grossSales: shift.status === ShiftStatus.CLOSED ? shift.salesTotal : liveGrossSales,
        cashSales: shift.status === ShiftStatus.CLOSED ? shift.cashTotal : liveCashSales,
        terminalSales: shift.terminalTotal,
        expectedCash: shift.expectedCash,
        actualCash: shift.closingBalance,
        cashDifference: shift.cashDifference,
      };
    });
  }

  private topProducts(orderItems: ReportOrderItem[]) {
    const groups = new Map<string, {
      productId: string | null;
      productName: string;
      quantity: Prisma.Decimal;
      amount: Prisma.Decimal;
    }>();

    for (const item of orderItems) {
      const key = item.productId ?? item.productName;
      const group = groups.get(key) ?? {
        productId: item.productId,
        productName: item.productName,
        quantity: new Prisma.Decimal(0),
        amount: new Prisma.Decimal(0),
      };
      group.quantity = group.quantity.add(item.quantity);
      group.amount = group.amount.add(item.totalPrice);
      groups.set(key, group);
    }

    return [...groups.values()]
      .sort((left, right) => right.amount.comparedTo(left.amount))
      .slice(0, 10);
  }

  private categorySales(orderItems: ReportOrderItem[]) {
    const groups = new Map<string, {
      category: { id: string | null; code: string; name: string };
      quantity: Prisma.Decimal;
      amount: Prisma.Decimal;
    }>();

    for (const item of orderItems) {
      const category = item.product?.category ?? { id: null, code: "UNKNOWN", name: "Kategoriya aniqlanmagan" };
      const key = category.id ?? category.code;
      const group = groups.get(key) ?? {
        category,
        quantity: new Prisma.Decimal(0),
        amount: new Prisma.Decimal(0),
      };
      group.quantity = group.quantity.add(item.quantity);
      group.amount = group.amount.add(item.totalPrice);
      groups.set(key, group);
    }

    return [...groups.values()].sort((left, right) => right.amount.comparedTo(left.amount));
  }

  private timeSeries(payments: ReportPayment[], range: { from: Date; to: Date; preset: ReportPreset }) {
    const grain = range.preset === ReportPreset.YEAR ? "month" : "day";
    const groups = new Map<string, { amount: Prisma.Decimal; orderIds: Set<string> }>();

    for (const payment of payments) {
      const paidAt = payment.paidAt ?? payment.order.createdAt;
      const key = grain === "month" ? toTashkentMonthKey(paidAt) : toTashkentDateKey(paidAt);
      const group = groups.get(key) ?? { amount: new Prisma.Decimal(0), orderIds: new Set<string>() };
      group.amount = group.amount.add(payment.amount);
      group.orderIds.add(payment.order.id);
      groups.set(key, group);
    }

    return {
      grain,
      data: [...groups.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, group]) => ({
          date,
          amount: group.amount,
          orderCount: group.orderIds.size,
        })),
    };
  }

  private sum(values: Prisma.Decimal[]) {
    return values.reduce((total, value) => total.add(value), new Prisma.Decimal(0));
  }
}

type ReportPayment = Prisma.PaymentGetPayload<{
  select: {
    id: true;
    amount: true;
    paidAt: true;
    methodCode: true;
    acceptedById: true;
    method: { select: { id: true; code: true; name: true } };
    order: {
      select: {
        id: true;
        orderNumber: true;
        source: true;
        status: true;
        total: true;
        createdAt: true;
        branch: { select: { id: true; code: true; name: true } };
        createdBy: {
          select: {
            id: true;
            employeeCode: true;
            firstName: true;
            lastName: true;
          };
        };
        shiftId: true;
      };
    };
  };
}>;

type ReportOrderItem = Prisma.OrderItemGetPayload<{
  select: {
    productId: true;
    productName: true;
    quantity: true;
    totalPrice: true;
    product: {
      select: {
        category: { select: { id: true; code: true; name: true } };
      };
    };
  };
}>;

type ReportShift = Prisma.ShiftGetPayload<{
  select: {
    id: true;
    branchId: true;
    employeeId: true;
    shiftNumber: true;
    status: true;
    openedAt: true;
    closedAt: true;
    salesTotal: true;
    cashTotal: true;
    terminalTotal: true;
    clickTotal: true;
    paymeTotal: true;
    otherPaymentTotal: true;
    expectedCash: true;
    closingBalance: true;
    cashDifference: true;
    orderCount: true;
    branch: { select: { id: true; code: true; name: true } };
    employee: {
      select: {
        id: true;
        employeeCode: true;
        firstName: true;
        lastName: true;
      };
    };
  };
}>;
