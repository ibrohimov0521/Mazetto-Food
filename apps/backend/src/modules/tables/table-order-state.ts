import { OrderStatus, Prisma, TableStatus } from "@prisma/client";

export const activeTableOrderStatuses: OrderStatus[] = [
  OrderStatus.NEW,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.SERVED,
];

export async function releaseTableIfNoActiveOrders(
  tx: Prisma.TransactionClient,
  tableId: string,
): Promise<void> {
  const activeOrders = await tx.order.count({
    where: { tableId, status: { in: activeTableOrderStatuses } },
  });

  if (activeOrders === 0) {
    await tx.restaurantTable.update({
      where: { id: tableId },
      data: { status: TableStatus.AVAILABLE },
    });
  }
}
