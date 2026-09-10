/*
 * Ruxsat etilgan Origin'lar — YAGONA manba.
 *
 * MUAMMO. Bu ro'yxat ikki joyda, bayt-baytiga bir xil holda takrorlangan edi:
 * `main.ts` (HTTP CORS) va `kitchen.gateway.ts` (WebSocket CORS). Ikkalasi ham
 * kodga qattiq yozilgan, ya'ni biri yangilanib ikkinchisi ortda qolishi hech
 * narsa bilan ushlanmasdi.
 *
 * Endi ro'yxat `CORS_ORIGINS` env'idan keladi (vergul bilan ajratilgan).
 * Berilmasa quyidagi default ishlatiladi.
 */

export const defaultAllowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3100",
  "http://localhost:3001",
  "http://localhost:3200",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3100",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3200",
  "https://mazettofood.uz",
  "https://www.mazettofood.uz",
  "https://pos.mazettofood.uz",
];

export function resolveAllowedOrigins(configured = process.env.CORS_ORIGINS): string[] {
  if (!configured?.trim()) {
    return defaultAllowedOrigins;
  }

  const origins = configured
    .split(",")
    // Oxiridagi `/` olib tashlanadi: brauzer Origin sarlavhasini hech qachon
    // `/` bilan yubormaydi, ya'ni `https://example.com/` yozilgan qator
    // hech qachon mos kelmasdi va buni topish qiyin bo'lardi.
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

  if (origins.length === 0) {
    throw new Error("CORS_ORIGINS must list at least one origin");
  }

  /*
   * `*` ataylab qo'llab-quvvatlanmaydi.
   *
   * Ikkala qatlam ham `credentials: true` bilan ishlaydi va brauzerlar
   * wildcard'ni credential bilan rad etadi — ya'ni u sozlangandek ko'rinib,
   * aslida HAR BIR so'rovni buzardi.
   */
  if (origins.includes("*")) {
    throw new Error("CORS_ORIGINS cannot be '*' while credentials are enabled");
  }

  return origins;
}
