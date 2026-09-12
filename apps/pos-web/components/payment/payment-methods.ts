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
 *
 * EGASINING QARORI: hozircha FAQAT NAQD ishlaydi, keyinchalik Click va
 * Payme qo'shiladi. Seed'da `CARD`, `UZCARD`, `HUMO`, `ONLINE` ham bor,
 * lekin ular amalda ishlatilmaydi — kassirga tanlash mumkin, lekin
 * hech kim qabul qilmaydigan usulni ko'rsatish faqat xatoga olib
 * kelardi. Ishga tushganda kodni `POS_PAYMENT_METHOD_CODES` ga
 * qo'shish kifoya, boshqa hech narsa o'zgartirilmaydi.
 */

export const POS_PAYMENT_METHOD_CODES = ["CASH"] as const;

/*
 * Rejada bor, lekin hali ishga tushmagan usullar. Kassa ekranida
 * KO'RSATILMAYDI — bu ro'yxat faqat hujjat: yuqoridagi massivga
 * qo'shilishi kerak bo'lgan kodlar.
 */
export const POS_PLANNED_PAYMENT_METHOD_CODES = ["CLICK", "PAYME"] as const;

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

/** Naqd pul uchun tez tanlash nominallari (so'm). */
export const CASH_DENOMINATIONS = [
  1000, 5000, 10000, 20000, 50000, 100000, 200000,
] as const;
