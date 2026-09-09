import type { Request } from "express";

/*
 * So'rovning HAQIQIY mijoz manzilini aniqlaydi.
 *
 * MUAMMO (PHASE 6 H1). Ilgari bu mantiq `cf-connecting-ip` va
 * `x-forwarded-for` ni SHARTSIZ o'qirdi. Bu ikkala header ham oddiy so'rov
 * header'i — ularni istalgan mijoz o'zi yozib yuborishi mumkin. Login
 * cheklovi kaliti shu manzilga bog'langani uchun har so'rovda tasodifiy
 * `X-Forwarded-For` yuborish har safar yangi, bo'sh bucket berardi va
 * manzil bo'yicha 5 urinishlik chegara amalda ishlamasdi.
 *
 * YECHIM. Header'ga faqat so'rov ISHONCHLI proxy'dan kelganda ishoniladi.
 * "Ishonchli" — `TRUSTED_PROXY_HOP_COUNT` bilan e'lon qilinadi:
 *
 *   0 (default) — hech qanday header'ga ishonilmaydi, TCP peer manzili
 *                 ishlatiladi. Lokal ishlab chiqish va proxy'siz deploy.
 *   N > 0       — backend oldida N ta ishonchli proxy turadi.
 *
 * Nega hop SONI, "true" emas: Express'ning `trust proxy: true` sozlamasi ham
 * butun XFF zanjiriga ishonadi, ya'ni bir xil zaiflikni qoldiradi. Zanjirning
 * eng chap qismini mijoz yozadi; ishonchli qismi faqat OXIRGI N ta yozuv.
 * Shuning uchun mijoz manzili `list[list.length - N]` da turadi.
 *
 * Ishlab chiqarish topologiyasi: Cloudflare -> Dokploy/Traefik -> backend,
 * ya'ni `TRUSTED_PROXY_HOP_COUNT=2`. Bu qiymat faqat origin to'g'ridan-to'g'ri
 * ochiq bo'lmaganda to'g'ri ishlaydi — aks holda hujumchi proxy'ni chetlab
 * o'tib o'z header'ini yuboradi.
 */

const UNKNOWN_ADDRESS = "unknown";

export function resolveClientAddress(request: Request): string {
  const hops = getTrustedProxyHopCount();

  if (hops === 0) {
    return normalize(request.socket.remoteAddress) ?? UNKNOWN_ADDRESS;
  }

  // Cloudflare o'zi qo'ygan header — zanjirdagi eng ishonchli qiymat, lekin
  // faqat so'rov haqiqatan Cloudflare orqali kelganda mavjud bo'ladi.
  const cloudflareIp = normalize(firstHeaderValue(request, "cf-connecting-ip"));

  if (cloudflareIp) {
    return cloudflareIp;
  }

  const forwarded = firstHeaderValue(request, "x-forwarded-for");

  if (forwarded) {
    const chain = forwarded
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    // Oxirgi N ta yozuvni ishonchli proxy'lar qo'shgan; mijoz manzili ulardan
    // oldingisi. Zanjir kutilganidan kalta bo'lsa eng chapdagisiga tushamiz.
    const clientIndex = Math.max(0, chain.length - hops);
    const candidate = normalize(chain[clientIndex]);

    if (candidate) {
      return candidate;
    }
  }

  return normalize(request.socket.remoteAddress) ?? UNKNOWN_ADDRESS;
}

function getTrustedProxyHopCount(): number {
  const raw = process.env.TRUSTED_PROXY_HOP_COUNT;

  if (!raw) {
    return 0;
  }

  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("TRUSTED_PROXY_HOP_COUNT must be a non-negative integer");
  }

  return parsed;
}

function firstHeaderValue(request: Request, name: string): string | undefined {
  const value = request.headers[name];

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0];
  }

  return undefined;
}

function normalize(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  // Node IPv4 ulanishlarni IPv6 ko'rinishida beradi (`::ffff:1.2.3.4`) —
  // bir xil mijoz ikki xil kalit hosil qilmasligi uchun qisqartiriladi.
  return trimmed.startsWith("::ffff:") ? trimmed.slice(7) : trimmed;
}
