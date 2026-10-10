/*
 * TO'LOV HOLATI mijoz tilida, jumladan qisman qaytarilgan to'lovlar uchun.
 */
export { paymentStatusLabel } from "./payment-status-label.mjs";

export type TrackedOrder = {
  status: string;
  type: string;
  order?: { status?: string };
};

export function trackingStatus(value: TrackedOrder): string {
  const status = value.order?.status ?? value.status;
  return status === "COOKING" ? "PREPARING" : status === "ACCEPTED" ? "CONFIRMED" : status;
}

export function trackingLabel(status: string, type: string, locale = "uz"): string {
  const ru = locale === "ru";
  if (status === "SERVED") return type === "DELIVERY" ? (ru ? "Курьер в пути" : "Kuryer yo'lda") : (ru ? "Выдан" : "Topshirildi");
  if (status === "COMPLETED") return type === "DELIVERY" ? (ru ? "Доставлен" : "Yetkazildi") : (ru ? "Завершён" : "Yakunlandi");
  const labels = ru
    ? { NEW: "Новый заказ", CONFIRMED: "Принят", PREPARING: "Готовится", READY: "Готов", CANCELLED: "Отменён" }
    : { NEW: "Yangi buyurtma", CONFIRMED: "Qabul qilindi", PREPARING: "Tayyorlanmoqda", READY: "Tayyor", CANCELLED: "Bekor qilindi" };
  return (labels as Record<string, string>)[status] ?? (ru ? "Статус уточняется" : "Holat tekshirilmoqda");
}

export function orderTypeLabel(type: string, locale = "uz"): string {
  const ru = locale === "ru";
  if (type === "DELIVERY") return ru ? "Доставка" : "Yetkazib berish";
  if (type === "PICKUP") return ru ? "Самовывоз" : "Olib ketish";
  return type;
}

export function paymentMethodLabel(method: string | null | undefined, locale = "uz"): string {
  const ru = locale === "ru";
  if (!method) return ru ? "Не указано" : "Ko'rsatilmagan";
  if (method === "CASH") return ru ? "Наличные" : "Naqd";
  if (method === "CLICK") return "Click";
  if (method === "PAYME") return "Payme";
  if (method === "CARD") return ru ? "Карта" : "Karta";
  return method;
}

/*
 * HOLAT RANGI — bitta manba.
 *
 * Ilgari mijoz saytida bekor qilinmagan HAMMA holat bir xil sariq chip
 * bilan chizilardi: "Yangi" va "Yetkazildi" bir xil ko'rinardi, ya'ni
 * rang hech qanday ma'lumot bermasdi. Dizayn qoidasi esa sariqni
 * "kutilmoqda / e'tibor", yashilni "yakunlandi", qizilni "bekor" uchun
 * belgilaydi.
 *
 * `progress` uchun teal olinadi (sariq emas), chunki sariq asosiy
 * harakat va narx rangi — uni faol holatlarga ham berish CTA'ni
 * ko'rinmas qilib qo'yardi.
 */
export type TrackingTone = "pending" | "progress" | "done" | "cancelled";

export function trackingTone(status: string): TrackingTone {
  if (status === "CANCELLED") return "cancelled";
  if (status === "COMPLETED") return "done";
  if (status === "NEW") return "pending";
  return "progress";
}
