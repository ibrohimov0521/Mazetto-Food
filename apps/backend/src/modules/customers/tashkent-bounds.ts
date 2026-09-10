/*
 * Toshkent SHAHRI chegara qutisi — yetkazib berish zonasi uchun yagona manba.
 *
 * TARIX (QueenFood `packages/types/src/index.ts:70-73` dan): eski quti
 * 41.45 / 69.5 edi va u Toshkent VILOYATI hamda Saryog'ochgacha —
 * ya'ni QOZOG'ISTON hududiga chiqib ketardi. Kuryer bora olmaydigan joyga
 * buyurtma qabul qilinardi. Quyidagi raqamlar Toshkent SHAHRI, viloyat emas.
 *
 * Raqamlarni o'zgartirsangiz `apps/customer-web/lib/tashkent-bounds.ts` dagi
 * nusxani ham o'zgartiring — `validate-tashkent-bounds` skripti ikkalasi bir
 * xilligini tekshiradi va farq qilsa CI yiqiladi.
 */
export const TASHKENT_BOUNDS = {
  latMin: 41.18,
  latMax: 41.4,
  lngMin: 69.13,
  lngMax: 69.42,
} as const;

/** Toshkent markazi — xarita ochilganda ko'rsatiladigan nuqta. */
export const TASHKENT_CENTER = {
  latitude: 41.3111,
  longitude: 69.2797,
} as const;

/**
 * Tez, oflayn birinchi qatlam. Ikkinchi qatlam (reverse geocode) C2 da keladi;
 * u aniqroq, lekin tashqi xizmatga bog'liq, shuning uchun bu tekshiruv
 * har doim birinchi ishlaydi va hech qachon tashqi xizmatni kutmaydi.
 */
export function isWithinTashkent(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= TASHKENT_BOUNDS.latMin &&
    latitude <= TASHKENT_BOUNDS.latMax &&
    longitude >= TASHKENT_BOUNDS.lngMin &&
    longitude <= TASHKENT_BOUNDS.lngMax
  );
}

/**
 * Nominatim `viewbox` parametri uchun format: lngMin,latMin,lngMax,latMax.
 * C2 dagi geokodlash proxy `bounded=1` bilan birga ishlatadi.
 */
export function tashkentViewbox(): string {
  const { lngMin, latMin, lngMax, latMax } = TASHKENT_BOUNDS;
  return `${lngMin},${latMin},${lngMax},${latMax}`;
}
