import { syncKitchenTickets } from "../kitchen/kitchen-status-sync";
import {
  kitchenEvents,
  kitchenOrderStatusChangedEvent,
} from "../kitchen/kitchen-events";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  OrderItemStatus,
  OrderSource,
  OrderStatus,
  OrderType,
  PaymentStatus,
  Prisma,
  CashTransactionType,
  RevenueRecordSource,
  StockMovementType,
  TableStatus,
} from "@prisma/client";
import {
  resolveBranchScope,
  resolveRequiredBranchScope,
} from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { customerVisibleProductCodes } from "../customers/customer-catalog-visibility";
import { InventoryService } from "../inventory/inventory.service";
import { KitchenService } from "../kitchen/kitchen.service";
import type { CreateOrderDto } from "./dto/create-order.dto";
import type { ListOrdersDto } from "./dto/list-orders.dto";
import type {
  AddOrderItemDto,
  UpdateOrderItemDto,
} from "./dto/order-item.dto";
import type {
  BulkUpdateOrderStatusDto,
  UpdateOrderStatusDto,
} from "./dto/order-status.dto";
import type { CreatePosCheckoutDto } from "./dto/pos-checkout.dto";
import { allocateDisplayOrderNumber } from "./order-display-number";
import {
  assertOrderCanChange,
  assertPosCheckoutQuantities,
  calculateItemTotal,
  createOrderNumber,
  createPosCheckoutRequestHash,
  createPosIdempotencyKey,
  isRetryableTransactionConflict,
  isUniqueConstraintError,
  orderInclude,
  requireEmployee,
  resolveEmployeeId,
  toStoredStatus,
  unavailableProductWhere,
  type ModifierSnapshot,
} from "./order-rules";
import {
  assertBranchExists,
  assertCashPaymentMethod,
  assertEmployeeInBranch,
  assertOpenCashierShift,
  assertTableInBranch,
  createModifierSnapshot,
  recalculateOrderTotals,
} from "./order-guards";

type TransactionClient = Prisma.TransactionClient;
type ConfirmOrderForPreparationOptions = {
  orderId: string;
  userId?: string | null;
  employeeId?: string | null;
  reason?: string | null;
};

type PosCheckoutOperation = {
  id: string;
  orderId: string;
  requestHash: string;
  status: string;
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly kitchenService: KitchenService,
  ) {}

  async listPosCatalog(user: AuthenticatedUser) {
    const branchId = resolveRequiredBranchScope(user);

    await assertBranchExists(this.prisma, branchId);

    const categories = await this.prisma.category.findMany({
      where: {
        isActive: true,
        OR: [{ branchId }, { branchId: null }],
        products: {
          some: {
            code: { in: [...customerVisibleProductCodes] },
            isAvailable: true,
            OR: [{ branchId }, { branchId: null }],
            ...unavailableProductWhere(branchId),
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        imageUrl: true,
        sortOrder: true,
      },
    });

    const products = await this.prisma.product.findMany({
      where: {
        code: { in: [...customerVisibleProductCodes] },
        isAvailable: true,
        OR: [{ branchId }, { branchId: null }],
        ...unavailableProductWhere(branchId),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        categoryId: true,
        code: true,
        name: true,
        description: true,
        imageUrl: true,
        preparationTime: true,
        sellingPrice: true,
        isCombo: true,
        category: {
          select: {
            id: true,
            code: true,
            name: true,
          },
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
            sortOrder: true,
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
                price: true,
                sortOrder: true,
              },
            },
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
          },
        },
      },
    });

    return {
      branchId,
      categories,
      products,
      paymentMethods: [{ code: "CASH", name: "Naqd", active: true }],
    };
  }

  async createPosCheckout(dto: CreatePosCheckoutDto, user: AuthenticatedUser) {
    const branchId = resolveRequiredBranchScope(user);
    const employeeId = requireEmployee(user);
    const idempotencyKey = createPosIdempotencyKey(dto.idempotencyKey);
    const requestHash = createPosCheckoutRequestHash(dto, branchId, employeeId);
    let kitchenTicket: Awaited<
      ReturnType<KitchenService["createTicketForOrder"]>
    > | null = null;

    assertPosCheckoutQuantities(dto);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      kitchenTicket = null;

      try {
        const order = await this.prisma.$transaction(
          async (tx) => {
            const existingOperation = await tx.paymentOperation.findUnique({
              where: { idempotencyKey },
            });

            if (existingOperation) {
              return this.resolveExistingPosCheckout(
                tx,
                existingOperation,
                requestHash,
              );
            }

            await assertBranchExists(tx, branchId);
            await assertEmployeeInBranch(tx, employeeId, branchId);
            const openShift = await assertOpenCashierShift(
              tx,
              branchId,
              employeeId,
            );
            const cashMethod = await assertCashPaymentMethod(tx, branchId);
            const displayOrder = await allocateDisplayOrderNumber(
              tx,
              OrderSource.POS,
            );

            const order = await tx.order.create({
              data: {
                branchId,
                orderNumber: createOrderNumber(),
                ...displayOrder,
                shiftId: openShift.id,
                source: OrderSource.POS,
                type: OrderType.TAKEAWAY,
                status: OrderStatus.NEW,
                paymentStatus: PaymentStatus.PENDING,
                createdById: employeeId,
                acceptedById: employeeId,
                notes: dto.notes ?? null,
                kitchenComment: "POS counter order",
              },
            });

            const operation = await tx.paymentOperation.create({
              data: {
                orderId: order.id,
                idempotencyKey,
                requestHash,
                status: "PROCESSING",
                createdById: user.id,
                employeeId,
              },
            });

            await tx.orderStatusHistory.create({
              data: {
                orderId: order.id,
                toStatus: OrderStatus.NEW,
                changedByUserId: user.id,
                changedByEmployeeId: employeeId,
                reason: "POS order created",
              },
            });

            for (const item of dto.items) {
              const snapshot = await this.createItemSnapshot(
                tx,
                branchId,
                item,
                {
                  requireCanonical: true,
                },
              );

              await tx.orderItem.create({
                data: {
                  orderId: order.id,
                  productId: item.productId,
                  variantId: item.variantId ?? null,
                  createdById: employeeId,
                  productName: snapshot.productName,
                  variantName: snapshot.variantName ?? null,
                  quantity: snapshot.quantity,
                  unitPrice: snapshot.unitPrice,
                  totalPrice: snapshot.totalPrice,
                  modifierSnapshot: snapshot.modifiers,
                  notes: item.notes ?? null,
                },
              });
            }

            await recalculateOrderTotals(tx, order.id);
            const pricedOrder = await tx.order.findUnique({
              where: { id: order.id },
              select: { total: true },
            });

            if (!pricedOrder) {
              throw new NotFoundException("Order not found");
            }

            const cashReceived = new Prisma.Decimal(dto.cashReceived);

            if (cashReceived.lessThan(pricedOrder.total)) {
              throw new BadRequestException(
                "Received cash is less than order total",
              );
            }

            const payment = await tx.payment.create({
              data: {
                orderId: order.id,
                paymentMethodId: cashMethod.id,
                paymentOperationId: operation.id,
                operationTenderIndex: 0,
                acceptedById: employeeId,
                createdById: user.id,
                status: PaymentStatus.SUCCESS,
                amount: pricedOrder.total,
                methodCode: cashMethod.code,
                reference: "POS cash payment",
                paidAt: new Date(),
              },
            });

            await tx.revenueRecord.create({
              data: {
                branchId,
                orderId: order.id,
                paymentId: payment.id,
                shiftId: openShift.id,
                employeeId,
                source: RevenueRecordSource.ORDER,
                amount: payment.amount,
                description: "POS cash payment",
              },
            });

            await tx.cashTransaction.create({
              data: {
                branchId,
                shiftId: openShift.id,
                employeeId,
                orderId: order.id,
                paymentId: payment.id,
                type: CashTransactionType.SALE,
                amount: payment.amount,
                reason: "POS cash sale",
                createdById: user.id,
              },
            });

            await tx.order.update({
              where: { id: order.id },
              data: { paymentStatus: PaymentStatus.PAID },
            });

            const confirmed = await this.confirmOrderForPreparation(tx, {
              orderId: order.id,
              userId: user.id,
              employeeId,
              reason: "POS order accepted for kitchen",
            });

            await tx.paymentOperation.update({
              where: { id: operation.id },
              data: { status: "COMPLETED", completedAt: new Date() },
            });

            kitchenTicket = confirmed.kitchenTicket;
            return this.findOrderById(order.id, tx);
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            timeout: 15000,
          },
        );

        this.kitchenService.emitOrderCreated(order);
        this.kitchenService.emitOrderConfirmed(order);

        if (kitchenTicket) {
          this.kitchenService.emitOrderSentToKitchen(kitchenTicket);
        }

        return {
          order,
          payment: {
            method: "CASH",
            cashReceived: new Prisma.Decimal(dto.cashReceived).toFixed(2),
            change: new Prisma.Decimal(dto.cashReceived)
              .sub(order.total)
              .toFixed(2),
          },
        };
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          const existingOperation =
            await this.prisma.paymentOperation.findUnique({
              where: { idempotencyKey },
            });

          if (existingOperation) {
            const order = await this.resolveExistingPosCheckoutByKey(
              idempotencyKey,
              requestHash,
            );

            return {
              order,
              payment: {
                method: "CASH",
                cashReceived: new Prisma.Decimal(dto.cashReceived).toFixed(2),
                change: new Prisma.Decimal(dto.cashReceived)
                  .sub(order.total)
                  .toFixed(2),
              },
            };
          }

          if (attempt < 2) {
            continue;
          }
        }

        if (isRetryableTransactionConflict(error) && attempt < 2) {
          continue;
        }

        throw error;
      }
    }

    throw new BadRequestException("POS checkout could not be completed");
  }

  async createOrder(dto: CreateOrderDto, user: AuthenticatedUser) {
    const branchId = resolveRequiredBranchScope(user, dto.branchId);
    const employeeId = resolveEmployeeId(dto.employeeId, user);

    const order = await this.withUniqueConstraintRetry(() =>
      this.prisma.$transaction(async (tx) => {
        await assertBranchExists(tx, branchId);
        await assertEmployeeInBranch(tx, employeeId, branchId);

        if (dto.type === OrderType.DINE_IN && !dto.tableId) {
          throw new BadRequestException("Table is required for dine-in orders");
        }

        if (dto.tableId) {
          await assertTableInBranch(tx, dto.tableId, branchId);
        }

        const displayOrder = await allocateDisplayOrderNumber(
          tx,
          OrderSource.POS,
        );
        const order = await tx.order.create({
          data: {
            branchId,
            tableId: dto.tableId ?? null,
            orderNumber: createOrderNumber(),
            ...displayOrder,
            source: OrderSource.POS,
            type: dto.type,
            createdById: employeeId,
            waiterId: dto.type === OrderType.DINE_IN ? employeeId : null,
            customerName: dto.customerName ?? null,
            customerPhone: dto.customerPhone ?? null,
            deliveryAddress: dto.deliveryAddress ?? null,
            guestCount: dto.guestCount ?? null,
            notes: dto.notes ?? null,
            kitchenComment: dto.kitchenComment ?? null,
          },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            toStatus: OrderStatus.NEW,
            changedByUserId: user.id,
            changedByEmployeeId: employeeId,
            reason: "Order created",
          },
        });

        return this.findOrderById(order.id, tx);
      }),
    );

    this.kitchenService.emitOrderCreated(order);
    return order;
  }

  async listOrders(query: ListOrdersDto, user: AuthenticatedUser) {
    const branchId = resolveBranchScope(user, query.branchId);

    return this.prisma.order.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
      },
      orderBy: { createdAt: "desc" },
      skip: query.offset,
      take: query.limit,
      include: orderInclude(),
    });
  }

  async getOrder(id: string, user: AuthenticatedUser) {
    const order = await this.findOrderById(id, this.prisma);
    resolveBranchScope(user, order.branchId);
    return order;
  }

  async addItem(
    orderId: string,
    dto: AddOrderItemDto,
    user: AuthenticatedUser,
  ) {
    const employeeId = requireEmployee(user);

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      assertOrderCanChange(order.status);
      await assertEmployeeInBranch(tx, employeeId, order.branchId);

      const snapshot = await this.createItemSnapshot(tx, order.branchId, dto);

      await tx.orderItem.create({
        data: {
          orderId,
          productId: dto.productId,
          variantId: dto.variantId ?? null,
          createdById: employeeId,
          productName: snapshot.productName,
          variantName: snapshot.variantName ?? null,
          quantity: snapshot.quantity,
          unitPrice: snapshot.unitPrice,
          totalPrice: snapshot.totalPrice,
          modifierSnapshot: snapshot.modifiers,
          notes: dto.notes ?? null,
        },
      });

      await recalculateOrderTotals(tx, orderId);
      return this.findOrderById(orderId, tx);
    });
  }

  async updateItem(
    orderId: string,
    itemId: string,
    dto: UpdateOrderItemDto,
    user: AuthenticatedUser,
  ) {
    const employeeId = requireEmployee(user);

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      assertOrderCanChange(order.status);
      await assertEmployeeInBranch(tx, employeeId, order.branchId);

      const item = await tx.orderItem.findFirst({
        where: { id: itemId, orderId },
      });

      if (!item) {
        throw new NotFoundException("Order item not found");
      }

      const quantity = dto.quantity
        ? new Prisma.Decimal(dto.quantity)
        : item.quantity;
      const modifierSnapshot =
        dto.modifiers && item.productId
          ? await createModifierSnapshot(tx, item.productId, dto.modifiers)
          : (item.modifierSnapshot as ModifierSnapshot[] | null);
      const totalPrice = calculateItemTotal(
        item.unitPrice,
        quantity,
        modifierSnapshot ?? [],
      );
      const isCancelling = dto.status === OrderItemStatus.CANCELLED;

      const data: Prisma.OrderItemUncheckedUpdateInput = {
        totalPrice,
      };

      if (dto.quantity) {
        data.quantity = quantity;
      }

      if (dto.notes !== undefined) {
        data.notes = dto.notes;
      }

      if (dto.modifiers) {
        data.modifierSnapshot = modifierSnapshot ?? [];
      }

      if (dto.status) {
        data.status = dto.status;
      }

      if (isCancelling) {
        data.cancelledAt = new Date();
        data.cancelledById = employeeId;
        data.cancellationReason = dto.cancellationReason ?? null;
      }

      await tx.orderItem.update({
        where: { id: itemId },
        data,
      });

      await recalculateOrderTotals(tx, orderId);
      return this.findOrderById(orderId, tx);
    });
  }

  async updateStatus(
    orderId: string,
    dto: UpdateOrderStatusDto,
    user: AuthenticatedUser,
  ) {
    const employeeId = requireEmployee(user);
    const nextStatus = toStoredStatus(dto.status);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id: orderId } });

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      await assertEmployeeInBranch(tx, employeeId, order.branchId);

      if (
        order.status === OrderStatus.COMPLETED ||
        order.status === OrderStatus.CANCELLED
      ) {
        throw new BadRequestException(
          "Completed or cancelled orders cannot change status",
        );
      }

      if (nextStatus === order.status) {
        if (nextStatus === OrderStatus.CONFIRMED) {
          const confirmed = await this.confirmOrderForPreparation(tx, {
            orderId,
            userId: user.id,
            employeeId,
            reason: dto.reason ?? `POS status requested: ${dto.status}`,
          });

          return {
            kitchenTicket: confirmed.kitchenTicket,
            order: await this.findOrderById(orderId, tx),
          };
        }

        return {
          kitchenTicket: null,
          order: await this.findOrderById(orderId, tx),
        };
      }

      if (nextStatus === OrderStatus.CONFIRMED) {
        const confirmed = await this.confirmOrderForPreparation(tx, {
          orderId,
          userId: user.id,
          employeeId,
          reason: dto.reason ?? `POS status requested: ${dto.status}`,
        });

        return {
          kitchenTicket: confirmed.kitchenTicket,
          order: await this.findOrderById(orderId, tx),
        };
      }

      if (
        order.status === OrderStatus.NEW &&
        nextStatus !== OrderStatus.CANCELLED
      ) {
        throw new BadRequestException(
          "Order must be confirmed before moving to preparation or service states",
        );
      }

      const data: Prisma.OrderUpdateInput = {
        status: nextStatus,
      };

      if (nextStatus === OrderStatus.SERVED) {
        data.servedBy = { connect: { id: employeeId } };
      }

      if (nextStatus === OrderStatus.COMPLETED) {
        data.closedAt = new Date();
        data.closedBy = { connect: { id: employeeId } };
      }

      if (nextStatus === OrderStatus.CANCELLED) {
        data.cancelledAt = new Date();
        data.cancelledBy = { connect: { id: employeeId } };
        data.cancellationReason = dto.reason ?? null;
      }

      await tx.order.update({ where: { id: orderId }, data });

      await syncKitchenTickets(tx, orderId, nextStatus);

      if (
        order.tableId &&
        (nextStatus === OrderStatus.COMPLETED ||
          nextStatus === OrderStatus.CANCELLED)
      ) {
        await tx.restaurantTable.update({
          where: { id: order.tableId },
          data: { status: TableStatus.AVAILABLE },
        });
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: nextStatus,
          changedByUserId: user.id,
          changedByEmployeeId: employeeId,
          reason: dto.reason ?? `POS status requested: ${dto.status}`,
        },
      });

      return {
        kitchenTicket: null,
        order: await this.findOrderById(orderId, tx),
      };
    });

    if (nextStatus === OrderStatus.CONFIRMED) {
      this.kitchenService.emitOrderConfirmed(result.order);
    }

    if (result.kitchenTicket) {
      this.kitchenService.emitOrderSentToKitchen(result.kitchenTicket);
    }

    this.kitchenService.emitOrderStatusChanged(result.order);
    kitchenEvents.emit(kitchenOrderStatusChangedEvent, {
      orderId,
      action: "refresh",
    });
    return result.order;
  }

  async bulkUpdateStatus(
    dto: BulkUpdateOrderStatusDto,
    user: AuthenticatedUser,
  ) {
    if (!dto.confirm) {
      throw new BadRequestException("Bulk action requires confirmation");
    }

    const uniqueIds = [
      ...new Set(dto.orderIds.map((id) => id.trim()).filter(Boolean)),
    ];
    const updated: unknown[] = [];
    const failed: { id: string; message: string }[] = [];

    for (const orderId of uniqueIds) {
      try {
        updated.push(
          await this.updateStatus(
            orderId,
            {
              status: dto.status,
              reason: dto.reason ?? `Bulk action requested: ${dto.status}`,
            },
            user,
          ),
        );
      } catch (caught) {
        failed.push({
          id: orderId,
          message:
            caught instanceof Error ? caught.message : "Amal bajarilmadi",
        });
      }
    }

    return {
      requested: uniqueIds.length,
      updatedCount: updated.length,
      failedCount: failed.length,
      updated,
      failed,
    };
  }

  async confirmOrderForPreparation(
    tx: TransactionClient,
    options: ConfirmOrderForPreparationOptions,
  ) {
    await tx.$executeRaw`SELECT id FROM "orders" WHERE id = ${options.orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id: options.orderId } });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    if (
      order.status === OrderStatus.COMPLETED ||
      order.status === OrderStatus.CANCELLED
    ) {
      throw new BadRequestException(
        "Completed or cancelled orders cannot be confirmed",
      );
    }

    if (
      order.status !== OrderStatus.NEW &&
      order.status !== OrderStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        "Only new orders can be confirmed for preparation",
      );
    }

    if (order.status !== OrderStatus.CONFIRMED) {
      await tx.order.update({
        where: { id: options.orderId },
        data: {
          status: OrderStatus.CONFIRMED,
          ...(!order.acceptedAt ? { acceptedAt: new Date() } : {}),
          ...(options.employeeId && !order.acceptedById
            ? { acceptedById: options.employeeId }
            : {}),
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: options.orderId,
          fromStatus: order.status,
          toStatus: OrderStatus.CONFIRMED,
          changedByUserId: options.userId ?? null,
          changedByEmployeeId: options.employeeId ?? null,
          reason: options.reason ?? "Order confirmed for preparation",
        },
      });
    }

    await this.deductRecipeStock(
      tx,
      options.orderId,
      order.branchId,
      options.userId ?? null,
    );
    const kitchenTicket = await this.kitchenService.createTicketForOrder(
      tx,
      options.orderId,
    );

    return { kitchenTicket };
  }

  private async createItemSnapshot(
    tx: TransactionClient,
    branchId: string,
    dto: AddOrderItemDto,
    options?: { requireCanonical?: boolean },
  ) {
    const product = await tx.product.findFirst({
      where: {
        id: dto.productId,
        ...(options?.requireCanonical
          ? { code: { in: [...customerVisibleProductCodes] } }
          : {}),
        isAvailable: true,
        OR: [{ branchId }, { branchId: null }],
        ...unavailableProductWhere(branchId),
      },
      include: {
        variants: true,
      },
    });

    if (!product) {
      throw new NotFoundException("Product not found or unavailable");
    }

    const variant = dto.variantId
      ? product.variants.find(
          (candidate) =>
            candidate.id === dto.variantId && candidate.isAvailable,
        )
      : null;

    if (dto.variantId && !variant) {
      throw new NotFoundException("Product variant not found or unavailable");
    }

    const quantity = new Prisma.Decimal(dto.quantity);
    const unitPrice = variant?.sellingPrice ?? product.sellingPrice;
    const modifiers = await createModifierSnapshot(
      tx,
      product.id,
      dto.modifiers ?? [],
    );

    return {
      productName: product.name,
      variantName: variant?.name,
      quantity,
      unitPrice,
      totalPrice: calculateItemTotal(unitPrice, quantity, modifiers),
      modifiers,
    };
  }

  private async resolveExistingPosCheckout(
    tx: TransactionClient | PrismaService,
    operation: PosCheckoutOperation,
    requestHash: string,
  ) {
    if (operation.requestHash !== requestHash) {
      throw new BadRequestException(
        "Idempotency key was already used with a different POS checkout",
      );
    }

    if (operation.status !== "COMPLETED") {
      throw new BadRequestException("POS checkout is already in progress");
    }

    return this.findOrderById(operation.orderId, tx);
  }

  private async resolveExistingPosCheckoutByKey(
    idempotencyKey: string,
    requestHash: string,
  ) {
    const operation = await this.prisma.paymentOperation.findUnique({
      where: { idempotencyKey },
    });

    if (!operation) {
      throw new BadRequestException("POS checkout could not be resolved");
    }

    return this.resolveExistingPosCheckout(this.prisma, operation, requestHash);
  }

  private async withUniqueConstraintRetry<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if (isUniqueConstraintError(error) && attempt < 2) {
          continue;
        }

        throw error;
      }
    }

    throw new BadRequestException("Operation could not be completed");
  }

  private async deductRecipeStock(
    tx: TransactionClient,
    orderId: string,
    branchId: string,
    userId: string | null,
  ): Promise<void> {
    const items = await tx.orderItem.findMany({
      where: {
        orderId,
        status: OrderItemStatus.ACTIVE,
        variantId: { not: null },
      },
      include: {
        variant: {
          include: {
            recipe: {
              include: {
                items: {
                  include: {
                    ingredient: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (items.length === 0) {
      return;
    }

    const warehouse = await tx.warehouse.findFirst({
      where: { branchId, isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (!warehouse) {
      throw new BadRequestException(
        "Active warehouse is required for automatic stock deduction",
      );
    }

    for (const item of items) {
      const recipeItems = item.variant?.recipe?.items ?? [];

      for (const recipeItem of recipeItems) {
        const convertedQuantity = this.inventoryService.convertQuantity(
          recipeItem.quantity,
          recipeItem.unit,
          recipeItem.ingredient.unit,
        );

        await this.inventoryService.applyStockMovement(tx, {
          ingredientId: recipeItem.ingredientId,
          warehouseId: warehouse.id,
          type: StockMovementType.OUT,
          quantity: convertedQuantity.mul(item.quantity),
          reason: `Recipe deduction for order item ${item.id}`,
          createdById: userId,
          orderItemId: item.id,
          sourceType: "ORDER_ITEM_RECIPE",
          sourceId: orderId,
          sourceItemId: item.id,
        });
      }

      if (recipeItems.length > 0) {
        await tx.orderItem.update({
          where: { id: item.id },
          data: { stockDeductedAt: new Date() },
        });
      }
    }
  }

  private async findOrderById(
    id: string,
    client: TransactionClient | PrismaService,
  ) {
    const order = await client.order.findUnique({
      where: { id },
      include: orderInclude(),
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return order;
  }
}
