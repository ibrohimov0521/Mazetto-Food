import { Injectable } from "@nestjs/common";
import { OrderItemStatus, OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { resolveBranchScope } from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import type { ProductReportQueryDto, ReportQueryDto } from "./dto/report-query.dto";
import { resolveReportRange } from "./report-range";

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSalesReport(query: ReportQueryDto, user: AuthenticatedUser) {
    const range = resolveReportRange(query);
    const branchId = resolveBranchScope(user, query.branchId);
    const paymentWhere = {
      status: { in: [PaymentStatus.PAID, PaymentStatus.SUCCESS] },
      paidAt: { gte: range.from, lte: range.to },
      ...(branchId ? { order: { branchId } } : {}),
    } satisfies Prisma.PaymentWhereInput;
    const orderWhere = {
      createdAt: { gte: range.from, lte: range.to },
      status: { not: OrderStatus.CANCELLED },
      ...(branchId ? { branchId } : {}),
    } satisfies Prisma.OrderWhereInput;

    const [revenue, orderCount, paymentGroups] = await Promise.all([
      this.prisma.payment.aggregate({
        where: paymentWhere,
        _sum: { amount: true },
      }),
      this.prisma.order.count({ where: orderWhere }),
      this.prisma.payment.groupBy({
        by: ["paymentMethodId"],
        where: paymentWhere,
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);
    const methods = await this.prisma.paymentMethod.findMany({
      where: { id: { in: paymentGroups.map((group) => group.paymentMethodId) } },
      select: { id: true, code: true, name: true },
    });
    const methodById = new Map(methods.map((method) => [method.id, method]));

    return {
      period: range,
      branchId: branchId ?? null,
      revenue: revenue._sum.amount ?? new Prisma.Decimal(0),
      orderCount,
      averageOrderValue:
        orderCount > 0
          ? (revenue._sum.amount ?? new Prisma.Decimal(0)).div(new Prisma.Decimal(orderCount))
          : new Prisma.Decimal(0),
      paymentBreakdown: paymentGroups.map((group) => ({
        paymentMethod: methodById.get(group.paymentMethodId) ?? {
          id: group.paymentMethodId,
          code: "UNKNOWN",
          name: "Unknown",
        },
        amount: group._sum.amount ?? new Prisma.Decimal(0),
        count: group._count._all,
      })),
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
          status: { in: [PaymentStatus.PAID, PaymentStatus.SUCCESS] },
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
    const range = resolveReportRange(query);
    const branchId = resolveBranchScope(user, query.branchId);
    const successfulPaymentWhere = {
      status: { in: [PaymentStatus.PAID, PaymentStatus.SUCCESS] },
      paidAt: { gte: range.from, lte: range.to },
      ...(branchId ? { order: { branchId } } : {}),
    } satisfies Prisma.PaymentWhereInput;
    const orderWhere = {
      createdAt: { gte: range.from, lte: range.to },
      status: { not: OrderStatus.CANCELLED },
      ...(branchId ? { branchId } : {}),
    } satisfies Prisma.OrderWhereInput;
    const expenseWhere = {
      expenseDate: { gte: range.from, lte: range.to },
      ...(branchId ? { branchId } : {}),
    } satisfies Prisma.ExpenseWhereInput;
    const [sales, ordersCount, paymentGroups, expenses] = await Promise.all([
      this.prisma.payment.aggregate({ where: successfulPaymentWhere, _sum: { amount: true } }),
      this.prisma.order.count({ where: orderWhere }),
      this.prisma.payment.groupBy({
        by: ["paymentMethodId"],
        where: successfulPaymentWhere,
        _sum: { amount: true },
      }),
      this.prisma.expense.aggregate({ where: expenseWhere, _sum: { amount: true } }),
    ]);
    const methods = await this.prisma.paymentMethod.findMany({
      where: { id: { in: paymentGroups.map((group) => group.paymentMethodId) } },
      select: { id: true, code: true, name: true },
    });
    const methodById = new Map(methods.map((method) => [method.id, method]));
    const totalSales = sales._sum.amount ?? new Prisma.Decimal(0);
    const expenseTotal = expenses._sum.amount ?? new Prisma.Decimal(0);
    const amountByCode = new Map<string, Prisma.Decimal>();

    for (const group of paymentGroups) {
      const method = methodById.get(group.paymentMethodId);
      amountByCode.set(method?.code ?? "UNKNOWN", group._sum.amount ?? new Prisma.Decimal(0));
    }

    return {
      date: range.from,
      period: range,
      branchId: branchId ?? null,
      totalSales,
      cashSales: amountByCode.get("CASH") ?? new Prisma.Decimal(0),
      cardSales: this.sumCodes(amountByCode, ["CARD", "UZCARD", "HUMO", "TERMINAL"]),
      clickSales: amountByCode.get("CLICK") ?? new Prisma.Decimal(0),
      paymeSales: amountByCode.get("PAYME") ?? new Prisma.Decimal(0),
      ordersCount,
      averageOrder: ordersCount > 0 ? totalSales.div(new Prisma.Decimal(ordersCount)) : new Prisma.Decimal(0),
      expenses: expenseTotal,
      profit: totalSales.sub(expenseTotal),
      paymentBreakdown: paymentGroups.map((group) => ({
        paymentMethod: methodById.get(group.paymentMethodId) ?? null,
        amount: group._sum.amount ?? new Prisma.Decimal(0),
      })),
    };
  }

  private sumCodes(amountByCode: Map<string, Prisma.Decimal>, codes: string[]) {
    return codes.reduce(
      (total, code) => total.add(amountByCode.get(code) ?? new Prisma.Decimal(0)),
      new Prisma.Decimal(0),
    );
  }
}
