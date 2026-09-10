import {
  KitchenTicketStatus,
  OrderStatus,
  OrderType,
  Prisma,
} from "@prisma/client";

export function orderStatusAfterKitchenHandoff(type: OrderType): OrderStatus {
  return type === OrderType.TAKEAWAY ? OrderStatus.SERVED : OrderStatus.READY;
}

export function kitchenStatusForOrder(
  status: OrderStatus,
): KitchenTicketStatus | null {
  switch (status) {
    case OrderStatus.CONFIRMED:
      return KitchenTicketStatus.ACCEPTED;
    case OrderStatus.PREPARING:
      return KitchenTicketStatus.COOKING;
    case OrderStatus.READY:
      return KitchenTicketStatus.READY;
    case OrderStatus.SERVED:
    case OrderStatus.COMPLETED:
      return KitchenTicketStatus.COMPLETED;
    case OrderStatus.CANCELLED:
      return KitchenTicketStatus.CANCELLED;
    default:
      return null;
  }
}

export async function syncKitchenTickets(
  tx: Prisma.TransactionClient,
  orderId: string,
  status: OrderStatus,
) {
  const next = kitchenStatusForOrder(status);
  if (!next) return;
  await tx.kitchenTicket.updateMany({
    where: {
      orderId,
      status: {
        notIn: [KitchenTicketStatus.COMPLETED, KitchenTicketStatus.CANCELLED],
      },
    },
    data: {
      status: next,
      ...([
        KitchenTicketStatus.COMPLETED,
        KitchenTicketStatus.CANCELLED,
      ].includes(next as "COMPLETED" | "CANCELLED")
        ? { completedAt: new Date() }
        : {}),
    },
  });
}
