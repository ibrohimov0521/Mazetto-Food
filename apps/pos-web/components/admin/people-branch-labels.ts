import { roleLabels, type MazettoRole } from "../../lib/auth";

/*
 * Enum → o'zbekcha yorliq.
 *
 * MUAMMO. Odamlar, filiallar va sozlamalar ekranlarida backend enum'lari
 * FOYDALANUVCHIGA TO'G'RIDAN-TO'G'RI ko'rsatilardi: `CANONICAL`, `SUPER_ADMIN`,
 * `THERMAL`, `OFFLINE`, `STAFF_ROLE_CHANGED`, `PAYME`. Admin panelni
 * sozlayotgan odam bu kodlarni bilishi shart emas — u lavozim, holat va
 * qurilma turini o'z tilida o'qishi kerak.
 *
 * QOIDA: yorliq TOPILMASA kod o'zi qaytariladi. Backend reestrga yangi qiymat
 * qo'shsa ekran buzilmaydi — shunchaki tarjimasiz chiqadi va bu yerga
 * qo'shilishi kerakligi ko'rinadi.
 *
 * Bu fayl FAQAT ko'rsatish qatlami. Hech qayerda enum qiymati o'rniga
 * yorliq YUBORILMAYDI.
 */

/** Rol kodi → lavozim nomi. `lib/auth.ts` dagi yagona manbadan. */
export function roleCodeLabel(code: string): string {
  return code in roleLabels ? roleLabels[code as MazettoRole] : code;
}

/*
 * Mahsulot katalog ko'rinishi.
 *
 * `CANONICAL` mijoz saytida ko'rinadigan ommaviy menyu, `LEGACY` eski
 * import qatorlari, `INTERNAL` faqat kassa ichida ishlatiladigan pozitsiya.
 */
export const catalogVisibilityLabels: Record<string, string> = {
  CANONICAL: "Ommaviy menyu",
  LEGACY: "Arxiv",
  INTERNAL: "Faqat ichki",
};

export function catalogVisibilityLabel(value: string): string {
  return catalogVisibilityLabels[value] ?? value;
}

/** Printer turi (Prisma `PrinterType`). */
export const printerTypeLabels: Record<string, string> = {
  THERMAL: "Termal (chek)",
  RECEIPT: "Chek printeri",
  KITCHEN: "Oshxona printeri",
  BAR: "Bar printeri",
  A4: "A4 hujjat printeri",
  OTHER: "Boshqa",
};

export function printerTypeLabel(value: string): string {
  return printerTypeLabels[value] ?? value;
}

/*
 * Printer holati (Prisma `PrinterStatus`).
 *
 * MUHIM: bu holat QO'LDA belgilanadi. Tizim printerga ulanmaydi va uni
 * so'roqlamaydi, shuning uchun yorliqlar "ulangan" demaydi — "ishlayapti
 * deb belgilangan" deydi. Aks holda admin panel bajarmaydigan narsani
 * da'vo qilardi.
 */
export const printerStatusLabels: Record<string, string> = {
  ONLINE: "Ishlayapti deb belgilangan",
  OFFLINE: "O'chirilgan deb belgilangan",
  ERROR: "Nosoz deb belgilangan",
};

export function printerStatusLabel(value: string): string {
  return printerStatusLabels[value] ?? value;
}

/** To'lov usuli kodi (`customer_payment_methods` sozlamasi). */
export const paymentMethodLabels: Record<string, string> = {
  CASH: "Naqd pul",
  CARD: "Bank kartasi (terminal)",
  CLICK: "Click",
  PAYME: "Payme",
};

export function paymentMethodLabel(value: string): string {
  return paymentMethodLabels[value] ?? value;
}

/** Smena turi (Prisma `ShiftType`) — kassa smenasi yoki kuryer smenasi. */
export const shiftTypeLabels: Record<string, string> = {
  CASHIER: "Kassa smenasi",
  COURIER: "Kuryer smenasi",
};

export function shiftTypeLabel(value: string): string {
  return shiftTypeLabels[value] ?? value;
}

/** Xodim yozuvi holati (Prisma `EmployeeStatus`). */
export const employeeStatusLabels: Record<string, string> = {
  ACTIVE: "Ishlayapti",
  SUSPENDED: "To'xtatilgan",
  TERMINATED: "Ishdan ketgan",
};

export function employeeStatusLabel(value: string): string {
  return employeeStatusLabels[value] ?? value;
}

/*
 * Audit jurnali obyektlari.
 *
 * `entity` qiymatlari backend'da erkin satr (`AuditLog.entity`), shuning
 * uchun ro'yxat to'liq emas — noma'lum qiymat o'zi ko'rsatiladi.
 */
export const auditEntityLabels: Record<string, string> = {
  User: "Xodim akkaunti",
  Staff: "Xodim",
  Employee: "Xodim yozuvi",
  Role: "Rol",
  Branch: "Filial",
  Setting: "Sozlama",
  Order: "Buyurtma",
  Shift: "Smena",
  Payment: "To'lov",
  Product: "Mahsulot",
  Printer: "Printer",
};

export function auditEntityLabel(value: string): string {
  return auditEntityLabels[value] ?? value;
}

/*
 * Audit amallari.
 *
 * To'liq ro'yxat emas va bo'lishi ham mumkin emas: `StaffService` va boshqa
 * servislar yangi amal nomini qo'shishi mumkin. Shuning uchun aniq mos
 * kelmagan qiymat UMUMIY qoida bilan o'qiladigan holga keltiriladi —
 * `STAFF_ROLE_CHANGED` → `Staff role changed` emas, balki obyekt + fe'l
 * ko'rinishida, kod esa yonida ko'rsatiladi (audit uchun kod MUHIM).
 */
const auditActionLabels: Record<string, string> = {
  STAFF_CREATED: "Xodim yaratildi",
  STAFF_UPDATED: "Xodim ma'lumoti o'zgartirildi",
  STAFF_ROLE_CHANGED: "Xodim roli o'zgartirildi",
  STAFF_BLOCKED: "Xodim bloklandi",
  STAFF_UNBLOCKED: "Xodim blokdan chiqarildi",
  STAFF_ACTIVATED: "Xodim faollashtirildi",
  STAFF_DEACTIVATED: "Xodim faolsizlantirildi",
  STAFF_PASSWORD_RESET: "Parol reset qilindi",
  STAFF_PASSWORD_CHANGED: "Xodim parolini o'zgartirdi",
  SETTING_UPDATED: "Sozlama o'zgartirildi",
  BRANCH_CREATED: "Filial yaratildi",
  BRANCH_UPDATED: "Filial o'zgartirildi",
  LOGIN_SUCCESS: "Muvaffaqiyatli kirish",
  LOGIN_FAILED: "Muvaffaqiyatsiz kirish urinishi",
  LOGOUT: "Chiqish",
};

export function auditActionLabel(value: string): string {
  return auditActionLabels[value] ?? value;
}

/** Yorliq topilgan bo'lsa kodni ham ko'rsatish kerak (audit izi uchun). */
export function hasAuditActionLabel(value: string): boolean {
  return value in auditActionLabels;
}
