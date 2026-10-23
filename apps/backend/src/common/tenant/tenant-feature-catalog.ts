export const TENANT_FEATURES = [
  { code: "CUSTOMER_WEB", name: "Mijozlar sayti", description: "Restoran menyusi va mijozlar uchun web sahifasi.", group: "Kanallar" },
  { code: "WEB_ORDERS", name: "Saytdan online buyurtma", description: "Sayt orqali buyurtma berish va checkout.", group: "Kanallar" },
  { code: "TELEGRAM_ORDERS", name: "Telegram buyurtmalari", description: "Telegram bot orqali menyu va buyurtmalar.", group: "Kanallar" },
  { code: "INVENTORY", name: "Ombor va retseptlar", description: "Ombor qoldig‘i, kirim-chiqim va retseptlar.", group: "Ish jarayonlari" },
  { code: "KITCHEN_DISPLAY", name: "Oshxona paneli", description: "Oshxona buyurtmalari navbati va holatlari.", group: "Ish jarayonlari" },
  { code: "TV_DISPLAY", name: "Televizor rejimi", description: "Oshxona panelini katta ekran va masofadan o‘qishga mos ko‘rsatish.", group: "Ish jarayonlari" },
  { code: "DELIVERY", name: "Yetkazib berish", description: "Yetkazib berish, kuryer va manzil oqimlari.", group: "Ish jarayonlari" },
  { code: "TABLE_SERVICE", name: "Zal va ofitsiant", description: "Zal stollari va ofitsiant buyurtmalari.", group: "Ish jarayonlari" },
  { code: "MULTI_BRANCH", name: "Bir nechta filial", description: "Bitta restoran ostida qo‘shimcha filiallar.", group: "Tashkilot" },
] as const;

export type TenantFeatureCode = (typeof TENANT_FEATURES)[number]["code"];
export const TENANT_FEATURE_CODES = TENANT_FEATURES.map(({ code }) => code);
export const DEFAULT_NEW_TENANT_FEATURES: TenantFeatureCode[] = ["KITCHEN_DISPLAY", "TABLE_SERVICE"];

export function isTenantFeatureCode(value: string): value is TenantFeatureCode {
  return TENANT_FEATURE_CODES.includes(value as TenantFeatureCode);
}
