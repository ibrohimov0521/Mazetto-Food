import { Prisma } from "@prisma/client";

/*
 * Yetkazish masofasi.
 *
 * NIMA UCHUN HAVERSINE, YO'L MARSHRUTI EMAS:
 *
 * Haversine — ikki nuqta orasidagi TO'G'RI CHIZIQ. Haqiqiy yo'l undan
 * uzunroq (Toshkentda odatda 1.2–1.4 barobar). Lekin bu raqam narx
 * hisoblash uchun emas — kuryerga "qaysi buyurtma yaqinroq" degan tartibni
 * berish uchun, va bu maqsadda to'g'ri chiziq tartibi yo'l masofasi
 * tartibi bilan deyarli har doim mos keladi.
 *
 * Yo'l marshruti (OSRM) tashqi xizmatga so'rov, ya'ni sekin, uzilishi
 * mumkin va har buyurtma uchun alohida chaqiriladi. Haversine esa bir
 * necha mikrosoniya va HECH QACHON ishlamay qolmaydi. Marshrut
 * optimizatsiyasi kerak bo'lganda OSRM shu funksiya o'rniga qo'yiladi —
 * chaqiruvchilar o'zgarmaydi.
 */

/** Yer radiusi, kilometr. */
const EARTH_RADIUS_KM = 6371;

export type Coordinate = { latitude: number; longitude: number };

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Ikki nuqta orasidagi to'g'ri chiziq masofasi, kilometrda.
 * Koordinata yaroqsiz bo'lsa `null`.
 */
export function haversineKm(from: Coordinate, to: Coordinate): number | null {
  if (
    !Number.isFinite(from.latitude) ||
    !Number.isFinite(from.longitude) ||
    !Number.isFinite(to.latitude) ||
    !Number.isFinite(to.longitude)
  ) {
    return null;
  }

  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  /*
   * `atan2` ATAYLAB `asin` emas: juda uzoq nuqtalarda suzuvchi nuqta
   * xatosi `a` ni 1 dan biroz kattaroq qilishi mumkin va `asin` NaN
   * qaytarardi. `atan2` bunday holatda ham barqaror.
   */
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Prisma `Decimal?` ni raqamga aylantiradi; bo'sh bo'lsa `null`. */
export function decimalToNumber(
  value: Prisma.Decimal | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * `Order.deliveryLocation` JSON ustunidan koordinatani oladi.
 *
 * Ustun `Json?` bo'lgani uchun tipi kafolatlanmaydi: eski qatorlarda
 * koordinatasiz manzil bo'lishi mumkin (xarita qo'shilishidan oldingi
 * buyurtmalar), shuning uchun har maydon alohida tekshiriladi.
 */
export function coordinateFromJson(value: unknown): Coordinate | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const latitude = Number(record.latitude);
  const longitude = Number(record.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

/**
 * Filialdan yetkazish nuqtasigacha masofa, bitta kasr bilan yaxlitlangan.
 *
 * Yaxlitlash ATAYLAB: `2.3 km` foydali, `2.2847284 km` esa aniqlik haqida
 * yolg'on da'vo — bu to'g'ri chiziq, yo'l masofasi emas.
 */
export function deliveryDistanceKm(
  branch: { latitude: Prisma.Decimal | null; longitude: Prisma.Decimal | null },
  deliveryLocation: unknown,
): number | null {
  const branchLat = decimalToNumber(branch.latitude);
  const branchLng = decimalToNumber(branch.longitude);
  if (branchLat === null || branchLng === null) return null;

  const destination = coordinateFromJson(deliveryLocation);
  if (!destination) return null;

  const km = haversineKm(
    { latitude: branchLat, longitude: branchLng },
    destination,
  );
  return km === null ? null : Math.round(km * 10) / 10;
}
