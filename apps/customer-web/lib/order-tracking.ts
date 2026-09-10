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
