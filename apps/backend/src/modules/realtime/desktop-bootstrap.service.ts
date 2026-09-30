import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  resolveRestaurantScope,
  resolveSoleActiveTenantId,
} from "../../common/auth/tenant-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { encodeBranchRevisionCursor } from "./realtime.service";

@Injectable()
export class RealtimeBootstrapService {
  constructor(private readonly prisma: PrismaService) {}

  async create(branchId: string | undefined, user: AuthenticatedUser) {
    if (branchId !== undefined && !branchId.trim()) {
      throw new BadRequestException("Filial tanlanishi shart.");
    }

    return this.prisma.$transaction(
      async (tx) => {
        const scope = await resolveRestaurantScope(tx, user, branchId);
        if (!scope.branchId) {
          throw new BadRequestException("Filial tanlanishi shart.");
        }

        // Catalog rows without a branch are still shared legacy data. Keep
        // bootstrap closed until those rows are tenant-owned.
        if ((await resolveSoleActiveTenantId(tx)) !== scope.tenantId) {
          throw new ForbiddenException(
            "Offline POS katalogi hali tenantlar bo'yicha ajratilmagan.",
          );
        }

        const branch = await tx.branch.findFirst({
          where: { id: scope.branchId, tenantId: scope.tenantId },
          select: {
            id: true,
            code: true,
            name: true,
            timezone: true,
            isActive: true,
            isTemporarilyClosed: true,
            acceptsOrders: true,
            deliveryEnabled: true,
            pickupEnabled: true,
            realtimeRevision: true,
          },
        });
        if (!branch) throw new NotFoundException("Branch not found");

        const [categories, products] = await Promise.all([
          tx.category.findMany({
            where: {
              isActive: true,
              OR: [{ branchId: scope.branchId }, { branchId: null }],
            },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: {
              id: true,
              branchId: true,
              parentId: true,
              code: true,
              name: true,
              description: true,
              imageUrl: true,
              sortOrder: true,
            },
          }),
          tx.product.findMany({
            where: {
              isAvailable: true,
              OR: [{ branchId: scope.branchId }, { branchId: null }],
              NOT: {
                branchAvailabilities: {
                  some: {
                    branchId: scope.branchId,
                    status: { in: ["OUT_OF_STOCK", "UNAVAILABLE"] },
                  },
                },
              },
              category: {
                isActive: true,
                OR: [{ branchId: scope.branchId }, { branchId: null }],
              },
            },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: {
              id: true,
              branchId: true,
              categoryId: true,
              code: true,
              name: true,
              description: true,
              imageUrl: true,
              preparationTime: true,
              sellingPrice: true,
              isAvailable: true,
              isRecommended: true,
              isCombo: true,
              sortOrder: true,
              printerRouting: true,
              category: {
                select: { id: true, code: true, name: true },
              },
              variants: {
                where: { isAvailable: true },
                orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
                select: {
                  id: true,
                  code: true,
                  name: true,
                  sellingPrice: true,
                  isDefault: true,
                  isAvailable: true,
                  sortOrder: true,
                },
              },
              bundleItems: {
                orderBy: { sortOrder: "asc" },
                select: {
                  id: true,
                  componentCode: true,
                  componentName: true,
                  quantity: true,
                  unitLabel: true,
                  sortOrder: true,
                  componentProduct: {
                    select: { id: true, code: true, name: true },
                  },
                },
              },
              modifiers: {
                where: { modifier: { isActive: true } },
                orderBy: { sortOrder: "asc" },
                select: {
                  isRequired: true,
                  minSelect: true,
                  maxSelect: true,
                  sortOrder: true,
                  modifier: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      description: true,
                      price: true,
                      sortOrder: true,
                    },
                  },
                },
              },
            },
          }),
        ]);

        return {
          schemaVersion: 1,
          generatedAt: new Date().toISOString(),
          tenantId: scope.tenantId,
          branchId: branch.id,
          branch: {
            id: branch.id,
            code: branch.code,
            name: branch.name,
            timezone: branch.timezone,
            isActive: branch.isActive,
            isTemporarilyClosed: branch.isTemporarilyClosed,
            acceptsOrders: branch.acceptsOrders,
            deliveryEnabled: branch.deliveryEnabled,
            pickupEnabled: branch.pickupEnabled,
          },
          menu: { categories, products },
          cursor: encodeBranchRevisionCursor({
            [branch.id]: branch.realtimeRevision,
          }),
          offlineCapabilities: {
            queuedPaymentMethods: ["CASH"],
            requiresServer: [
              "card-payment",
              "menu-changes",
              "staff-management",
            ],
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
