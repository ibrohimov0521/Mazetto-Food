import { Injectable, Logger } from "@nestjs/common";
import { orderStatusLabel as sharedOrderStatusLabel } from "../../common/utils/order-status-label";
import { CustomerOrderType, OrderSource, Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { CustomerOrderEngineService } from "../customers/customer-order-engine.service";
import {
  OnlineOrderTypeDto,
  OnlinePaymentMethodDto,
} from "../customers/dto/customer.dto";
import { TelegramCartService } from "./telegram-cart.service";
import { TelegramCheckoutSessionService } from "./telegram-checkout-session.service";
import { TelegramOrderNotificationService } from "./telegram-order-notification.service";
import {
  customerCallbackPrefix,
  branchSupportsType,
  cleanAddress,
  escapeHtml,
  formatMoney,
  parseCustomerOrderType,
  readCartModifiers,
  type LinkedCustomer,
} from "./telegram-customer-presentation";
import {
  TelegramCustomerScreenService,
  type CustomerScreenTarget,
} from "./telegram-customer-screen.service";

/*
 * Telegram checkout OQIMI: buyurtma turi -> manzil -> izoh -> xulosa ->
 * tasdiqlash.
 *
 * NIMA UCHUN AJRATILDI. Bu 440 qator bitta ketma-ketlikni tashkil qiladi
 * va menyu ko'rish, savatga qo'shish, profil ko'rish bilan hech qanday
 * umumiy holati yo'q. U buyurtma servisi ichida turganda ikki ming
 * qatorlik faylning yarmini egallardi.
 *
 * Ajratish faqat quyidagi uchta qatlam CHIQARILGANDAN KEYIN mumkin
 * bo'ldi: ekran, sessiya va savat. Ulargacha bu oqim buyurtma servisining
 * metodlariga bog'liq edi va ajratish halqa yaratardi.
 *
 * Bog'liqlik yo'nalishi bir tomonlama: buyurtma -> checkout -> (ekran,
 * sessiya, savat, buyurtma dvigateli).
 */

type TelegramCartForCheckout = {
  id: string;
  updatedAt: Date;
  items: Array<{
    id: string;
    productId: string;
    variantId: string | null;
    quantity: Prisma.Decimal;
    modifierSnapshot: Prisma.JsonValue | null;
    notes: string | null;
    createdAt?: Date;
    updatedAt?: Date;
  }>;
};

type TelegramCheckoutSessionForKey = {
  branchId: string | null;
  orderType: CustomerOrderType | null;
  address: string | null;
  note: string | null;
};

@Injectable()
export class TelegramCheckoutService {
  private readonly logger = new Logger(TelegramCheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly customerOrderEngine: CustomerOrderEngineService,
    private readonly telegramOrderNotificationService: TelegramOrderNotificationService,
    private readonly screen: TelegramCustomerScreenService,
    private readonly checkoutSession: TelegramCheckoutSessionService,
    private readonly cart: TelegramCartService,
  ) {}

  async startCheckout(
    target: CustomerScreenTarget,
    customer: LinkedCustomer,
  ): Promise<void> {
    const cart = await this.cart.getCartWithItems(customer.id);

    if (!cart?.items.length) {
      await this.cart.sendCart(target, customer);
      return;
    }

    const branches = await this.checkoutSession.availableBranches();

    if (!branches.length) {
      await this.screen.renderCustomerScreen(target, {
        text: "Hozir buyurtma qabul qiladigan filial topilmadi.",
      });
      return;
    }

    const branch = branches[0]!;
    await this.checkoutSession.upsertCheckoutSession(
      customer.id,
      target.chatId,
      {
        branchId: branch.id,
        step: "ORDER_TYPE",
        orderType: null,
        address: null,
        note: null,
      },
    );

    const typeButtons = this.checkoutSession.orderTypeButtons(branch);

    if (!typeButtons.length) {
      await this.screen.renderCustomerScreen(target, {
        text: "Tanlangan filial hozir buyurtma turi qabul qilmayapti.",
      });
      return;
    }

    await this.screen.renderCustomerScreen(target, {
      text: [
        "✅ <b>Buyurtma turi</b>",
        "",
        `Filial: <b>${escapeHtml(branch.name)}</b>`,
        "",
        "Qanday buyurtma berasiz?",
      ].join("\n"),
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          ...typeButtons,
          [
            {
              text: "⬅️ Savatga qaytish",
              callback_data: `${customerCallbackPrefix}:cart`,
            },
          ],
          [
            {
              text: "🏠 Bosh menyu",
              callback_data: `${customerCallbackPrefix}:home`,
            },
          ],
        ],
      },
    });
  }

  async selectOrderType(
    target: CustomerScreenTarget,
    customer: LinkedCustomer,
    rawType: string,
  ): Promise<void> {
    const orderType = parseCustomerOrderType(rawType);
    const session = await this.checkoutSession.getActiveCheckoutSession(
      customer.id,
      target.chatId,
    );
    const branch = session?.branchId
      ? await this.checkoutSession.findBranchForCheckout(session.branchId)
      : await this.checkoutSession.defaultBranchForType(orderType);

    if (!branch) {
      await this.screen.renderCustomerScreen(target, {
        text: "Hozir bu buyurtma turi uchun ochiq filial topilmadi.",
      });
      return;
    }

    if (!branchSupportsType(branch, orderType)) {
      await this.screen.renderCustomerScreen(target, {
        text:
          orderType === CustomerOrderType.DELIVERY
            ? "Bu filialda yetkazib berish hozir mavjud emas."
            : "Bu filialdan olib ketish hozir mavjud emas.",
      });
      await this.startCheckout(target, customer);
      return;
    }

    if (orderType === CustomerOrderType.DELIVERY) {
      await this.checkoutSession.upsertCheckoutSession(
        customer.id,
        target.chatId,
        {
          branchId: branch.id,
          orderType,
          step: "ADDRESS",
          address: null,
          note: null,
        },
      );
      await this.askDeliveryAddress(target, branch);
      return;
    }

    await this.checkoutSession.upsertCheckoutSession(
      customer.id,
      target.chatId,
      {
        branchId: branch.id,
        orderType,
        step: "SUMMARY",
        address: null,
        note: null,
      },
    );
    await this.sendCheckoutSummary(target, customer);
  }

  async askDeliveryAddress(
    target: CustomerScreenTarget,
    branch: { name: string },
  ): Promise<void> {
    await this.screen.renderCustomerScreen(target, {
      text: [
        "🚚 <b>Yetkazib berish manzili</b>",
        "",
        `Filial: <b>${escapeHtml(branch.name)}</b>`,
        "",
        "Manzilingizni yuboring. Masalan: Sergeli 7, 12-uy, 3-podyezd, mo'ljal - maktab yonida.",
      ].join("\n"),
      parse_mode: "HTML",
      reply_markup: {
        keyboard: [["⬅️ Orqaga", "🏠 Bosh menyu"]],
        resize_keyboard: true,
      },
    });
  }

  async acceptDeliveryAddress(
    chatId: string,
    customer: LinkedCustomer,
    address: string,
  ): Promise<void> {
    const normalizedAddress = cleanAddress(address);

    if (!normalizedAddress) {
      await this.screen.telegramRequest("sendMessage", {
        chat_id: chatId,
        text: "Manzil juda qisqa yoki bo'sh. Iltimos, ko'cha, uy va mo'ljalni yozing.",
      });
      return;
    }

    await this.checkoutSession.upsertCheckoutSession(customer.id, chatId, {
      step: "NOTE",
      address: normalizedAddress,
    });

    await this.screen.telegramRequest("sendMessage", {
      chat_id: chatId,
      text: [
        "Manzil qabul qilindi.",
        "",
        "Kur'er uchun izoh qo'shasizmi?",
      ].join("\n"),
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Izoh qo'shish",
              callback_data: `${customerCallbackPrefix}:note:add`,
            },
          ],
          [
            {
              text: "O'tkazib yuborish",
              callback_data: `${customerCallbackPrefix}:note:skip`,
            },
          ],
          [
            {
              text: "⬅️ Orqaga",
              callback_data: `${customerCallbackPrefix}:type:DELIVERY`,
            },
          ],
          [
            {
              text: "🏠 Bosh menyu",
              callback_data: `${customerCallbackPrefix}:home`,
            },
          ],
        ],
      },
    });
  }

  async handleNoteChoice(
    target: CustomerScreenTarget,
    customer: LinkedCustomer,
    choice: string,
  ): Promise<void> {
    if (choice === "skip") {
      await this.checkoutSession.upsertCheckoutSession(
        customer.id,
        target.chatId,
        {
          step: "SUMMARY",
          note: null,
        },
      );
      await this.sendCheckoutSummary(target, customer);
      return;
    }

    if (choice === "add") {
      await this.checkoutSession.upsertCheckoutSession(
        customer.id,
        target.chatId,
        {
          step: "NOTE",
        },
      );
      await this.screen.renderCustomerScreen(target, {
        text: "Kur'er uchun izohni yuboring. Masalan: Qo'ng'iroq qilmang, eshik oldiga qoldiring.",
        reply_markup: {
          keyboard: [["⬅️ Orqaga", "🏠 Bosh menyu"]],
          resize_keyboard: true,
        },
      });
    }
  }

  async acceptDeliveryNote(
    chatId: string,
    customer: LinkedCustomer,
    note: string,
  ): Promise<void> {
    const cleanNote = note.trim();

    if (!cleanNote) {
      await this.screen.telegramRequest("sendMessage", {
        chat_id: chatId,
        text: "Izoh bo'sh bo'lmasin yoki O'tkazib yuborish tugmasini bosing.",
      });
      return;
    }

    await this.checkoutSession.upsertCheckoutSession(customer.id, chatId, {
      step: "SUMMARY",
      note: cleanNote.slice(0, 1000),
    });
    await this.sendCheckoutSummary({ chatId }, customer);
  }

  private async sendCheckoutSummary(
    target: CustomerScreenTarget,
    customer: LinkedCustomer,
  ): Promise<void> {
    const cart = await this.cart.getCartWithItems(customer.id);

    if (!cart?.items.length) {
      await this.cart.sendCart(target, customer);
      return;
    }

    const session = await this.checkoutSession.getActiveCheckoutSession(
      customer.id,
      target.chatId,
    );
    const branch = session?.branchId
      ? await this.checkoutSession.findBranchForCheckout(session.branchId)
      : null;
    const orderType = session?.orderType;

    if (!session || !branch || !orderType) {
      await this.startCheckout(target, customer);
      return;
    }

    if (!branchSupportsType(branch, orderType)) {
      await this.screen.renderCustomerScreen(target, {
        text: "Tanlangan filial yoki buyurtma turi hozir mavjud emas. Iltimos, qayta tanlang.",
      });
      await this.startCheckout(target, customer);
      return;
    }

    if (
      orderType === CustomerOrderType.DELIVERY &&
      !cleanAddress(session.address ?? "")
    ) {
      await this.checkoutSession.upsertCheckoutSession(
        customer.id,
        target.chatId,
        { step: "ADDRESS" },
      );
      await this.askDeliveryAddress(target, branch);
      return;
    }

    await this.checkoutSession.upsertCheckoutSession(
      customer.id,
      target.chatId,
      { step: "SUMMARY" },
    );
    const totals = await this.cart.calculateCartTotals(cart.items);
    const quote = await this.customerOrderEngine.quoteCheckout(customer.id, {
      branchId: branch.id,
      type:
        orderType === CustomerOrderType.DELIVERY
          ? OnlineOrderTypeDto.DELIVERY
          : OnlineOrderTypeDto.PICKUP,
      items: cart.items.map((item) => ({
        productId: item.productId,
        ...(item.variantId ? { variantId: item.variantId } : {}),
        quantity: Number(item.quantity),
        modifiers: readCartModifiers(item.modifierSnapshot),
        ...(item.notes ? { notes: item.notes } : {}),
      })),
    });
    const deliveryFee = Number(quote.deliveryFee);

    await this.screen.renderCustomerScreen(target, {
      text: [
        "✅ <b>Buyurtmani tasdiqlash</b>",
        "",
        `Filial: <b>${escapeHtml(branch.name)}</b>`,
        `Turi: <b>${orderType === CustomerOrderType.DELIVERY ? "Yetkazib berish" : "Olib ketish"}</b>`,
        orderType === CustomerOrderType.DELIVERY
          ? `Manzil: <b>${escapeHtml(session.address ?? "")}</b>`
          : "",
        session.note ? `Izoh: ${escapeHtml(session.note)}` : "",
        "To'lov: <b>Naqd</b>",
        "",
        ...totals.lines,
        deliveryFee > 0
          ? `Yetkazib berish: ${formatMoney(new Prisma.Decimal(quote.deliveryFee))}`
          : "",
        "",
        `<b>Jami: ${formatMoney(new Prisma.Decimal(quote.total))}</b>`,
      ]
        .filter(Boolean)
        .join("\n"),
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "✅ Tasdiqlash",
              callback_data: `${customerCallbackPrefix}:confirm:${cart.id}`,
            },
          ],
          [
            {
              text: "⬅️ Orqaga",
              callback_data: `${customerCallbackPrefix}:checkout`,
            },
          ],
          [
            {
              text: "🛒 Savatga qaytish",
              callback_data: `${customerCallbackPrefix}:cart`,
            },
          ],
          [
            {
              text: "🏠 Bosh menyu",
              callback_data: `${customerCallbackPrefix}:home`,
            },
          ],
        ],
      },
    });
  }

  async confirmCartOrder(
    target: CustomerScreenTarget,
    customer: LinkedCustomer,
    cartId: string,
  ): Promise<void> {
    const cart = await this.cart.getCartWithItems(customer.id);

    if (!cart || cart.id !== cartId || !cart.items.length) {
      await this.screen.renderCustomerScreen(target, {
        text: "Bu tasdiqlash eskirgan. Iltimos, savatni qayta tekshiring.",
      });
      return;
    }

    const session = await this.checkoutSession.getActiveCheckoutSession(
      customer.id,
      target.chatId,
    );
    const branch = session?.branchId
      ? await this.checkoutSession.findBranchForCheckout(session.branchId)
      : null;
    const orderType = session?.orderType;

    if (!session || !branch || !orderType) {
      await this.screen.renderCustomerScreen(target, {
        text: "Bu tasdiqlash eskirgan. Iltimos, buyurtma turini qayta tanlang.",
      });
      await this.startCheckout(target, customer);
      return;
    }

    if (!branchSupportsType(branch, orderType)) {
      await this.screen.renderCustomerScreen(target, {
        text: "Tanlangan filial bu buyurtma turini hozir qabul qilmayapti.",
      });
      await this.startCheckout(target, customer);
      return;
    }

    const deliveryAddress =
      orderType === CustomerOrderType.DELIVERY
        ? cleanAddress(session.address ?? "")
        : null;

    if (orderType === CustomerOrderType.DELIVERY && !deliveryAddress) {
      await this.checkoutSession.upsertCheckoutSession(
        customer.id,
        target.chatId,
        { step: "ADDRESS" },
      );
      await this.askDeliveryAddress(target, branch);
      return;
    }

    try {
      const result = await this.customerOrderEngine.createOnlineOrder(
        customer.id,
        {
          branchId: branch.id,
          idempotencyKey: this.createTelegramOrderIdempotencyKey(
            customer.id,
            cart,
            session,
          ),
          name: customer.name,
          type:
            orderType === CustomerOrderType.DELIVERY
              ? OnlineOrderTypeDto.DELIVERY
              : OnlineOrderTypeDto.PICKUP,
          ...(deliveryAddress ? { address: deliveryAddress } : {}),
          paymentMethod: OnlinePaymentMethodDto.CASH,
          notes: session.note
            ? `Telegram orqali buyurtma. ${session.note}`
            : "Telegram orqali buyurtma",
          items: cart.items.map((item) => ({
            productId: item.productId,
            ...(item.variantId ? { variantId: item.variantId } : {}),
            quantity: Number(item.quantity),
            modifiers: readCartModifiers(item.modifierSnapshot),
            ...(item.notes ? { notes: item.notes } : {}),
          })),
        },
        { source: OrderSource.TELEGRAM, orderNumberPrefix: "TG" },
      );

      if (result.order?.id) {
        void this.telegramOrderNotificationService.notifyNewOrder(
          result.order.id,
        );
      }

      await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      await this.checkoutSession.clearCheckoutSession(
        customer.id,
        target.chatId,
      );
      await this.screen.renderCustomerScreen(target, {
        text: [
          "🎉 <b>Buyurtma qabul qilindi</b>",
          "",
          `Raqam: <b>${escapeHtml(result.order?.displayOrderNumber ?? result.order?.orderNumber ?? "-")}</b>`,
          `Holat: <b>${sharedOrderStatusLabel(result.order?.status ?? "NEW")}</b>`,
          "",
          "Buyurtmani web sayt yoki Telegramdagi Buyurtmalarim bo'limidan kuzatishingiz mumkin.",
        ].join("\n"),
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🏠 Bosh menyu",
                callback_data: `${customerCallbackPrefix}:home`,
              },
            ],
            [
              {
                text: "🍽 Yana buyurtma",
                callback_data: `${customerCallbackPrefix}:home`,
              },
            ],
          ],
        },
      });
    } catch (error) {
      this.logger.error(
        "Telegram cart confirmation failed",
        error instanceof Error ? error.stack : String(error),
      );
      await this.screen.telegramRequest("sendMessage", {
        chat_id: target.chatId,
        text: "Buyurtmani yaratishda xatolik bo'ldi. Iltimos, savatni tekshirib qayta urinib ko'ring.",
      });
    }
  }

  private createTelegramOrderIdempotencyKey(
    customerId: string,
    cart: TelegramCartForCheckout,
    session: TelegramCheckoutSessionForKey,
  ): string {
    const fingerprint = {
      customerId,
      cartId: cart.id,
      branchId: session.branchId,
      orderType: session.orderType,
      address: session.address?.trim() ?? null,
      note: session.note?.trim() ?? null,
      items: cart.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity.toFixed(3),
        modifiers: readCartModifiers(item.modifierSnapshot).sort((a, b) =>
          a.modifierId.localeCompare(b.modifierId),
        ),
        notes: item.notes?.trim() ?? null,
        createdAt: item.createdAt?.toISOString() ?? null,
        updatedAt: item.updatedAt?.toISOString() ?? null,
      })),
    };
    const hash = createHash("sha256")
      .update(JSON.stringify(fingerprint))
      .digest("hex")
      .slice(0, 32);

    return `telegram:${customerId}:${cart.id}:${hash}`;
  }
}
