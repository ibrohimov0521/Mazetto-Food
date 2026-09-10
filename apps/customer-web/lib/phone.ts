/*
 * Telefon normalizatsiyasi — `apps/backend/src/modules/customers/customer-phone.ts`
 * dagi `normalizeCustomerPhone` NUSXASI, bir xil qoidalar bilan.
 *
 * Nima uchun frontendda ham kerak: mijoz "90 123 45 67", "+998901234567",
 * "998 90 123-45-67" — hammasini yozadi. Ilgari brauzer shaklni faqat
 * TEKSHIRARDI va xom satrni yuborardi; normallashtirishni server qilardi.
 * Natijada mijoz o'zi kiritgan raqam saqlangan raqamdan farq qilardi va
 * "raqamim noto'g'ri saqlanibdi" degan tushunmovchilik chiqardi.
 *
 * FARQ: bu yerda xato TASHLANMAYDI — `null` qaytadi. Brauzerda xato
 * tashlash shaklni buzardi; chaqiruvchi `null` ni "yaroqsiz" deb ko'rsatadi.
 *
 * Yakuniy tekshiruv baribir SERVERDA: bu funksiya faqat qulaylik va
 * ko'rinishni birxillashtirish uchun.
 */

const LOCAL_LENGTH = 9;
const COUNTRY_CODE = "998";
const INTERNATIONAL_LENGTH = COUNTRY_CODE.length + LOCAL_LENGTH;

/** `+998XXXXXXXXX` yoki yaroqsiz bo'lsa `null`. */
export function normalizePhone(phone: string): string | null {
  const trimmed = phone.trim();
  const hasInternationalPrefix = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");

  // Xalqaro "00" prefiksi "+" bilan bir xil ma'noda.
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.length === LOCAL_LENGTH) {
    digits = `${COUNTRY_CODE}${digits}`;
  }

  if (digits.length !== INTERNATIONAL_LENGTH || !digits.startsWith(COUNTRY_CODE)) {
    return null;
  }

  /*
   * "+" yozilgan bo'lsa, u AYNAN "+998" bo'lishi kerak. Aks holda "+7 998..."
   * kabi boshqa mamlakat raqami O'zbekiston raqamiga aylanib qolardi.
   */
  if (hasInternationalPrefix && !trimmed.replace(/[^\d+]/g, "").startsWith("+998")) {
    return null;
  }

  return `+${digits}`;
}

/** Ko'rsatish uchun: `+998 90 123 45 67`. */
export function formatPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  if (!normalized) return phone;
  const digits = normalized.slice(4); // "+998" dan keyingi 9 raqam
  return `+998 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7)}`;
}
