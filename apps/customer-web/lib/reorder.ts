import { apiFetch } from "./api";
import type { CartItem } from "./cart";
import type { Product } from "./types";

/*
 * QAYTA BUYURTMA.
 *
 * Ilgari buyurtma tarixida ham, tafsilot sahifasida ham qayta buyurtma
 * yo'q edi: doimiy mijoz o'tgan buyurtmasini takrorlash uchun savatni
 * qo'lda qaytadan yig'ishga majbur bo'lardi.
 *
 * NARX JORIY KATALOGDAN olinadi, buyurtma snapshot'idan EMAS. Snapshot
 * narxi o'tgan buyurtmaning o'zgarmas yozuvi — uni savatga ko'chirish
 * mijozga eski narxni ko'rsatib, keyin checkout kotirovkasida summani
 * sakratib yuborardi. Shu sababli menyu bir marta o'qiladi va mahsulot
 * id bo'yicha topiladi.
 *
 * Menyudan tushib qolgan, varianti o'chirilgan yoki endi mavjud
 * bo'lmagan qatorlar QAYTA TIKLANMAYDI va chaqiruvchiga qaytariladi,
 * shunda foydalanuvchiga nima tushmaganini aytish mumkin.
 */

export type ReorderSourceItem = {
  productId?: string | null;
  variantId?: string | null;
  productName: string;
  quantity: string | number;
  notes?: string | null;
  modifierSnapshot?: { id?: string | null; name: string }[] | null;
};

export type ReorderResult = {
  /** Savatga qo'shilgan qatorlar. */
  restored: Omit<CartItem, "key">[];
  /** Tiklanmagan qatorlarning nomlari. */
  skipped: string[];
};

export async function buildReorderItems(
  items: ReorderSourceItem[],
  options: { accessToken?: string | undefined } = {},
): Promise<ReorderResult> {
  const products = await apiFetch<Product[]>("/customer/menu/products", {
    ...(options.accessToken ? { accessToken: options.accessToken } : {}),
  });
  const byId = new Map(products.map((product) => [product.id, product]));
  const restored: Omit<CartItem, "key">[] = [];
  const skipped: string[] = [];

  for (const item of items) {
    const product = item.productId ? byId.get(item.productId) : undefined;
    const quantity = Math.round(Number(item.quantity));

    if (!product || !Number.isFinite(quantity) || quantity <= 0) {
      skipped.push(item.productName);
      continue;
    }

    /*
     * Variant O'SHA variant bo'lishi kerak. Boshqasiga almashtirish
     * mijoz so'ramagan mahsulotni savatga solish bo'lardi.
     */
    const variant = item.variantId
      ? product.variants.find((candidate) => candidate.id === item.variantId)
      : undefined;

    if (item.variantId && !variant) {
      skipped.push(item.productName);
      continue;
    }

    const snapshotModifierIds = (item.modifierSnapshot ?? [])
      .map((modifier) => modifier.id)
      .filter((id): id is string => Boolean(id));
    const modifiers = product.modifiers
      .filter((link) => snapshotModifierIds.includes(link.modifier.id))
      .map((link) => ({
        modifierId: link.modifier.id,
        name: link.modifier.name,
        price: link.modifier.price,
      }));

    restored.push({
      productId: product.id,
      productName: product.name,
      imageUrl: product.imageUrl,
      ...(variant ? { variantId: variant.id, variantName: variant.name } : {}),
      unitPrice: variant?.sellingPrice ?? product.sellingPrice,
      quantity,
      modifiers,
      ...(item.notes ? { notes: item.notes } : {}),
    });
  }

  return { restored, skipped };
}

/** Natijani foydalanuvchiga bir qatorda tushuntiradi. */
export function reorderMessage(result: ReorderResult): string {
  if (!result.restored.length) {
    return "Bu buyurtmadagi mahsulotlar hozir menyuda yo'q";
  }

  if (result.skipped.length) {
    return `${result.restored.length} ta mahsulot savatga qo'shildi, ${result.skipped.length} tasi menyuda yo'q`;
  }

  return "Buyurtma savatga qo'shildi";
}
