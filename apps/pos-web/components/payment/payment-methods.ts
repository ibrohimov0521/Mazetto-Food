/*
 * Kod va nomlar tarixiy to'lovlarni o'qish uchun saqlanadi. Yangi to'lovlarda
 * faqat CASH mavjud; backend va kassadagi tanlov buni majburiy qiladi.
 */

export type PaymentMethodCode =
  | "CASH"
  | "CARD"
  | "UZCARD"
  | "HUMO"
  | "CLICK"
  | "PAYME"
  | "ONLINE";

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
