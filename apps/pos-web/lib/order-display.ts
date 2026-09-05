/*
 * Buyurtma ma'lumotlarini ko'rsatish uchun umumiy yordamchilar.
 * Admin buyurtmalar, online buyurtmalar va smena ekranlari shuni ishlatadi.
 */

import type { BadgeTone } from "../components/admin-ui/badge";

export type OrderStatus =
  | "NEW"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "SERVED"
  | "COMPLETED"
  | "CANCELLED";

export type OrderType = "DINE_IN" | "TAKEAWAY" | "DELIVERY";

export type PaymentStatus =
  | "PENDING"
  | "SUCCESS"
  | "PAID"
  | "FAILED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED";

export type OrderSource = "WEB" | "TELEGRAM" | "POS";

export const orderStatusLabels: Record<OrderStatus, string> = {
  NEW: "Yangi",
  CONFIRMED: "Tasdiqlangan",
  PREPARING: "Tayyorlanmoqda",
  READY: "Tayyor",
  SERVED: "Berildi",
  COMPLETED: "Yakunlangan",
  CANCELLED: "Bekor qilingan",
};

export const orderTypeLabels: Record<OrderType, string> = {
  DINE_IN: "Zalda",
  TAKEAWAY: "Olib ketish",
  DELIVERY: "Yetkazib berish",
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  PENDING: "Kutilmoqda",
  SUCCESS: "To'langan",
  PAID: "To'langan",
  FAILED: "Muvaffaqiyatsiz",
  REFUNDED: "Qaytarilgan",
  PARTIALLY_REFUNDED: "Qisman qaytarilgan",
};

export const orderSourceLabels: Record<OrderSource, string> = {
  WEB: "Sayt",
  TELEGRAM: "Telegram",
  POS: "Kassa",
};

/*
 * DESIGN_RULES rang semantikasi:
 *   yashil = tugallangan/muvaffaqiyat · teal(info) = jarayonda/ma'lumot
 *   qizil  = FAQAT bekor qilingan/xato · sariq = kutilmoqda/diqqat
 */
export function orderStatusTone(status: OrderStatus): BadgeTone {
  switch (status) {
    case "COMPLETED":
    case "SERVED":
      return "success";
    case "CANCELLED":
      return "danger";
    case "NEW":
      return "warning";
    default:
      return "info";
  }
}

export function paymentStatusTone(status: PaymentStatus): BadgeTone {
  switch (status) {
    case "PAID":
    case "SUCCESS":
      return "success";
    case "FAILED":
      return "danger";
    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
      return "warning";
    default:
      return "neutral";
  }
}

const moneyFormatter = new Intl.NumberFormat("uz-UZ");
const dateTimeFormatter = new Intl.DateTimeFormat("uz-UZ", {
  dateStyle: "short",
  timeStyle: "short",
});

export function formatMoney(value: string | number | null | undefined): string {
  const numeric = typeof value === "number" ? value : Number(value ?? Number.NaN);

  return Number.isFinite(numeric) ? `${moneyFormatter.format(Math.round(numeric))} so'm` : "—";
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "—" : dateTimeFormatter.format(date);
}

/**
 * Telefon raqamini ro'yxatlarda qisman yashiradi.
 *
 * Ro'yxat ekranida to'liq raqam kerak emas — mijoz PII sini keraksiz
 * joyda ochiq ko'rsatmaslik uchun. Detal sahifasida to'liq ko'rsatiladi.
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) {
    return "—";
  }

  const trimmed = phone.trim();

  if (trimmed.length <= 4) {
    return trimmed;
  }

  return `${trimmed.slice(0, Math.max(4, trimmed.length - 6))}•••${trimmed.slice(-2)}`;
}
