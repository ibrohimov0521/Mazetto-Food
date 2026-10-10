/*
 * Bu ro'yxat faqat TypeScript kodlarini cheklaydi. Kassadagi amaldagi
 * tanlov API'dan, PaymentMethod yozuvlari va tenant sozlamasidan keladi.
 * CLICK/PAYME uchun avtomatik bank callback yo'q: kassir tushumni o'zi
 * tekshirganidan keyin usulni tanlashi kerak.
 */

export const POS_PAYMENT_METHOD_CODES = [
  "CASH",
  "CARD",
  "UZCARD",
  "HUMO",
  "CLICK",
  "PAYME",
  "ONLINE",
] as const;

export type PaymentMethodCode = (typeof POS_PAYMENT_METHOD_CODES)[number];

/** Kassir ekranida xom kod ("UZCARD") emas, odam o'qiydigan nom ko'rinadi. */
const paymentMethodNames: Record<string, string> = {
  CASH: "Naqd pul",
  CARD: "Bank kartasi",
  UZCARD: "Uzcard",
  HUMO: "Humo",
  CLICK: "Click",
  PAYME: "Payme",
  ONLINE: "Onlayn to'lov",
};

export function paymentMethodLabel(code: string): string {
  return (
    (paymentMethodNames as Record<string, string | undefined>)[code] ?? code
  );
}
