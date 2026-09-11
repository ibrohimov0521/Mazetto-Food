export type TrackedOrder = {
  status: string;
  type: string;
  order?: { status?: string };
};

export function trackingStatus(value: TrackedOrder): string {
  const status = value.order?.status ?? value.status;
  return status === "COOKING" ? "PREPARING" : status === "ACCEPTED" ? "CONFIRMED" : status;
}

export function trackingLabel(status: string, type: string): string {
  if (status === "SERVED") return type === "DELIVERY" ? "Kuryer yo'lda" : "Topshirildi";
  if (status === "COMPLETED") return type === "DELIVERY" ? "Yetkazildi" : "Yakunlandi";
  return ({
    NEW: "Yangi buyurtma",
    CONFIRMED: "Qabul qilindi",
    PREPARING: "Tayyorlanmoqda",
    READY: "Tayyor",
    CANCELLED: "Bekor qilindi",
  } as Record<string, string>)[status] ?? "Holat tekshirilmoqda";
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

/*
 * TO'LOV HOLATI mijoz tilida.
 *
 * Ilgari buyurtma sahifasida xom enum ko'rsatilardi ("PENDING"), va
 * to'lov yozuvi yo'q naqd buyurtmada "To'lov ma'lumoti hali
 * biriktirilmagan" deb yozilardi — mijoz buni muammo deb o'qirdi,
 * holbuki naqd buyurtmada bu normal holat.
 */
export function paymentStatusLabel(status: string): string {
  return (
    {
      PENDING: "Kutilmoqda",
      SUCCESS: "To'langan",
      PAID: "To'langan",
      FAILED: "O'tmadi",
      REFUNDED: "Qaytarilgan",
    } as Record<string, string>
  )[status] ?? "Holat aniqlanmadi";
}
