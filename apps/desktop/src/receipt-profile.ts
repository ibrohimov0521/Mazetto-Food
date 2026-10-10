export const receiptKinds = ["RECEIPT", "KITCHEN", "CANCELLATION", "REFUND"] as const;

export type ReceiptKind = (typeof receiptKinds)[number];

export type ReceiptFieldKey =
  | "branchName"
  | "orderNumber"
  | "orderType"
  | "dateTime"
  | "customerName"
  | "customerPhone"
  | "address"
  | "itemPrices"
  | "itemModifiers"
  | "itemNotes"
  | "payments"
  | "total"
  | "orderNotes"
  | "reason";

export type ReceiptDocumentProfile = {
  title: string;
  titleEnabled: boolean;
  density: "COMPACT" | "NORMAL";
  businessName: string;
  businessNameEnabled: boolean;
  logoEnabled: boolean;
  fontSizePx: number;
  titleSizePx: number;
  lineHeight: number;
  fields: Record<ReceiptFieldKey, boolean>;
  headerLines: string[];
  footerLines: string[];
};

export type ReceiptPrintProfile = {
  schemaVersion: 2;
  businessName: string;
  commonHeaderLines: string[];
  commonFooterLines: string[];
  documents: Record<ReceiptKind, ReceiptDocumentProfile>;
};

const visibleFields: ReceiptFieldKey[] = [
  "branchName", "orderNumber", "orderType", "dateTime", "customerName",
  "customerPhone", "address", "itemPrices", "itemModifiers", "itemNotes",
  "payments", "total", "orderNotes", "reason",
];

function documentProfile(
  title: string,
  overrides: Partial<Record<ReceiptFieldKey, boolean>> = {},
): ReceiptDocumentProfile {
  const fields = Object.fromEntries(visibleFields.map((key) => [key, true])) as Record<ReceiptFieldKey, boolean>;
  Object.assign(fields, overrides);
  return {
    title, titleEnabled: true, density: "NORMAL",
    businessName: "MAZETTO FOOD", businessNameEnabled: true, logoEnabled: true,
    fontSizePx: 12, titleSizePx: 18, lineHeight: 1.3, fields, headerLines: [], footerLines: [],
  };
}

export function defaultReceiptPrintProfile(): ReceiptPrintProfile {
  return {
    schemaVersion: 2,
    businessName: "MAZETTO FOOD",
    commonHeaderLines: [],
    commonFooterLines: [],
    documents: {
      RECEIPT: {
        ...documentProfile("MIJOZ CHEKI", { reason: false }),
        businessNameEnabled: false,
        logoEnabled: false,
      },
      KITCHEN: documentProfile("OSHXONA BUYURTMASI", {
        customerName: false, customerPhone: false, address: false, itemPrices: false,
        payments: false, total: false, reason: false,
      }),
      CANCELLATION: documentProfile("BUYURTMA BEKOR QILINDI", { payments: false, total: false }),
      REFUND: documentProfile("TO'LOV QAYTARILDI", { itemPrices: false, reason: true }),
    },
  };
}

function safeText(value: unknown, fallback: string, maxLength = 100): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : fallback;
}

function safeLines(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((line) => safeText(line, "", 100)).filter(Boolean).slice(0, 5)
    : [];
}

function safeSize(value: unknown, fallback: number, min: number, max: number): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
}

function safeLineHeight(value: unknown, fallback: number): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.min(2, Math.max(1, number)) : fallback;
}

export function normalizeReceiptPrintProfile(value: unknown): ReceiptPrintProfile {
  const defaults = defaultReceiptPrintProfile();
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const documentsInput = input.documents && typeof input.documents === "object"
    ? input.documents as Record<string, unknown>
    : {};
  const documents = {} as Record<ReceiptKind, ReceiptDocumentProfile>;

  for (const kind of receiptKinds) {
    const fallback = defaults.documents[kind];
    const raw = documentsInput[kind] && typeof documentsInput[kind] === "object"
      ? documentsInput[kind] as Record<string, unknown>
      : {};
    const fieldsInput = raw.fields && typeof raw.fields === "object"
      ? raw.fields as Record<string, unknown>
      : {};
    const fields = { ...fallback.fields };
    for (const key of visibleFields) {
      if (typeof fieldsInput[key] === "boolean") fields[key] = fieldsInput[key] as boolean;
    }
    documents[kind] = {
      title: safeText(raw.title, fallback.title, 80),
      titleEnabled: typeof raw.titleEnabled === "boolean" ? raw.titleEnabled : fallback.titleEnabled,
      density: raw.density === "COMPACT" ? "COMPACT" : "NORMAL",
      businessName: safeText(raw.businessName, safeText(input.businessName, fallback.businessName, 80), 80),
      businessNameEnabled: typeof raw.businessNameEnabled === "boolean"
        ? raw.businessNameEnabled
        : typeof input.businessNameEnabled === "boolean"
          ? input.businessNameEnabled
          : fallback.businessNameEnabled,
      logoEnabled: typeof raw.logoEnabled === "boolean"
        ? raw.logoEnabled
        : typeof input.logoEnabled === "boolean"
          ? input.logoEnabled
          : fallback.logoEnabled,
      fontSizePx: safeSize(raw.fontSizePx, fallback.fontSizePx, 8, 24),
      titleSizePx: safeSize(raw.titleSizePx, fallback.titleSizePx, 10, 36),
      lineHeight: safeLineHeight(raw.lineHeight, fallback.lineHeight),
      fields,
      headerLines: safeLines(raw.headerLines),
      footerLines: safeLines(raw.footerLines),
    };
  }

  return {
    schemaVersion: 2,
    businessName: safeText(input.businessName, defaults.businessName, 80),
    commonHeaderLines: safeLines(input.commonHeaderLines),
    commonFooterLines: safeLines(input.commonFooterLines),
    documents,
  };
}

export function migrateStoredReceiptPrintProfile(value: unknown): ReceiptPrintProfile {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const profile = normalizeReceiptPrintProfile(input);
  if (typeof input.schemaVersion === "number" && input.schemaVersion >= 2) return profile;

  const documentsInput = input.documents && typeof input.documents === "object"
    ? input.documents as Record<string, unknown>
    : {};
  const rawReceipt = documentsInput.RECEIPT && typeof documentsInput.RECEIPT === "object"
    ? documentsInput.RECEIPT as Record<string, unknown>
    : {};
  const businessName = safeText(
    rawReceipt.businessName,
    safeText(input.businessName, "MAZETTO FOOD", 80),
    80,
  );
  const logoEnabled = typeof rawReceipt.logoEnabled === "boolean"
    ? rawReceipt.logoEnabled
    : typeof input.logoEnabled === "boolean" ? input.logoEnabled : true;
  const businessNameEnabled = typeof rawReceipt.businessNameEnabled === "boolean"
    ? rawReceipt.businessNameEnabled
    : typeof input.businessNameEnabled === "boolean" ? input.businessNameEnabled : true;

  if (businessName.toLocaleUpperCase() === "MAZETTO FOOD" && logoEnabled && businessNameEnabled) {
    profile.documents.RECEIPT.logoEnabled = false;
    profile.documents.RECEIPT.businessNameEnabled = false;
  }
  return profile;
}
