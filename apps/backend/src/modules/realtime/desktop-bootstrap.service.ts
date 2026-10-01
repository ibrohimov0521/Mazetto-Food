import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PERMISSIONS } from "../../common/auth/permissions";
import {
  resolveRestaurantScope,
  resolveSoleActiveTenantId,
} from "../../common/auth/tenant-scope";
import { activeTableOrderStatuses } from "../tables/table-order-state";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { customerVisibleProductWhere } from "../customers/customer-catalog-visibility";
import { unavailableProductWhere } from "../orders/order-rules";
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

        const canUsePosCatalog = user.permissions.includes(PERMISSIONS.POS_USE);
        const canViewMenu =
          canUsePosCatalog || user.permissions.includes(PERMISSIONS.MENU_VIEW);
        const canViewTables =
          canUsePosCatalog || user.permissions.includes(PERMISSIONS.TABLE_VIEW);
        const canViewTableOrders = user.permissions.includes(
          PERMISSIONS.TABLE_VIEW,
        );
        if (!canViewMenu && !canViewTables) {
          throw new ForbiddenException("Offline snapshot uchun ruxsat yo'q.");
        }

        // Shared legacy menu rows are safe only while one active tenant exists.
        if (
          canViewMenu &&
          (await resolveSoleActiveTenantId(tx)) !== scope.tenantId
        ) {
          throw new ForbiddenException(
            "Umumiy menyu katalogi hali restoranlar bo'yicha ajratilmagan.",
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

        const [categories, products, configuredPaymentMethods, tables, halls] =
          await Promise.all([
            canViewMenu
              ? tx.category.findMany({
                  where: {
                    isActive: true,
                    OR: [{ branchId: scope.branchId }, { branchId: null }],
                    products: {
                      some: {
                        ...customerVisibleProductWhere(),
                        isAvailable: true,
                        OR: [{ branchId: scope.branchId }, { branchId: null }],
                        ...unavailableProductWhere(scope.branchId),
                      },
                    },
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
                })
              : Promise.resolve([]),
            canViewMenu
              ? tx.product.findMany({
                  where: {
                    ...customerVisibleProductWhere(),
                    isAvailable: true,
                    OR: [{ branchId: scope.branchId }, { branchId: null }],
                    ...unavailableProductWhere(scope.branchId),
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
                })
              : Promise.resolve([]),
            canUsePosCatalog
              ? tx.paymentMethod.findMany({
                  where: {
                    isActive: true,
                    OR: [{ branchId: scope.branchId }, { branchId: null }],
                  },
                  orderBy: [
                    { branchId: "desc" },
                    { sortOrder: "asc" },
                    { name: "asc" },
                  ],
                  select: {
                    branchId: true,
                    code: true,
                    name: true,
                    sortOrder: true,
                  },
                })
              : Promise.resolve([]),
            canViewTables
              ? tx.restaurantTable.findMany({
                  where: { branchId: scope.branchId, isActive: true },
                  orderBy: [
                    { hall: { sortOrder: "asc" } },
                    { sortOrder: "asc" },
                    { number: "asc" },
                  ],
                  select: {
                    id: true,
                    branchId: true,
                    hallId: true,
                    code: true,
                    name: true,
                    number: true,
                    capacity: true,
                    status: true,
                    hall: { select: { id: true, name: true } },
                    ...(canViewTableOrders
                      ? {
                          orders: {
                            where: { status: { in: activeTableOrderStatuses } },
                            orderBy: { createdAt: "desc" },
                            select: {
                              id: true,
                              version: true,
                              orderNumber: true,
                              displayOrderNumber: true,
                              status: true,
                              isSupplemental: true,
                              parentOrderId: true,
                              supplementNumber: true,
                              total: true,
                              guestCount: true,
                              notes: true,
                              createdAt: true,
                              items: {
                                orderBy: { createdAt: "asc" },
                                select: {
                                  id: true,
                                  productId: true,
                                  variantId: true,
                                  productName: true,
                                  variantName: true,
                                  quantity: true,
                                  unitPrice: true,
                                  totalPrice: true,
                                  status: true,
                                  notes: true,
                                  modifierSnapshot: true,
                                },
                              },
                            },
                          },
                        }
                      : {}),
                  },
                })
              : Promise.resolve([]),
            canViewTables
              ? tx.hall.findMany({
                  where: { branchId: scope.branchId, isActive: true },
                  orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
                  select: {
                    id: true,
                    branchId: true,
                    code: true,
                    name: true,
                    isActive: true,
                    sortOrder: true,
                  },
                })
              : Promise.resolve([]),
          ]);

        const seenPaymentMethodCodes = new Set<string>();
        const paymentMethods = configuredPaymentMethods
          .filter((method) => {
            if (seenPaymentMethodCodes.has(method.code)) return false;
            seenPaymentMethodCodes.add(method.code);
            return true;
          })
          .sort((left, right) => left.sortOrder - right.sortOrder)
          .map(({ code, name }) => ({ code, name, active: true }));

        return {
          schemaVersion: 2,
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
          ...(canViewMenu ? { menu: { categories, products } } : {}),
          ...(canViewTables ? { halls, tables } : {}),
          ...(canUsePosCatalog
            ? {
                catalog: {
                  branchId: branch.id,
                  categories: categories.map(({ id, name }) => ({ id, name })),
                  products,
                  paymentMethods,
                  tables,
                },
              }
            : {}),
          cursor: encodeBranchRevisionCursor({
            [branch.id]: branch.realtimeRevision,
          }),
          ...(canUsePosCatalog
            ? {
                offlineCapabilities: {
                  queuedPaymentMethods: ["CASH"],
                  requiresServer: [
                    "card-payment",
                    "menu-changes",
                    "staff-management",
                  ],
                },
              }
            : {}),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
