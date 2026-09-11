/*
 * POS to'lov usullari — YAGONA manba (single source of truth).
 *
 * MUHIM: backendda filialning sozlangan to'lov usullarini qaytaradigan
 * endpoint HOZIRCHA YO'Q. `payments.controller.ts` da faqat
 * `GET /payments`, `POST /payments` va `POST /payments/process` bor,
 * va butun backend bo'ylab `paymentMethod.findMany` hech qayerda
 * chaqirilmaydi — `PaymentMethod` jadvali faqat
 * `PaymentsService.resolvePaymentMethod` ichida `findFirst` bilan
 * kod/id bo'yicha yechiladi.
 *
 * Shuning uchun ro'yxat shu yerda saqlanadi va u
 * `apps/backend/prisma/seed.ts` dagi `paymentMethods` seed'i bilan
 * BIR XIL bo'lishi shart. Aks holda `resolvePaymentMethod`
 * "Active payment method not found" (404) qaytaradi.
 *
 * `docs/POS_SPEC.md` boshqacha ro'yxat sanaydi (TERMINAL, RAHMAT,
 * CORPORATE_CARD, OTHER) — ular seed qilinmagan, shuning uchun bu yerga
 * qo'shilmadi: tanlash mumkin bo'lgan, lekin serverda mavjud bo'lmagan
 * usul kassirga faqat xato ko'rsatardi.
 *
 * `GET /payments/methods` qo'shilganda faqat shu fayl o'zgaradi.
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
const paymentMethodNames: Record<PaymentMethodCode, string> = {
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

/** Naqd pul uchun tez tanlash nominallari (so'm). */
export const CASH_DENOMINATIONS = [
  1000, 5000, 10000, 20000, 50000, 100000, 200000,
] as const;
