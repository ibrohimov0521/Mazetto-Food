import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import {
  TelegramCustomerScreenService,
  type CustomerScreenTarget,
} from "./telegram-customer-screen.service";
import {
  customerCallbackPrefix,
  escapeHtml,
  formatMoney,
  readCartModifiers,
} from "./telegram-customer-presentation";

/*
 * Telegram savatining MA'LUMOT qatlami: o'qish, narx hisoblash va
 * qulflash. Xabar chizish bu yerda EMAS — u buyurtma servisida qoladi.
 *
 * NIMA UCHUN AJRATILDI. Checkout oqimi savatni o'qishi kerak, lekin
 * savat o'qish buyurtma servisida yashardi — ya'ni checkout'ni alohida
 * chiqarish halqa bog'liqlik yaratardi. Endi ikkalasi ham shu servisga
 * pastga qarab bog'lanadi.
 */
@Injectable()
export class TelegramCartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly screen: TelegramCustomerScreenService,
  ) {}

  async getOrCreateCart(customerId: string) {
    const existing = await this.prisma.cart.findFirst({
      where: { customerId },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.cart.create({
      data: { customerId },
      select: { id: true },
    });
  }

  /*
   * Tranzaksiya ichidagi nusxasi ATAYLAB alohida: `this.prisma` bilan
   * yaratilgan savat tranzaksiyaga KIRMAYDI va rollback bo'lganda
   * yetim qator bo'lib qolardi.
   */
  async getOrCreateCartForTransaction(
    tx: Prisma.TransactionClient,
    customerId: string,
  ): Promise<{ id: string }> {
    const existing = await tx.cart.findFirst({
      where: { customerId },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });

    if (existing) {
      return existing;
    }

    return tx.cart.create({
      data: { customerId },
      select: { id: true },
    });
  }

  getCartWithItems(customerId: string) {
    return this.prisma.cart.findFirst({
      where: { customerId },
      orderBy: { updatedAt: "desc" },
      include: {
        items: {
          orderBy: { createdAt: "asc" },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sellingPrice: true,
                modifiers: {
                  where: { modifier: { isActive: true } },
                  orderBy: { sortOrder: "asc" },
                  include: { modifier: true },
                },
              },
            },
            variant: { select: { id: true, name: true, sellingPrice: true } },
          },
        },
      },
    });
  }

  findCustomerCartItem(customerId: string, cartItemId: string) {
    return this.prisma.cartItem.findFirst({
      where: { id: cartItemId, cart: { customerId } },
      select: {
        id: true,
        productId: true,
        quantity: true,
        modifierSnapshot: true,
      },
    });
  }

  /*
   * Narx SERVERDA hisoblanadi va modifikator narxlari bazadan JORIY
   * holatda o'qiladi — savatda saqlangan eski narx ishlatilmaydi.
   */
  async calculateCartTotals(
    items: NonNullable<
      Awaited<ReturnType<TelegramCartService["getCartWithItems"]>>
    >["items"],
  ) {
    const modifierIds = [
      ...new Set(
        items.flatMap((item) =>
          readCartModifiers(item.modifierSnapshot).map(
            (modifier) => modifier.modifierId,
          ),
        ),
      ),
    ];
    const modifiers = modifierIds.length
      ? await this.prisma.modifier.findMany({
          where: { id: { in: modifierIds }, isActive: true },
          select: { id: true, name: true, price: true },
        })
      : [];
    let total = new Prisma.Decimal(0);
    const lines = items.map((item) => {
      const quantity = new Prisma.Decimal(item.quantity);
      const selectedModifiers = readCartModifiers(item.modifierSnapshot);
      const modifierTotal = selectedModifiers.reduce((sum, selected) => {
        const modifier = modifiers.find(
          (candidate) => candidate.id === selected.modifierId,
        );
        /*
         * Modifikator o'chirilgan bo'lsa narxi QO'SHILMAYDI, lekin qator
         * yiqilmaydi: mijoz savatiga o'chirilgan qo'shimcha uchun pul
         * to'lamasligi kerak.
         */
        return modifier
          ? sum.add(modifier.price.mul(new Prisma.Decimal(selected.quantity)))
          : sum;
      }, new Prisma.Decimal(0));
      const unitPrice = item.variant?.sellingPrice ?? item.product.sellingPrice;
      const lineTotal = unitPrice.add(modifierTotal).mul(quantity);
      total = total.add(lineTotal);
      const modifierNames = selectedModifiers
        .map(
          (selected) =>
            modifiers.find((modifier) => modifier.id === selected.modifierId)
              ?.name,
        )
        .filter(Boolean)
        .join(", ");

      return [
        `${quantity.toNumber()}x <b>${escapeHtml(item.product.name)}</b>${item.variant ? ` ${escapeHtml(item.variant.name)}` : ""}`,
        modifierNames ? `  + ${escapeHtml(modifierNames)}` : "",
        `  ${formatMoney(lineTotal)}`,
      ]
        .filter(Boolean)
        .join("\n");
    });

    return { lines, total };
  }

  /*
   * Bitta savat QATORI uchun qulf: bir mahsulotni ikki marta tez bosish
   * ikkita alohida qator yaratib yuborardi.
   */
  async lockCartLine(
    tx: Prisma.TransactionClient,
    cartId: string,
    productId: string,
    variantId: string | null,
  ): Promise<void> {
    await this.lockByKey(tx, [
      "telegram-cart-line",
      cartId,
      productId,
      variantId ?? "",
    ]);
  }

  /** Butun savat uchun qulf — checkout paytida qator qo'shilmasin. */
  async lockTelegramCart(
    tx: Prisma.TransactionClient,
    customerId: string,
  ): Promise<void> {
    await this.lockByKey(tx, ["telegram-cart", customerId]);
  }

  /*
   * `pg_advisory_xact_lock` ikkita 32-bitli butun son oladi, shuning uchun
   * kalit SHA-256 dan kesib olinadi. Qulf TRANZAKSIYA tugashi bilan
   * o'z-o'zidan bo'shaydi — qo'lda ochish kerak emas va xato yuz berganda
   * osilib qolmaydi.
   */
  private async lockByKey(
    tx: Prisma.TransactionClient,
    values: string[],
  ): Promise<void> {
    const hash = createHash("sha256").update(values.join(":")).digest();
    const firstKey = hash.readInt32BE(0);
    const secondKey = hash.readInt32BE(4);

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${firstKey}, ${secondKey})`;
  }

  /*
   * Savat EKRANI. Ma'lumot qatlami bilan bir joyda turadi, chunki u
   * faqat savatni o'qiydi va chizadi — buyurtma mantig'i yo'q.
   *
   * Buyurtma servisi ham, checkout oqimi ham shu metodni chaqiradi;
   * u buyurtma servisida qolganda checkout'ni ajratish halqa
   * bog'liqlik yaratardi.
   */
  async sendCart(
    target: CustomerScreenTarget,
    customer: { id: string },
  ): Promise<void> {
    const cart = await this.getCartWithItems(customer.id);
    if (!cart?.items.length) {
      await this.screen.renderCustomerScreen(target, {
        text: "🛒 Savatingiz bo'sh. Menyudan taom tanlang.",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🍽 Menyu",
                callback_data: `${customerCallbackPrefix}:menu`,
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
      return;
    }
    const totals = await this.calculateCartTotals(cart.items);
    await this.screen.renderCustomerScreen(target, {
      text: [
        "🛒 <b>Savat</b>",
        "",
        ...totals.lines,
        "",
        `<b>Jami: ${formatMoney(totals.total)}</b>`,
      ].join("\n"),
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          ...cart.items.flatMap((item) => [
            [
              {
                text: `− ${item.product.name}`,
                callback_data: `${customerCallbackPrefix}:qty:${item.id}:dec`,
              },
              {
                text: "+",
                callback_data: `${customerCallbackPrefix}:qty:${item.id}:inc`,
              },
            ],
          ]),
          [
            {
              text: "✅ Buyurtma berish",
              callback_data: `${customerCallbackPrefix}:checkout`,
            },
          ],
          [
            {
              text: "🍽 Menyuga qaytish",
              callback_data: `${customerCallbackPrefix}:menu`,
            },
          ],
        ],
      },
    });
  }
}
