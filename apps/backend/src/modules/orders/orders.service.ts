import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  OrderItemStatus,
  OrderSource,
  OrderStatus,
  OrderType,
  Prisma,
  StockMovementType,
  TableStatus,
} from "@prisma/client";
import { randomInt } from "node:crypto";
import { resolveBranchScope, resolveRequiredBranchScope } from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { KitchenService } from "../kitchen/kitchen.service";
import type { CreateOrderDto } from "./dto/create-order.dto";
import type { ListOrdersDto } from "./dto/list-orders.dto";
import type { AddOrderItemDto, OrderItemModifierDto, UpdateOrderItemDto } from "./dto/order-item.dto";
import { PosOrderStatus, type UpdateOrderStatusDto } from "./dto/order-status.dto";

type TransactionClient = Prisma.TransactionClient;
type ConfirmOrderForPreparationOptions = {
  orderId: string;
  userId?: string | null;
  employeeId?: string | null;
  reason?: string | null;
};

type ModifierSnapshot = {
  id: string;
  code: string;
  name: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly kitchenService: KitchenService,
  ) {}

  async createOrder(dto: CreateOrderDto, user: AuthenticatedUser) {
    const branchId = resolveRequiredBranchScope(user, dto.branchId);
    const employeeId = this.resolveEmployeeId(dto.employeeId, user);

    const order = await this.prisma.$transaction(async (tx) => {
      await this.assertBranchExists(tx, branchId);
      await this.assertEmployeeInBranch(tx, employeeId, branchId);

      if (dto.type === OrderType.DINE_IN && !dto.tableId) {
        throw new BadRequestException("Table is required for dine-in orders");
      }

      if (dto.tableId) {
        await this.assertTableInBranch(tx, dto.tableId, branchId);
      }

      const order = await tx.order.create({
        data: {
          branchId,
          tableId: dto.tableId ?? null,
          orderNumber: this.createOrderNumber(),
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
    });

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
      include: this.orderInclude(),
    });
  }

  async getOrder(id: string, user: AuthenticatedUser) {
    const order = await this.findOrderById(id, this.prisma);
    resolveBranchScope(user, order.branchId);
    return order;
  }

  async addItem(orderId: string, dto: AddOrderItemDto, user: AuthenticatedUser) {
    const employeeId = this.requireEmployee(user);

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      this.assertOrderCanChange(order.status);
      await this.assertEmployeeInBranch(tx, employeeId, order.branchId);

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

      await this.recalculateOrderTotals(tx, orderId);
      return this.findOrderById(orderId, tx);
    });
  }

  async updateItem(
    orderId: string,
    itemId: string,
    dto: UpdateOrderItemDto,
    user: AuthenticatedUser,
  ) {
    const employeeId = this.requireEmployee(user);

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      this.assertOrderCanChange(order.status);
      await this.assertEmployeeInBranch(tx, employeeId, order.branchId);

      const item = await tx.orderItem.findFirst({ where: { id: itemId, orderId } });

      if (!item) {
        throw new NotFoundException("Order item not found");
      }

      const quantity = dto.quantity ? new Prisma.Decimal(dto.quantity) : item.quantity;
      const modifierSnapshot =
        dto.modifiers && item.productId
          ? await this.createModifierSnapshot(tx, item.productId, dto.modifiers)
          : (item.modifierSnapshot as ModifierSnapshot[] | null);
      const totalPrice = this.calculateItemTotal(item.unitPrice, quantity, modifierSnapshot ?? []);
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

      await this.recalculateOrderTotals(tx, orderId);
      return this.findOrderById(orderId, tx);
    });
  }

  async updateStatus(orderId: string, dto: UpdateOrderStatusDto, user: AuthenticatedUser) {
    const employeeId = this.requireEmployee(user);
    const nextStatus = this.toStoredStatus(dto.status);

    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      await this.assertEmployeeInBranch(tx, employeeId, order.branchId);

      if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException("Completed or cancelled orders cannot change status");
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

        return { kitchenTicket: null, order: await this.findOrderById(orderId, tx) };
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

      if (order.status === OrderStatus.NEW && nextStatus !== OrderStatus.CANCELLED) {
        throw new BadRequestException("Order must be confirmed before moving to preparation or service states");
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

      if (
        order.tableId &&
        (nextStatus === OrderStatus.COMPLETED || nextStatus === OrderStatus.CANCELLED)
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
    return result.order;
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

    if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException("Completed or cancelled orders cannot be confirmed");
    }

    if (order.status !== OrderStatus.NEW && order.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestException("Only new orders can be confirmed for preparation");
    }

    if (order.status !== OrderStatus.CONFIRMED) {
      await tx.order.update({
        where: { id: options.orderId },
        data: {
          status: OrderStatus.CONFIRMED,
          ...(!order.acceptedAt ? { acceptedAt: new Date() } : {}),
          ...(options.employeeId && !order.acceptedById ? { acceptedById: options.employeeId } : {}),
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

    await this.deductRecipeStock(tx, options.orderId, order.branchId, options.userId ?? null);
    const kitchenTicket = await this.kitchenService.createTicketForOrder(tx, options.orderId);

    return { kitchenTicket };
  }

  private async createItemSnapshot(
    tx: TransactionClient,
    branchId: string,
    dto: AddOrderItemDto,
  ) {
    const product = await tx.product.findFirst({
      where: {
        id: dto.productId,
        isAvailable: true,
        OR: [{ branchId }, { branchId: null }],
      },
      include: {
        variants: true,
      },
    });

    if (!product) {
      throw new NotFoundException("Product not found or unavailable");
    }

    const variant = dto.variantId
      ? product.variants.find((candidate) => candidate.id === dto.variantId && candidate.isAvailable)
      : null;

    if (dto.variantId && !variant) {
      throw new NotFoundException("Product variant not found or unavailable");
    }

    const quantity = new Prisma.Decimal(dto.quantity);
    const unitPrice = variant?.sellingPrice ?? product.sellingPrice;
    const modifiers = await this.createModifierSnapshot(tx, product.id, dto.modifiers ?? []);

    return {
      productName: product.name,
      variantName: variant?.name,
      quantity,
      unitPrice,
      totalPrice: this.calculateItemTotal(unitPrice, quantity, modifiers),
      modifiers,
    };
  }

  private async createModifierSnapshot(
    tx: TransactionClient,
    productId: string,
    modifiers: OrderItemModifierDto[],
  ): Promise<ModifierSnapshot[]> {
    if (modifiers.length === 0) {
      return [];
    }

    const modifierIds = [...new Set(modifiers.map((modifier) => modifier.modifierId))];
    const productModifiers = await tx.productModifier.findMany({
      where: {
        productId,
        modifierId: { in: modifierIds },
        modifier: { isActive: true },
      },
      include: { modifier: true },
    });

    if (productModifiers.length !== modifierIds.length) {
      throw new BadRequestException("One or more modifiers are not available for this product");
    }

    return modifiers.map((selected) => {
      const productModifier = productModifiers.find(
        (candidate) => candidate.modifierId === selected.modifierId,
      );

      if (!productModifier) {
        throw new BadRequestException("Modifier is not available for this product");
      }

      const quantity = new Prisma.Decimal(selected.quantity ?? 1);
      const totalPrice = productModifier.modifier.price.mul(quantity);

      return {
        id: productModifier.modifier.id,
        code: productModifier.modifier.code,
        name: productModifier.modifier.name,
        quantity: quantity.toFixed(3),
        unitPrice: productModifier.modifier.price.toFixed(2),
        totalPrice: totalPrice.toFixed(2),
      };
    });
  }

  private calculateItemTotal(
    unitPrice: Prisma.Decimal,
    quantity: Prisma.Decimal,
    modifiers: ModifierSnapshot[],
  ) {
    const modifierTotal = modifiers.reduce(
      (total, modifier) => total.add(new Prisma.Decimal(modifier.totalPrice)),
      new Prisma.Decimal(0),
    );

    return unitPrice.add(modifierTotal).mul(quantity);
  }

  private async recalculateOrderTotals(tx: TransactionClient, orderId: string): Promise<void> {
    const items = await tx.orderItem.findMany({
      where: {
        orderId,
        status: OrderItemStatus.ACTIVE,
      },
      select: { totalPrice: true },
    });
    const subtotal = items.reduce(
      (total, item) => total.add(item.totalPrice),
      new Prisma.Decimal(0),
    );
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        discountTotal: true,
        serviceFeeTotal: true,
        deliveryFeeTotal: true,
      },
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    const total = subtotal
      .sub(order.discountTotal)
      .add(order.serviceFeeTotal)
      .add(order.deliveryFeeTotal);

    await tx.order.update({
      where: { id: orderId },
      data: {
        subtotal,
        total,
      },
    });
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
      throw new BadRequestException("Active warehouse is required for automatic stock deduction");
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

  private async findOrderById(id: string, client: TransactionClient | PrismaService) {
    const order = await client.order.findUnique({
      where: { id },
      include: this.orderInclude(),
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return order;
  }

  private orderInclude() {
    return {
      branch: { select: { id: true, code: true, name: true } },
      table: { select: { id: true, code: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      acceptedBy: { select: { id: true, firstName: true, lastName: true } },
      closedBy: { select: { id: true, firstName: true, lastName: true } },
      items: {
        orderBy: { createdAt: "asc" },
      },
      payments: {
        orderBy: { createdAt: "asc" },
        include: {
          method: { select: { id: true, code: true, name: true } },
        },
      },
      statusHistory: {
        orderBy: { createdAt: "asc" },
      },
    } satisfies Prisma.OrderInclude;
  }

  private resolveEmployeeId(dtoEmployeeId: string | undefined, user: AuthenticatedUser): string {
    const employeeId = dtoEmployeeId ?? user.employeeId;

    if (!employeeId) {
      throw new ForbiddenException("Authenticated user is not linked to an employee");
    }

    return employeeId;
  }

  private requireEmployee(user: AuthenticatedUser): string {
    if (!user.employeeId) {
      throw new ForbiddenException("Authenticated user is not linked to an employee");
    }

    return user.employeeId;
  }

  private async assertBranchExists(tx: TransactionClient, branchId: string): Promise<void> {
    const branch = await tx.branch.findFirst({ where: { id: branchId, isActive: true } });

    if (!branch) {
      throw new NotFoundException("Branch not found");
    }
  }

  private async assertEmployeeInBranch(
    tx: TransactionClient,
    employeeId: string,
    branchId: string,
  ): Promise<void> {
    const employee = await tx.employee.findFirst({
      where: { id: employeeId, branchId, status: "ACTIVE" },
    });

    if (!employee) {
      throw new ForbiddenException("Employee is not active in this branch");
    }
  }

  private async assertTableInBranch(
    tx: TransactionClient,
    tableId: string,
    branchId: string,
  ): Promise<void> {
    const table = await tx.restaurantTable.findFirst({
      where: { id: tableId, branchId, isActive: true },
    });

    if (!table) {
      throw new NotFoundException("Table not found");
    }
  }

  private assertOrderCanChange(status: OrderStatus): void {
    if (status === OrderStatus.COMPLETED || status === OrderStatus.CANCELLED) {
      throw new BadRequestException("Completed or cancelled orders cannot be changed");
    }
  }

  private toStoredStatus(status: PosOrderStatus): OrderStatus {
    const statusMap: Record<PosOrderStatus, OrderStatus> = {
      [PosOrderStatus.NEW]: OrderStatus.NEW,
      [PosOrderStatus.CONFIRMED]: OrderStatus.CONFIRMED,
      [PosOrderStatus.PREPARING]: OrderStatus.PREPARING,
      [PosOrderStatus.READY]: OrderStatus.READY,
      [PosOrderStatus.SERVED]: OrderStatus.SERVED,
      [PosOrderStatus.COMPLETED]: OrderStatus.COMPLETED,
      [PosOrderStatus.CANCELLED]: OrderStatus.CANCELLED,
    };

    return statusMap[status];
  }

  private createOrderNumber(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replaceAll("-", "");
    const time = now.toISOString().slice(11, 19).replaceAll(":", "");

    return `POS-${date}-${time}-${randomInt(1000, 10000)}`;
  }
}
