import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  KitchenTicketStatus,
  OrderItemStatus,
  OrderStatus,
  Prisma,
} from "@prisma/client";
import { PERMISSIONS } from "../../common/auth/permissions";
import {
  resolveRestaurantScope,
  resolveSoleActiveTenantId,
} from "../../common/auth/tenant-scope";
import { activeTableOrderStatuses } from "../tables/table-order-state";
import {
  MAX_ACTIVE_KITCHEN_TICKETS,
  trimKitchenQueue,
} from "../kitchen/kitchen-queue-window";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { customerVisibleProductWhere } from "../customers/customer-catalog-visibility";
import { unavailableProductWhere } from "../orders/order-rules";
import { encodeBranchRevisionCursor } from "./realtime.service";

@Injectable()
export class RealtimeBootstrapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings?: SettingsService,
  ) {}

  async create(
    branchId: string | undefined,
    user: AuthenticatedUser,
    panel?: string,
  ) {
    if (panel !== undefined && panel !== "kitchen") {
      throw new BadRequestException("Snapshot panel noto'g'ri.");
    }
    const kitchenPanel = panel === "kitchen";
    if (branchId !== undefined && !branchId.trim()) {
      throw new BadRequestException("Filial tanlanishi shart.");
    }

    return this.prisma.$transaction(
      async (tx) => {
        const scope = await resolveRestaurantScope(tx, user, branchId);
        if (!scope.branchId) {
          throw new BadRequestException("Filial tanlanishi shart.");
        }
        const enabledCashierPaymentMethods = new Set(
          this.settings
            ? await this.settings.getCsv(
                "cashier_payment_methods",
                scope.tenantId,
              )
            : ["CASH"],
        );

        const canViewKitchen = user.permissions.includes(
          PERMISSIONS.KITCHEN_VIEW,
        );
        if (kitchenPanel && !canViewKitchen) {
          throw new ForbiddenException("Oshxona snapshoti uchun ruxsat yo'q.");
        }
        if (kitchenPanel && !user.employeeId) {
          throw new ForbiddenException(
            "Oshxona xodimi foydalanuvchiga ulanmagan.",
          );
        }
        const canUsePosCatalog =
          !kitchenPanel && user.permissions.includes(PERMISSIONS.POS_USE);
        const canViewMenu =
          !kitchenPanel &&
          (canUsePosCatalog ||
            user.permissions.includes(PERMISSIONS.MENU_VIEW));
        const canViewTables =
          !kitchenPanel &&
          (canUsePosCatalog ||
            user.permissions.includes(PERMISSIONS.TABLE_VIEW));
        const canViewTableOrders = user.permissions.includes(
          PERMISSIONS.TABLE_VIEW,
        );
        if (!kitchenPanel && !canViewMenu && !canViewTables) {
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

        const kitchenQueue = kitchenPanel
          ? trimKitchenQueue(
              await tx.kitchenTicket.findMany({
                where: {
                  order: {
                    branchId: scope.branchId,
                    status: {
                      notIn: [
                        OrderStatus.SERVED,
                        OrderStatus.COMPLETED,
                        OrderStatus.CANCELLED,
                      ],
                    },
                  },
                  status: {
                    in: [
                      KitchenTicketStatus.NEW,
                      KitchenTicketStatus.ACCEPTED,
                      KitchenTicketStatus.COOKING,
                      KitchenTicketStatus.READY,
                    ],
                  },
                },
                orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
                take: MAX_ACTIVE_KITCHEN_TICKETS + 1,
                select: {
                  id: true,
                  ticketNumber: true,
                  status: true,
                  priority: true,
                  version: true,
                  revisionNumber: true,
                  isSupplement: true,
                  createdAt: true,
                  acceptedAt: true,
                  items: {
                    where: { status: OrderItemStatus.ACTIVE },
                    orderBy: { createdAt: "asc" },
                    select: {
                      id: true,
                      productName: true,
                      variantName: true,
                      quantity: true,
                      notes: true,
                      modifierSnapshot: true,
                      stationRouting: true,
                      printerNameSnapshot: true,
                    },
                  },
                  order: {
                    select: {
                      id: true,
                      branchId: true,
                      version: true,
                      total: true,
                      paymentStatus: true,
                      payments: {
                        select: {
                          amount: true,
                          status: true,
                          refunds: { select: { amount: true } },
                        },
                      },
                      orderNumber: true,
                      displayOrderNumber: true,
                      source: true,
                      type: true,
                      isSupplemental: true,
                      supplementNumber: true,
                      notes: true,
                      kitchenComment: true,
                      branch: { select: { name: true } },
                      table: { select: { number: true, name: true } },
                      items: {
                        where: { status: OrderItemStatus.ACTIVE },
                        orderBy: { createdAt: "asc" },
                        select: {
                          id: true,
                          productName: true,
                          variantName: true,
                          quantity: true,
                          notes: true,
                          modifierSnapshot: true,
                        },
                      },
                    },
                  },
                },
              }),
            )
          : undefined;

        const seenPaymentMethodCodes = new Set<string>();
        const paymentMethods = configuredPaymentMethods
          .filter((method) => {
            if (
              !enabledCashierPaymentMethods.has(method.code) ||
              seenPaymentMethodCodes.has(method.code)
            )
              return false;
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
          ...(kitchenQueue ? { kitchenQueue } : {}),
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
