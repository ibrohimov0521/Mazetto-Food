import { BadRequestException } from "@nestjs/common";
import { CustomerOrderType, Prisma } from "@prisma/client";

/*
 * Telegram mijoz botining TAQDIMOT qatlami: yorliqlar, ikonkalar, tugma
 * joylashuvi, formatlash va kichik parserlar.
 *
 * NIMA UCHUN AJRATILDI. `telegram-customer-ordering.service.ts` 1994
 * qator edi va uning katta qismi shu yerdagi sof funksiyalar — ular na
 * bazaga, na Telegram API'ga murojaat qiladi. Servis ichida turganda
 * ular alohida sinalmasdi va menyu yorlig'ini o'zgartirish uchun ham
 * ikki ming qatorlik faylni ochish kerak edi.
 *
 * BU YERGA FAQAT SOF FUNKSIYA TUSHADI. `this` ga, bazaga yoki tarmoqqa
 * murojaat qiladigan hech narsa bu yerda bo'lmasligi kerak — aks holda
 * ajratishning ma'nosi qolmaydi.
 */

export type CartModifier = {
  modifierId: string;
  quantity: number;
};

export type BranchForCheckout = {
  id: string;
  name: string;
  address?: string | null;
  latitude?: Prisma.Decimal | null;
  longitude?: Prisma.Decimal | null;
  acceptsOrders: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  isTemporarilyClosed: boolean;
};

/** Manzil shundan qisqa bo'lsa, kuryer uni topa olmaydi. */
export const minimumAddressLength = 5;

/*
 * Menyu qatorlari — bu MAHSULOT KODLARI, matn emas.
 *
 * Juftlangan joylashuv ataylab: chap ustunda go'shtli, o'ngda tovuqli
 * variant. Telegram tugmalari tor, shuning uchun mijoz ikkita variantni
 * yonma-yon ko'rib solishtira oladi.
 */
export const lavashTelegramRows = [
  ["CLASSIC_LAVASH", "CHICKEN_LAVASH"],
  ["BIG_LAVASH", "BIG_CHICKEN_LAVASH"],
  ["LAVASH_CHEESE", "CHICKEN_CHEESE_LAVASH"],
  ["BIG_LAVASH_CHEESE", "BIG_CHICKEN_LAVASH_CHEESE"],
  ["LAVASH_SPICY", "CHICKEN_SPICY_LAVASH"],
  ["BIG_LAVASH_SPICY", "BIG_CHICKEN_SPICY_LAVASH"],
  ["TANDIR_LAVASH"],
  ["TANDIR_LAVASH_CHEESE"],
] as const;

export const burgerTelegramRows = [
  ["CLASSIC_BURGER", "CHICKEN_BURGER"],
  ["CHEESEBURGER", "CHICKEN_CHEESEBURGER"],
  ["DOUBLE_BURGER", "DOUBLE_CHICKEN_BURGER"],
  ["DOUBLE_CHEESEBURGER", "DOUBLE_CHICKEN_CHEESEBURGER"],
] as const;

const categoryIcons: Record<string, string> = {
  BURGER: "🍔",
  BLYUDALAR: "🍽",
  CHICKEN_BURGER: "🍔",
  CHICKEN_LAVASH: "🍗",
  DONER: "🥙",
  DRINKS: "🥤",
  FAST_FOOD: "🍟",
  HOT_DOG: "🌭",
  LAVASH: "🌯",
  SAUCES: "🥫",
  SETS: "🔥",
};

/*
 * Telegram uchun QISQARTIRILGAN nomlar. Tugma matni tor ekranda kesiladi,
 * shuning uchun katalogdagi to'liq nom o'rniga qisqasi ko'rsatiladi.
 * Kod ro'yxatda bo'lmasa, katalog nomi o'zgarishsiz ishlatiladi.
 */
const productButtonLabels: Record<string, string> = {
  BIG_CHICKEN_LAVASH: "Kurinniy Big",
  BIG_CHICKEN_LAVASH_CHEESE: "Kurinniy Big Pishloqli",
  BIG_CHICKEN_SPICY_LAVASH: "Achchiq Kurinniy Big",
  BIG_LAVASH: "Big Lavash",
  BIG_LAVASH_CHEESE: "Big Pishloqli",
  BIG_LAVASH_SPICY: "Achchiq Big",
  CHEESEBURGER: "Chizburger",
  CHICKEN_BURGER: "Chicken Burger",
  CHICKEN_CHEESEBURGER: "Chicken Chizburger",
  CHICKEN_CHEESE_LAVASH: "Kurinniy Pishloqli",
  CHICKEN_LAVASH: "Kurinniy Lavash",
  CHICKEN_SPICY_LAVASH: "Achchiq Kurinniy",
  CLASSIC_BURGER: "Burger",
  CLASSIC_LAVASH: "Lavash",
  DOUBLE_BURGER: "Double Burger",
  DOUBLE_CHEESEBURGER: "Double Chizburger",
  DOUBLE_CHICKEN_BURGER: "Double Chicken",
  DOUBLE_CHICKEN_CHEESEBURGER: "Double Chicken Chizburger",
  LAVASH_CHEESE: "Pishloqli",
  LAVASH_SPICY: "Achchiq Lavash",
  TANDIR_LAVASH: "Tandir Lavash",
  TANDIR_LAVASH_CHEESE: "Tandir Pishloqli",
};

export function categoryButtonLabel(
  code: string | null | undefined,
  name: string,
): string {
  return `${categoryIcons[code ?? ""] ?? "🍽"} ${name}`;
}

export function telegramProductButtonLabel(code: string, name: string): string {
  return productButtonLabels[code] ?? name;
}

export function formatMoney(value: Prisma.Decimal | number | string): string {
  return `${new Intl.NumberFormat("uz-UZ").format(Number(value))} so'm`;
}

/*
 * Telegram xabarlari `parse_mode: "HTML"` bilan yuboriladi, ya'ni mijoz
 * kiritgan matn (ism, manzil, izoh) qochirilmasa, xabar tuzilishini
 * buzishi mumkin.
 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function maskPhone(phone: string): string {
  if (phone.length <= 7) {
    return escapeHtml(phone);
  }

  return escapeHtml(`${phone.slice(0, 4)}***${phone.slice(-4)}`);
}

/** Koordinata bo'lmasa `null` — filialda xarita havolasi ko'rsatilmaydi. */
export function branchMapUrl(branch: {
  latitude?: Prisma.Decimal | null;
  longitude?: Prisma.Decimal | null;
}): string | null {
  if (branch.latitude === null || branch.latitude === undefined) {
    return null;
  }

  if (branch.longitude === null || branch.longitude === undefined) {
    return null;
  }

  return `https://www.google.com/maps/search/?api=1&query=${Number(branch.latitude)},${Number(branch.longitude)}`;
}

export function chunkButtons<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}

/** Normallashtirilgan manzil yoki juda qisqa bo'lsa `null`. */
export function cleanAddress(address: string): string | null {
  const normalized = address.replace(/\s+/g, " ").trim();

  if (normalized.length < minimumAddressLength) {
    return null;
  }

  return normalized;
}

/*
 * Savat qatoridagi modifikatorlar `Json` ustunida saqlanadi, ya'ni tipi
 * kafolatlanmaydi. Har maydon alohida tekshiriladi: bitta buzuq yozuv
 * butun savatni yiqitmasligi kerak, shuning uchun `flatMap` bilan
 * yaroqsizlari jimgina tashlanadi.
 */
export function readCartModifiers(
  value: Prisma.JsonValue | null,
): CartModifier[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const modifierId = "modifierId" in item ? String(item.modifierId) : "";
    const quantity =
      "quantity" in item && Number(item.quantity) > 0
        ? Number(item.quantity)
        : 1;

    return modifierId ? [{ modifierId, quantity }] : [];
  });
}

export function parseCustomerOrderType(value: string): CustomerOrderType {
  if (
    value === CustomerOrderType.DELIVERY ||
    value === CustomerOrderType.PICKUP
  ) {
    return value;
  }

  throw new BadRequestException("Order type is invalid");
}

export function branchSupportsType(
  branch: BranchForCheckout,
  orderType: CustomerOrderType,
): boolean {
  if (!branch.acceptsOrders || branch.isTemporarilyClosed) {
    return false;
  }

  return orderType === CustomerOrderType.DELIVERY
    ? branch.deliveryEnabled
    : branch.pickupEnabled;
}

/** Varianti bitta yoki umuman yo'q mahsulot — konfigurator ko'rsatilmaydi. */
export function isSimpleQuickAddProduct(product: {
  category?: { code?: string | null; name?: string | null } | null;
  variants?: Array<{ id: string; isDefault?: boolean | null }>;
  modifiers?: unknown[];
}): boolean {
  return (product.variants?.length ?? 0) <= 1;
}

/*
 * Telegram xabar mazmuni o'zgarmagan bo'lsa tahrirlashni XATO deb
 * qaytaradi. Bu haqiqiy nosozlik emas — bir xil holat ikki marta
 * kelganda yuz beradi va jimgina o'tkazib yuborilishi kerak.
 */
export function isMessageNotModifiedError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  return message.includes("message is not modified");
}

export function requiredTelegramId(
  value: number | string | undefined,
  label: string,
): string {
  if (value === undefined || value === null || String(value).trim() === "") {
    throw new BadRequestException(`Telegram ${label} is missing`);
  }

  return String(value);
}
