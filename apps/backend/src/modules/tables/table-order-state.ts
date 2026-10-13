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
  const locked = await tx.$queryRawUnsafe<{ id: string }[]>(
    'SELECT "id" FROM "restaurant_tables" WHERE "id" = $1 FOR UPDATE',
    tableId,
  );
  if (locked.length !== 1) return;

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
