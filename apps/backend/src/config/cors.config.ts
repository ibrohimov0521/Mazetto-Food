/*
 * Ruxsat etilgan Origin'lar — YAGONA manba.
 *
 * MUAMMO (PHASE 6 H12). Bu ro'yxat ikki joyda, bayt-baytiga bir xil holda
 * takrorlangan edi: `main.ts` (HTTP CORS) va `kitchen.gateway.ts` (WebSocket
 * CORS). Ikkalasi ham kodga qattiq yozilgan, ya'ni yangi domen qo'shish uchun
 * kod o'zgarishi va redeploy kerak bo'lardi — va biri yangilanib ikkinchisi
 * ortda qolishi hech narsa bilan ushlanmasdi.
 *
 * Endi ro'yxat `CORS_ORIGIN` env'idan keladi (vergul bilan ajratilgan).
 * Berilmasa ishlab chiqishga mo'ljallangan default ishlatiladi — hozirgi
 * ishlab chiqarish qiymatlari bilan bir xil, ya'ni bu o'zgarish xatti-harakatni
 * o'zgartirmaydi.
 */

const DEVELOPMENT_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://mazettofood.uz",
  "https://www.mazettofood.uz",
  "https://pos.mazettofood.uz",
] as const;

export function getAllowedOrigins(): string[] {
  const configured = process.env.CORS_ORIGIN?.trim();

  if (!configured) {
    return [...DEVELOPMENT_ORIGINS];
  }

  const origins = configured
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

  if (origins.length === 0) {
    throw new Error("CORS_ORIGIN must list at least one origin");
  }

  // `*` ataylab qo'llab-quvvatlanmaydi: ikkala qatlam ham `credentials: true`
  // bilan ishlaydi va brauzerlar wildcard'ni credential bilan rad etadi —
  // ya'ni u ishlayotgandek ko'rinib, aslida hamma so'rovni buzardi.
  if (origins.includes("*")) {
    throw new Error("CORS_ORIGIN cannot be '*' while credentials are enabled");
  }

  return origins;
}
