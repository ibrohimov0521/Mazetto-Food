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
 * Egasidan tasdiqlangan qo'llab-quvvatlash raqami.
 *
 * Ilgari kodda `+99895855406` turardi — `+998` dan keyin 8 raqam, ya'ni
 * bitta raqam tushib qolgan va `tel:` havolasi hech qayerga ulanmasdi.
 * To'g'ri raqam egasi tomonidan berildi.
 *
 * `isSupportPhoneValid` saqlanadi: raqam kelgusida yana buzilsa,
 * interfeys ishlamaydigan havolani ko'rsatmaydi.
 */
const supportPhoneRaw = "+998958554060";

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

/*
 * FILIAL JOYLASHUVI — egasi bergan xarita havolalari.
 *
 * Ikkitasi ham beriladi, chunki O'zbekistonda Yandex Xaritalar keng
 * tarqalgan, lekin hamma unda emas. Foydalanuvchiga tanlash imkonini
 * berish "xaritam ochilmadi" muammosini butunlay yo'q qiladi.
 */
export const branchMapLinks = {
  google: "https://share.google/TkyFcp55Vyh3iD9TR",
  yandex: "https://yandex.uz/maps/-/CTtIEYkg",
};
