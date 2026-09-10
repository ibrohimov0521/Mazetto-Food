export function orderStatusLabel(status: string, type?: string): string {
  if (status === "SERVED") return type === "DELIVERY" ? "🚴 Kuryer yo'lda" : "🤝 Topshirildi";
  if (status === "COMPLETED") return type === "DELIVERY" ? "✅ Yetkazildi" : "✅ Yakunlandi";
  return ({
    NEW: "🧾 Yangi buyurtma",
    CONFIRMED: "✅ Qabul qilindi",
    PREPARING: "👨‍🍳 Tayyorlanmoqda",
    COOKING: "👨‍🍳 Tayyorlanmoqda",
    READY: "📦 Tayyor",
    CANCELLED: "❌ Bekor qilindi",
  } as Record<string, string>)[status] ?? "Holat tekshirilmoqda";
}
