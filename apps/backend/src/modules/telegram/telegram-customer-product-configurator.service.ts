import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { RedisCacheService } from "../../cache/redis-cache.service";
import { PrismaService } from "../../prisma/prisma.service";
import { customerVisibleProductWhere } from "../customers/customer-catalog-visibility";
import {
  adjustTelegramModifierSelection,
  normalizeTelegramModifierSelections,
  type TelegramModifierRule,
  type TelegramModifierSelection,
} from "./telegram-product-configurator";
import {
  customerCallbackPrefix,
  escapeHtml,
  formatMoney,
  type LinkedCustomer,
} from "./telegram-customer-presentation";
import {
  TelegramCustomerScreenService,
  type CustomerScreenTarget,
  type TelegramCallbackQuery,
} from "./telegram-customer-screen.service";

const configuratorTtlMs = 30 * 60 * 1_000;

export type TelegramProductConfiguratorState = {
  customerId: string;
  chatId: string;
  productId: string;
  categoryId: string;
  quantity: number;
  variantId: string | null;
  modifiers: TelegramModifierSelection[];
};

type ProductConfiguratorSelection = {
  categoryId?: string | undefined;
  quantity?: string | undefined;
  variantId?: string | undefined;
};

@Injectable()
export class TelegramCustomerProductConfiguratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: RedisCacheService,
    private readonly screen: TelegramCustomerScreenService,
  ) {}

  async open(
    target: CustomerScreenTarget,
    productId: string,
    customer: LinkedCustomer,
    selection: ProductConfiguratorSelection = {},
  ): Promise<void> {
    const product = await this.findProduct(productId);
    if (!product) {
      await this.screen.renderCustomerScreen(target, {
        text: "Mahsulot topilmadi yoki hozir mavjud emas.",
      });
      return;
    }
    const value = Number(selection.quantity);
    const quantity = Number.isFinite(value)
      ? Math.max(1, Math.min(99, Math.trunc(value)))
      : 1;
    const variant =
      product.variants.find(
        (item) =>
          item.id === selection.variantId || item.code === selection.variantId,
      ) ??
      product.variants.find((item) => item.isDefault) ??
      product.variants[0] ??
      null;
    const token = randomBytes(9).toString("base64url");
    const state: TelegramProductConfiguratorState = {
      customerId: customer.id,
      chatId: target.chatId,
      productId: product.id,
      categoryId: selection.categoryId || product.category.id,
      quantity,
      variantId: variant?.id ?? null,
      modifiers: normalizeTelegramModifierSelections(
        this.modifierRules(product.modifiers),
        [],
      ),
    };
    await this.cache.setJson(this.cacheKey(token), state, configuratorTtlMs);
    await this.render(target, token, product, state);
  }

  async handleControl(
    target: CustomerScreenTarget,
    callback: TelegramCallbackQuery,
    customer: LinkedCustomer,
    token: string,
    control: string,
    value?: string,
    delta?: string,
  ): Promise<void> {
    const state = await this.getState(token, customer.id, target.chatId);
    if (!state) return this.expire(target, callback);
    const product = await this.findProduct(state.productId);
    if (!product) {
      await this.clear(token);
      return this.expire(target, callback);
    }

    const next = { ...state, modifiers: [...state.modifiers] };
    if (control === "q") {
      if (value === "0") return this.screen.answerCallback(callback);
      const direction = value === "+" ? 1 : value === "-" ? -1 : 0;
      if (!direction) {
        return this.screen.answerCallback(
          callback,
          "Miqdor tugmasi noto'g'ri.",
          true,
        );
      }
      next.quantity = Math.max(1, Math.min(99, state.quantity + direction));
    } else if (control === "v") {
      const variant = product.variants[Number(value)];
      if (!variant) {
        return this.screen.answerCallback(
          callback,
          "Mahsulot turi topilmadi.",
          true,
        );
      }
      next.variantId = variant.id;
    } else if (control === "m") {
      const modifier = product.modifiers[Number(value)];
      if (!modifier) {
        return this.screen.answerCallback(
          callback,
          "Qo'shimcha tanlovi noto'g'ri.",
          true,
        );
      }
      const direction = delta === "+" ? 1 : delta === "-" ? -1 : 0;
      if (direction) {
        next.modifiers = adjustTelegramModifierSelection(
          this.modifierRules(product.modifiers),
          state.modifiers,
          modifier.modifierId,
          direction,
        );
      }
    } else {
      return this.screen.answerCallback(callback, "Tanlov topilmadi.", true);
    }

    next.modifiers = normalizeTelegramModifierSelections(
      this.modifierRules(product.modifiers),
      next.modifiers,
    );
    await this.cache.setJson(this.cacheKey(token), next, configuratorTtlMs);
    await this.screen.answerCallback(callback);
    await this.render(target, token, product, next);
  }

  async getState(
    token: string,
    customerId: string,
    chatId: string,
  ): Promise<TelegramProductConfiguratorState | null> {
    if (!/^[A-Za-z0-9_-]{12}$/.test(token)) return null;
    const state = await this.cache.getJson<TelegramProductConfiguratorState>(
      this.cacheKey(token),
    );
    return state?.customerId === customerId &&
      state.chatId === chatId &&
      state.productId
      ? state
      : null;
  }
  async claimAdd(
    token: string,
    customerId: string,
    chatId: string,
  ): Promise<boolean | null> {
    if (!(await this.getState(token, customerId, chatId))) return false;
    return this.cache.setIfAbsent(this.claimKey(token), configuratorTtlMs);
  }

  private claimKey(token: string): string {
    return "telegram:customer-product-configurator:claimed:" + token;
  }

  async clear(token: string): Promise<void> {
    if (/^[A-Za-z0-9_-]{12}$/.test(token)) {
      await this.cache.delete(this.cacheKey(token));
    }
  }

  async expire(
    target: CustomerScreenTarget,
    callback: TelegramCallbackQuery,
  ): Promise<void> {
    await this.screen.answerCallback(
      callback,
      "Tanlov muddati tugadi. Mahsulotni qayta oching.",
      true,
    );
    await this.screen.renderCustomerScreen(target, {
      text: "Mahsulot tanlovi muddati tugadi. Menyudan mahsulotni qayta oching.",
    });
  }

  private async findProduct(productId: string) {
    const include = {
      category: { select: { id: true, name: true } },
      variants: {
        where: { isAvailable: true },
        orderBy: [{ sortOrder: "asc" as const }, { name: "asc" as const }],
      },
      modifiers: {
        where: { modifier: { isActive: true } },
        orderBy: { sortOrder: "asc" as const },
        include: { modifier: true },
      },
    };
    return (
      (await this.prisma.product.findFirst({
        where: {
          id: productId,
          isAvailable: true,
          ...customerVisibleProductWhere(),
        },
        include,
      })) ??
      (await this.prisma.product.findFirst({
        where: {
          code: productId,
          isAvailable: true,
          ...customerVisibleProductWhere(),
        },
        include,
      }))
    );
  }

  private modifierRules(
    modifiers: Array<{
      modifierId: string;
      isRequired: boolean;
      minSelect: number;
      maxSelect: number | null;
    }>,
  ): TelegramModifierRule[] {
    return modifiers.map(
      ({ modifierId, isRequired, minSelect, maxSelect }) => ({
        modifierId,
        isRequired,
        minSelect,
        maxSelect,
      }),
    );
  }

  private async render(
    target: CustomerScreenTarget,
    token: string,
    product: NonNullable<
      Awaited<
        ReturnType<TelegramCustomerProductConfiguratorService["findProduct"]>
      >
    >,
    state: TelegramProductConfiguratorState,
  ): Promise<void> {
    const variant =
      product.variants.find((item) => item.id === state.variantId) ??
      product.variants.find((item) => item.isDefault) ??
      product.variants[0] ??
      null;
    const counts = new Map(
      state.modifiers.map((item) => [item.modifierId, item.quantity]),
    );
    const unitPrice = state.modifiers.reduce(
      (total, selection) => {
        const item = product.modifiers.find(
          (candidate) => candidate.modifierId === selection.modifierId,
        );
        return item
          ? total.add(
              new Prisma.Decimal(item.modifier.price).mul(selection.quantity),
            )
          : total;
      },
      new Prisma.Decimal(variant?.sellingPrice ?? product.sellingPrice),
    );
    const modifierSummary = state.modifiers.flatMap((selection) => {
      const item = product.modifiers.find(
        (candidate) => candidate.modifierId === selection.modifierId,
      );
      return item
        ? [escapeHtml(item.modifier.name) + " ×" + selection.quantity]
        : [];
    });
    const keyboard = [
      ...(product.variants.length > 1
        ? product.variants.map((item, index) => [
            {
              text:
                (item.id === variant?.id ? "✓ " : "") +
                item.name +
                " · " +
                formatMoney(item.sellingPrice),
              callback_data:
                customerCallbackPrefix + ":pc:" + token + ":v:" + index,
            },
          ])
        : []),
      [
        {
          text: "−",
          callback_data: customerCallbackPrefix + ":pc:" + token + ":q:-",
        },
        {
          text: "Miqdor: " + state.quantity,
          callback_data: customerCallbackPrefix + ":pc:" + token + ":q:0",
        },
        {
          text: "+",
          callback_data: customerCallbackPrefix + ":pc:" + token + ":q:+",
        },
      ],
      ...product.modifiers.map((item, index) => {
        const name =
          item.modifier.name.length > 28
            ? item.modifier.name.slice(0, 25) + "..."
            : item.modifier.name;
        const callback =
          customerCallbackPrefix + ":pc:" + token + ":m:" + index;
        return [
          { text: "− " + name, callback_data: callback + ":-" },
          {
            text:
              "×" +
              (counts.get(item.modifierId) ?? 0) +
              " · " +
              formatMoney(item.modifier.price),
            callback_data: callback + ":0",
          },
          { text: "+ " + name, callback_data: callback + ":+" },
        ];
      }),
      [
        {
          text: "🛒 Savatga qo'shish",
          callback_data: customerCallbackPrefix + ":pa:" + token,
        },
      ],
      [
        {
          text: "⬅️ Orqaga",
          callback_data: customerCallbackPrefix + ":cat:" + state.categoryId,
        },
      ],
    ];
    const payload = {
      text: [
        "🍽 <b>" + escapeHtml(product.name) + "</b>",
        "Narxi: <b>" +
          formatMoney(unitPrice) +
          "</b> · Miqdor: " +
          state.quantity,
        "",
        ...modifierSummary,
        escapeHtml(product.description ?? "Buyurtmadan keyin tayyorlanadi."),
      ].join("\n"),
      parse_mode: "HTML" as const,
      reply_markup: { inline_keyboard: keyboard },
    };
    if (product.imageUrl) {
      await this.screen.renderCustomerPhotoScreen(target, {
        photo: product.imageUrl,
        caption: payload.text,
        parse_mode: payload.parse_mode,
        reply_markup: payload.reply_markup,
      });
    } else {
      await this.screen.renderCustomerScreen(target, payload);
    }
  }

  private cacheKey(token: string): string {
    return "telegram:customer-product-configurator:" + token;
  }
}
