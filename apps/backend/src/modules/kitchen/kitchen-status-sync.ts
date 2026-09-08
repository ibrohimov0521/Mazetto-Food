import { KitchenTicketStatus, OrderStatus, Prisma } from "@prisma/client";

export function kitchenStatusForOrder(status: OrderStatus): KitchenTicketStatus | null {
  switch (status) {
    case OrderStatus.PREPARING: return KitchenTicketStatus.COOKING;
    case OrderStatus.READY: return KitchenTicketStatus.READY;
    case OrderStatus.SERVED:
    case OrderStatus.COMPLETED: return KitchenTicketStatus.COMPLETED;
    case OrderStatus.CANCELLED: return KitchenTicketStatus.CANCELLED;
    default: return null;
  }
}

export async function syncKitchenTickets(tx: Prisma.TransactionClient, orderId: string, status: OrderStatus) {
  const next = kitchenStatusForOrder(status);
  if (!next) return;
  await tx.kitchenTicket.updateMany({
    where: { orderId, status: { notIn: [KitchenTicketStatus.COMPLETED, KitchenTicketStatus.CANCELLED] } },
    data: {
      status: next,
      ...([KitchenTicketStatus.COMPLETED, KitchenTicketStatus.CANCELLED].includes(next as "COMPLETED" | "CANCELLED")
        ? { completedAt: new Date() } : {}),
    },
  });
}
