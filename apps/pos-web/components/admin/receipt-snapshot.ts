type LegacyReceiptItem = {
  id: string;
  productName: string;
  variantName?: string | null;
  quantity: string;
  totalPrice: string;
};

type LegacyReceiptPayment = {
  id: string;
  amount: string;
  method?: { code: string; name: string } | null;
};

export type ReceiptDisplayItem = {
  key: string;
  name: string;
  variant: string | null;
  quantity: string;
  total: string;
  notes: string | null;
  modifiers: string[];
};

export type ReceiptDisplayPayment = {
  key: string;
  method: string;
  amount: string;
};

export type ReceiptDisplaySnapshot = {
  orderNumber: string | null;
  items: ReceiptDisplayItem[];
  payments: ReceiptDisplayPayment[];
};

const paymentMethodLabels: Record<string, string> = {
  CASH: "Naqd pul",
  CARD: "Bank kartasi",
  UZCARD: "Uzcard",
  HUMO: "Humo",
  CLICK: "Click",
  PAYME: "Payme",
  ONLINE: "Onlayn to'lov",
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function snapshotModifiers(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((modifier) => {
      const parsed = record(modifier);
      return text(parsed?.name) ?? text(parsed?.modifierName) ?? text(modifier);
    })
    .filter((modifier): modifier is string => modifier !== null);
}

export function receiptPaymentLabel(method: string): string {
  const normalized = method.trim();
  return paymentMethodLabels[normalized.toUpperCase()] ?? (normalized || "To'lov");
}

export function receiptDisplaySnapshot(
  content: unknown,
  fallback: {
    items?: readonly LegacyReceiptItem[] | null;
    payments?: readonly LegacyReceiptPayment[] | null;
  } = {},
): ReceiptDisplaySnapshot {
  const saved = record(content);
  const savedItems = Array.isArray(saved?.items) ? saved.items : null;
  const savedPayments = Array.isArray(saved?.payments) ? saved.payments : null;
  const items = savedItems !== null
    ? savedItems.flatMap((value, index) => {
        const item = record(value);
        if (!item) return [];
        return [{
          key: `snapshot-item-${index}`,
          name: text(item.name) ?? text(item.productName) ?? "Mahsulot",
          variant: text(item.variant) ?? text(item.variantName),
          quantity: text(item.quantity) ?? "1",
          total: text(item.total) ?? text(item.totalPrice) ?? "",
          notes: text(item.notes),
          modifiers: snapshotModifiers(item.modifiers ?? item.modifierSnapshot),
        }];
      })
    : (fallback.items ?? []).map((item) => ({
        key: item.id,
        name: item.productName,
        variant: item.variantName ?? null,
        quantity: item.quantity,
        total: item.totalPrice,
        notes: null,
        modifiers: [],
      }));
  const payments = savedPayments !== null
    ? savedPayments.flatMap((value, index) => {
        const payment = record(value);
        if (!payment) return [];
        return [{
          key: `snapshot-payment-${index}`,
          method: receiptPaymentLabel(text(payment.method) ?? ""),
          amount: text(payment.amount) ?? "",
        }];
      })
    : (fallback.payments ?? []).map((payment) => ({
        key: payment.id,
        method: payment.method?.name ?? receiptPaymentLabel(payment.method?.code ?? ""),
        amount: payment.amount,
      }));
  return {
    orderNumber: text(saved?.displayOrderNumber) ?? text(saved?.orderNumber),
    items,
    payments,
  };
}
