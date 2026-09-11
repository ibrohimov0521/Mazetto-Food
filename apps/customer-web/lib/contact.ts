/*
 * ALOQA MA'LUMOTLARI — bitta manba.
 *
 * Ilgari raqam va havolalar `contact-footer.tsx` ichida to'g'ridan-to'g'ri
 * yozilgan edi. Buyurtma sahifalariga ham qo'llab-quvvatlash aloqasi
 * qo'shilishi kerak (mijoz buyurtmasi bilan muammo chiqsa, sahifada
 * hech qanday yo'l yo'q edi), shuning uchun ular shu yerga chiqarildi.
 */

import { formatPhone, normalizePhone } from "./phone";

/*
 * DIQQAT — RAQAM TEKSHIRILISHI KERAK.
 *
 * Kodda yozilgan qiymat `+998 95 855 406` bo'lib, `+998` dan keyin
 * ATIGI 8 raqam bor. O'zbekiston mobil raqami 9 raqamdan iborat, ya'ni
 * bu raqam noto'g'ri va `tel:` havolasi hech kimga ulanmaydi.
 *
 * To'g'ri raqam ma'lum bo'lmagani uchun o'ylab topilmadi: noto'g'ri
 * to'ldirilgan raqam begona odamga qo'ng'iroq qilinishiga olib kelardi.
 * Egasi tasdiqlagach shu yerda bitta joyda tuzatiladi.
 *
 * `isSupportPhoneValid` shuning uchun bor: raqam yaroqsiz bo'lsa
 * interfeys `tel:` havolasini ko'rsatmaydi va o'zini ishlaydigan
 * qilib ko'rsatmaydi.
 */
const supportPhoneRaw = "+99895855406";

export const supportPhone = {
  raw: supportPhoneRaw,
  /** Yaroqli bo'lsa `+998 XX XXX XX XX`, aks holda xom qiymat. */
  display: formatPhone(supportPhoneRaw),
  /** `tel:` uchun normallashtirilgan qiymat yoki `null`. */
  href: normalizePhone(supportPhoneRaw),
};

export const isSupportPhoneValid = supportPhone.href !== null;

export const supportLinks = {
  instagram: "https://www.instagram.com/mazetto_food",
  telegram: "https://t.me/MAZETTO_FOOD",
};
