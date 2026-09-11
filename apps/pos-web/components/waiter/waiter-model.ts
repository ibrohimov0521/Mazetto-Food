/*
 * Ofitsiant ish stoli uchun umumiy tiplar va yordamchilar.
 *
 * Backend imkoniyatlari (o'zgartirilmaydi):
 *   GET   /tables                  — zal + stol ro'yxati, har stolda ENG YANGI ochiq buyurtma (take: 1)
 *   GET   /tables/:id              — stolning BARCHA ochiq buyurtmalari
 *   POST  /tables/:id/orders       — stolni ochish (RESERVED/CLEANING da va aktiv buyurtma bo'lsa rad etiladi)
 *   POST  /orders/:id/items        — productId, variantId?, quantity, modifiers[], notes?
 *   PATCH /orders/:id/items/:itemId— quantity?, modifiers?, notes?, status?, cancellationReason?
 *   PATCH /orders/:id/status       — status + reason
 * Qator o'chirish uchun DELETE yo'q: status=CANCELLED qilinadi, summa qayta hisoblanadi.
 */

import type { OrderStatus } from "../../lib/order-display";

export type TableStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING";
export type OrderItemState = "ACTIVE" | "CANCELLED";

export type ModifierSnapshotEntry = {
  id: string;
  name: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
};

export type OrderLine = {
  id: string;
  productId: string | null;
  variantId: string | null;
  productName: string;
  variantName?: string | null;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
  status: OrderItemState;
  notes?: string | null;
  modifierSnapshot?: ModifierSnapshotEntry[] | null;
};

export type TableOrder = {
  id: string;
  orderNumber: string;
  displayOrderNumber?: string | null;
  status: OrderStatus;
  total: string;
  guestCount?: number | null;
  notes?: string | null;
  createdAt: string;
  items: OrderLine[];
};

export type WaiterTable = {
  id: string;
  branchId: string;
  name: string;
  number: number | null;
  capacity: number | null;
  status: TableStatus;
  hall?: { id: string; name: string } | null;
  orders: TableOrder[];
};

export type MenuVariant = {
  id: string;
  name: string;
  sellingPrice: string;
  isDefault: boolean;
};

export type MenuModifier = {
  isRequired: boolean;
  modifier: { id: string; name: string; price: string };
};

export type MenuProduct = {
  id: string;
  categoryId: string | null;
  name: string;
  imageUrl?: string | null;
  sellingPrice: string;
  variants: MenuVariant[];
  modifiers: MenuModifier[];
};

export type MenuCategory = { id: string; name: string };

export type LineDraft = {
  variantId: string | null;
  modifierIds: string[];
  quantity: number;
  notes: string;
};

/*
 * DESIGN_RULES rang semantikasi:
 *   yashil = bo'sh · info(ko'k/teal) = band · sariq = bron · kulrang = tozalanmoqda
 * Qizil FAQAT buzg'unchi/xato uchun — band stol normal holat, xato emas.
 */
export const tableStatusLabels: Record<TableStatus, string> = {
  AVAILABLE: "Bo'sh",
  OCCUPIED: "Band",
  RESERVED: "Bron qilingan",
  CLEANING: "Tozalanmoqda",
};

export const tableStatusTones: Record<TableStatus, string> = {
  AVAILABLE: "ready",
  OCCUPIED: "cooking",
  RESERVED: "waiting",
  CLEANING: "neutral",
};

export const unassignedHallName = "Zal ko'rsatilmagan";
export const maxGuestCount = 30;
export const maxLineQuantity = 99;

/** Bekor qilingan qatorlar summaga kirmaydi — ularni ko'rsatmaymiz ham. */
export function activeLines(order: TableOrder | null): OrderLine[] {
  return (order?.items ?? []).filter((line) => line.status !== "CANCELLED");
}

export function lineQuantity(line: OrderLine): number {
  const parsed = Math.round(Number(line.quantity));

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function totalQuantity(order: TableOrder | null): number {
  return activeLines(order).reduce((sum, line) => sum + lineQuantity(line), 0);
}

export function defaultVariant(product: MenuProduct): MenuVariant | null {
  return (
    product.variants.find((variant) => variant.isDefault) ??
    product.variants[0] ??
    null
  );
}

export function productBasePrice(product: MenuProduct): string {
  return defaultVariant(product)?.sellingPrice ?? product.sellingPrice;
}

export function draftUnitPrice(
  product: MenuProduct | null,
  draft: LineDraft,
  fallbackUnitPrice: string,
): number {
  const base = product
    ? Number(
        product.variants.find((variant) => variant.id === draft.variantId)
          ?.sellingPrice ??
          defaultVariant(product)?.sellingPrice ??
          product.sellingPrice,
      )
    : Number(fallbackUnitPrice);
  const extras = (product?.modifiers ?? [])
    .filter((entry) => draft.modifierIds.includes(entry.modifier.id))
    .reduce((sum, entry) => sum + Number(entry.modifier.price), 0);

  return (Number.isFinite(base) ? base : 0) + extras;
}

/** Qator tagidagi izoh satri: tur + qo'shimchalar. */
export function lineSubtitle(line: OrderLine): string {
  const modifiers = (line.modifierSnapshot ?? [])
    .map((entry) => entry.name)
    .filter(Boolean);

  return [line.variantName ?? null, ...modifiers]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

export function lineModifierIds(line: OrderLine): string[] {
  return (line.modifierSnapshot ?? []).map((entry) => entry.id);
}

/**
 * Backend `createOrderForTable` RESERVED va CLEANING holatini rad etadi,
 * aktiv buyurtmasi bor stolga esa ikkinchi buyurtma yaratmaydi.
 */
export function tableOpenBlockReason(
  table: WaiterTable,
  orders: TableOrder[],
): string | null {
  if (orders.length) {
    return "Bu stolda ochiq buyurtma bor.";
  }

  if (table.status === "RESERVED") {
    return "Stol bron qilingan — administrator bronni bekor qilmaguncha buyurtma ochilmaydi.";
  }

  if (table.status === "CLEANING") {
    return "Stol tozalanmoqda — tayyor bo'lgach buyurtma ochish mumkin.";
  }

  return null;
}

export function isOrderEditable(order: TableOrder): boolean {
  return order.status !== "COMPLETED" && order.status !== "CANCELLED";
}

/**
 * Oshxonaga yuborish FAQAT `NEW` holatda.
 * Backend `CONFIRMED` buyurtmani qayta tasdiqlashga ruxsat beradi, lekin
 * `deductRecipeStock` `stockDeductedAt` ni tekshirmaydi — qayta yuborish
 * omborni IKKINCHI marta kamaytiradi. Shu sabab qayta yuborish berilmaydi.
 */
export function canSendToKitchen(order: TableOrder): boolean {
  return order.status === "NEW" && activeLines(order).length > 0;
}

/**
 * `SERVED` ga o'tish uchun buyurtma avval tasdiqlangan bo'lishi shart
 * (backend: "Order must be confirmed before moving to preparation or service states").
 */
export function canRequestPayment(order: TableOrder): boolean {
  return (
    order.status === "CONFIRMED" ||
    order.status === "PREPARING" ||
    order.status === "READY"
  );
}

export function orderLabel(order: TableOrder): string {
  return order.displayOrderNumber ?? order.orderNumber;
}

export function orderTone(status: OrderStatus): string {
  if (status === "CANCELLED") {
    return "late";
  }

  if (status === "SERVED" || status === "COMPLETED" || status === "READY") {
    return "ready";
  }

  return status === "NEW" ? "waiting" : "cooking";
}
