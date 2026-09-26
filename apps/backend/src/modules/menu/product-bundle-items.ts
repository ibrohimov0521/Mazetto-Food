import { BadRequestException } from "@nestjs/common";

export type ProductBundleItemInput = {
  id?: string;
  componentCode: string;
  componentName: string;
  componentProductId?: string | null;
  quantity: number;
  unitLabel?: string | null;
  sortOrder?: number;
};

export function validateProductBundleItems(
  items: ProductBundleItemInput[] | undefined,
  isCombo: boolean | undefined,
): void {
  if (!items) return;
  if (items.length > 50) {
    throw new BadRequestException(
      "Set tarkibida 50 tadan ko'p qator bo'lmaydi",
    );
  }
  if (isCombo && items.length === 0) {
    throw new BadRequestException(
      "Set tarkibiga kamida bitta mahsulot qo'shing",
    );
  }
  if (isCombo === false && items.length > 0) {
    throw new BadRequestException("Set tarkibi faqat set mahsulotiga beriladi");
  }

  const codes = new Set<string>();
  for (const item of items) {
    const code = item.componentCode.trim().toUpperCase();
    if (
      !code ||
      !item.componentName.trim() ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0
    ) {
      throw new BadRequestException(
        "Set tarkibidagi nom, kod va miqdorni tekshiring",
      );
    }
    if (codes.has(code)) {
      throw new BadRequestException(
        "Set tarkibida bir xil kod ikki marta bo'lmasligi kerak",
      );
    }
    codes.add(code);
  }
}
