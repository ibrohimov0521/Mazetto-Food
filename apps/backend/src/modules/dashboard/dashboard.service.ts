import { Injectable } from "@nestjs/common";
import { OrderStatus, PaymentStatus, Prisma, ShiftStatus } from "@prisma/client";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { resolveRestaurantScope } from "../../common/auth/tenant-scope";
import { PrismaService } from "../../prisma/prisma.service";
import { endOfDay, startOfDay } from "../reports/report-range";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(user: AuthenticatedUser, requestedBranchId?: string) {
    const now = new Date();
    const from = startOfDay(now);
    const to = endOfDay(now);
    const { tenantId, branchId } = await resolveRestaurantScope(
      this.prisma,
      user,
      requestedBranchId,
    );

    const [revenue, ordersCount, activeShifts] = await Promise.all([
      this.prisma.payment.aggregate({
        where: {
          status: {
            in: [
              PaymentStatus.PAID,
              PaymentStatus.SUCCESS,
              PaymentStatus.PARTIALLY_REFUNDED,
            ],
          },
          paidAt: { gte: from, lte: to },
          order: {
            branch: { tenantId },
            ...(branchId ? { branchId } : {}),
          },
        },
        _sum: { amount: true },
      }),
      this.prisma.order.count({
        where: {
          createdAt: { gte: from, lte: to },
          status: { not: OrderStatus.CANCELLED },
          branch: { tenantId },
          ...(branchId ? { branchId } : {}),
        },
      }),
      this.prisma.shift.count({
        where: {
          status: ShiftStatus.OPEN,
          branch: { tenantId },
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
