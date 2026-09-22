import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { orderStatusLabel } from "../../common/utils/order-status-label";
import { PrismaService } from "../../prisma/prisma.service";
import {
  customerCallbackPrefix,
  escapeHtml,
  formatMoney,
  type LinkedCustomer,
} from "./telegram-customer-presentation";
import {
  TelegramCustomerScreenService,
  type CustomerScreenTarget,
} from "./telegram-customer-screen.service";
import { TelegramCartService } from "./telegram-cart.service";

/** Customer-facing order history and safe repeat-order flow. */
@Injectable()
export class TelegramCustomerOrderHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: TelegramCartService,
    private readonly screen: TelegramCustomerScreenService,
  ) {}

  async sendOrders(
    target: CustomerScreenTarget,
    customer: LinkedCustomer,
  ): Promise<void> {
    const orders = await this.prisma.customerOrder.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        branch: { select: { name: true } },
        order: {
          select: {
            orderNumber: true,
            displayOrderNumber: true,
            status: true,
            total: true,
          },
        },
      },
    });

    await this.screen.renderCustomerScreen(target, {
      text: orders.length
        ? [
            "📦 <b>Buyurtmalaringiz</b>",
            "",
            ...orders.map((order) =>
              [
                `<b>${escapeHtml(order.order.displayOrderNumber ?? order.order.orderNumber)}</b>`,
                `${escapeHtml(order.branch.name)} · ${orderStatusLabel(order.order.status, order.type)}`,
                `Jami: ${formatMoney(order.order.total)}`,
              ].join("\n"),
            ),
          ].join("\n\n")
        : "Hali buyurtmalaringiz yo'q. Menyudan taom tanlab buyurtma berishingiz mumkin.",
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          ...orders.map((order) => [
            {
              text: `📄 ${order.order.displayOrderNumber ?? order.order.orderNumber}`,
              callback_data: `${customerCallbackPrefix}:order:detail:${order.id}`,
            },
          ]),
          [{ text: "🍽 Menyu", callback_data: `${customerCallbackPrefix}:menu` }],
          [{ text: "🏠 Bosh menyu", callback_data: `${customerCallbackPrefix}:home` }],
        ],
      },
    });
  }

  async sendOrderDetail(
    target: CustomerScreenTarget,
    customer: LinkedCustomer,
    customerOrderId: string,
  ): Promise<void> {
    const customerOrder = await this.prisma.customerOrder.findFirst({
      where: { id: customerOrderId, customerId: customer.id },
      include: {
        branch: { select: { name: true } },
        order: { include: { items: { orderBy: { createdAt: "asc" } } } },
      },
    });
    if (!customerOrder) {
      await this.sendOrders(target, customer);
      return;
    }

    const order = customerOrder.order;
    await this.screen.renderCustomerScreen(target, {
      text: [
        `📄 <b>${escapeHtml(order.displayOrderNumber ?? order.orderNumber)}</b>`,
        `${escapeHtml(customerOrder.branch.name)} · ${orderStatusLabel(order.status, customerOrder.type)}`,
        "",
        ...order.items.map(
          (item) =>
            `${Number(item.quantity)}x ${escapeHtml(item.productName)}${item.variantName ? ` · ${escapeHtml(item.variantName)}` : ""}`,
        ),
        "",
        `<b>Jami: ${formatMoney(order.total)}</b>`,
      ].join("\n"),
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔁 Savatga qayta qo'shish", callback_data: `${customerCallbackPrefix}:order:repeat:${customerOrder.id}` }],
          [{ text: "⬅️ Buyurtmalarim", callback_data: `${customerCallbackPrefix}:orders` }],
          [{ text: "🏠 Bosh menyu", callback_data: `${customerCallbackPrefix}:home` }],
        ],
      },
    });
  }

  async repeatOrder(
    target: CustomerScreenTarget,
    customer: LinkedCustomer,
    customerOrderId: string,
  ): Promise<void> {
    const customerOrder = await this.prisma.customerOrder.findFirst({
      where: { id: customerOrderId, customerId: customer.id },
      include: {
        order: {
          include: {
            items: {
              where: { status: "ACTIVE" },
              include: {
                product: { select: { id: true, isAvailable: true } },
                variant: { select: { id: true, isAvailable: true } },
              },
            },
          },
        },
      },
    });
    if (!customerOrder) {
      await this.sendOrders(target, customer);
      return;
    }

    const availableItems = customerOrder.order.items.filter(
      (item) =>
        item.product?.isAvailable &&
        (!item.variantId || item.variant?.isAvailable),
    );
    if (!availableItems.length) {
      await this.screen.renderCustomerScreen(target, {
        text: "Bu buyurtmadagi mahsulotlar hozir mavjud emas. Menyudan yangisini tanlang.",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🍽 Menyu", callback_data: `${customerCallbackPrefix}:menu` }],
            [{ text: "⬅️ Buyurtmalarim", callback_data: `${customerCallbackPrefix}:orders` }],
          ],
        },
      });
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await this.cart.lockTelegramCart(tx, customer.id);
      const cart = await this.cart.getOrCreateCartForTransaction(tx, customer.id);
      for (const item of availableItems) {
        await this.cart.lockCartLine(tx, cart.id, item.productId!, item.variantId);
        await tx.cartItem.create({
          data: {
            cartId: cart.id,
            productId: item.productId!,
            variantId: item.variantId,
            quantity: item.quantity,
            modifierSnapshot: item.modifierSnapshot ?? Prisma.JsonNull,
            notes: item.notes,
          },
        });
      }
    });

    const skipped = customerOrder.order.items.length - availableItems.length;
    if (skipped) {
      await this.screen.renderCustomerScreen(target, {
        text: `${availableItems.length} ta mahsulot savatga qo'shildi. ${skipped} tasi hozir mavjud emas.`,
        reply_markup: {
          inline_keyboard: [
            [{ text: "🛒 Savatni ko'rish", callback_data: `${customerCallbackPrefix}:cart` }],
            [{ text: "🍽 Menyu", callback_data: `${customerCallbackPrefix}:menu` }],
          ],
        },
      });
      return;
    }

    await this.cart.sendCart(target, customer);
  }
}
