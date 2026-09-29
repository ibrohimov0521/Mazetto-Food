import {
  KitchenTicketStatus,
  OrderItemStatus,
  StockMovementType,
  Prisma,
} from "@prisma/client";
import type { InventoryService } from "../inventory/inventory.service";

type TransactionClient = Prisma.TransactionClient;

type RestoreContext = {
  orderId: string;
  actorId: string;
  reason: string;
};

export async function restoreUnstartedOrderItemStock(
  tx: TransactionClient,
  inventory: InventoryService,
  context: RestoreContext & { orderItemId: string },
): Promise<number> {
  const kitchenItems = await tx.kitchenTicketItem.findMany({
    where: {
      orderItemId: context.orderItemId,
      status: OrderItemStatus.ACTIVE,
    },
    select: { ticket: { select: { status: true } } },
  });

  if (
    kitchenItems.length === 0 ||
    kitchenItems.some(
      (item) => item.ticket.status !== KitchenTicketStatus.NEW,
    )
  ) {
    return 0;
  }

  const deductions = await tx.stockMovement.findMany({
    where: {
      orderItemId: context.orderItemId,
      sourceId: context.orderId,
      sourceType: "ORDER_ITEM_RECIPE",
      type: StockMovementType.OUT,
    },
    select: {
      id: true,
      ingredientId: true,
      warehouseId: true,
      quantity: true,
    },
  });

  for (const deduction of deductions) {
    await inventory.applyStockMovement(tx, {
      ingredientId: deduction.ingredientId,
      warehouseId: deduction.warehouseId,
      type: StockMovementType.IN,
      quantity: deduction.quantity.abs(),
      reason: `Unstarted order item cancellation: ${context.reason}`,
      createdById: context.actorId,
      orderItemId: context.orderItemId,
      sourceType: "ORDER_ITEM_RECIPE_RESTOCK",
      sourceId: context.orderId,
      sourceItemId: deduction.id,
    });
  }

  return deductions.length;
}

export async function restoreUnstartedOrderStock(
  tx: TransactionClient,
  inventory: InventoryService,
  context: RestoreContext,
): Promise<number> {
  const items = await tx.orderItem.findMany({
    where: {
      orderId: context.orderId,
      status: OrderItemStatus.ACTIVE,
      stockDeductedAt: { not: null },
    },
    select: { id: true },
  });

  let restoredMovements = 0;
  for (const item of items) {
    restoredMovements += await restoreUnstartedOrderItemStock(
      tx,
      inventory,
      { ...context, orderItemId: item.id },
    );
  }

  return restoredMovements;
}
