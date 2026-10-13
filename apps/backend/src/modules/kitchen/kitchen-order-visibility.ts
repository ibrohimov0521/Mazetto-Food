import { OrderSource, Prisma } from "@prisma/client";

export function kitchenPosOrderVisibilityWhere(
  showPosOrders: boolean,
): Prisma.OrderWhereInput {
  return showPosOrders
    ? {}
    : {
        NOT: {
          source: OrderSource.POS,
        },
      };
}

export function isKitchenPosOrder(order: { source: OrderSource }): boolean {
  return order.source === OrderSource.POS;
}
