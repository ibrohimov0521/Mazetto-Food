import { Injectable } from "@nestjs/common";
import { OrderStatus, PaymentStatus, Prisma, ShiftStatus } from "@prisma/client";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { resolveBranchScope } from "../../common/auth/access-scope";
import { PrismaService } from "../../prisma/prisma.service";
import { endOfDay, startOfDay } from "../reports/report-range";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(user: AuthenticatedUser, requestedBranchId?: string) {
    const now = new Date();
    const from = startOfDay(now);
    const to = endOfDay(now);
    const branchId = resolveBranchScope(user, requestedBranchId);

    const [revenue, ordersCount, activeShifts] = await Promise.all([
      this.prisma.payment.aggregate({
        where: {
          status: { in: [PaymentStatus.PAID, PaymentStatus.SUCCESS] },
          paidAt: { gte: from, lte: to },
          ...(branchId ? { order: { branchId } } : {}),
        },
        _sum: { amount: true },
      }),
      this.prisma.order.count({
        where: {
          createdAt: { gte: from, lte: to },
          status: { not: OrderStatus.CANCELLED },
          ...(branchId ? { branchId } : {}),
        },
      }),
      this.prisma.shift.count({
        where: {
          status: ShiftStatus.OPEN,
          ...(branchId ? { branchId } : {}),
        },
      }),
    ]);

    const todayRevenue = revenue._sum.amount ?? new Prisma.Decimal(0);

    return {
      todayRevenue,
      todayOrdersCount: ordersCount,
      activeShifts,
      averageOrderValue:
        ordersCount > 0 ? todayRevenue.div(new Prisma.Decimal(ordersCount)) : new Prisma.Decimal(0),
      branchId: branchId ?? null,
      period: { from, to },
    };
  }
}
