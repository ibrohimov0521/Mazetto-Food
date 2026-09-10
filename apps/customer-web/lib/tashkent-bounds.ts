/*
 * Toshkent SHAHRI chegara qutisi — backend'dagi
 * `apps/backend/src/modules/customers/tashkent-bounds.ts` NUSXASI.
 *
 * Nima uchun nusxa: `packages/*` workspace'ga ulanmagan (pnpm-workspace.yaml
 * faqat `apps/*` ni oladi) va bitta konstanta uchun paket ko'tarish qimmat.
 * Ikki nusxa bir xilligini `validate-tashkent-bounds` skripti tekshiradi —
 * raqamlar ajralib qolsa CI yiqiladi.
 *
 * TARIX: eski quti 41.45 / 69.5 edi va Toshkent VILOYATI hamda Saryog'och
 * (QOZOG'ISTON) hududiga chiqib ketardi. Bu — Toshkent SHAHRI.
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
 * Brauzerdagi tekshiruv faqat QULAYLIK uchun — foydalanuvchi zonadan
 * tashqariga bosganda darhol aytadi. Haqiqiy majburlash serverda
 * (`normalizeDeliveryLocation`), chunki bu tekshiruvni chetlab o'tish oson.
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

/** Leaflet `maxBounds` formati: [[latMin, lngMin], [latMax, lngMax]]. */
export const TASHKENT_LEAFLET_BOUNDS: [[number, number], [number, number]] = [
  [TASHKENT_BOUNDS.latMin, TASHKENT_BOUNDS.lngMin],
  [TASHKENT_BOUNDS.latMax, TASHKENT_BOUNDS.lngMax],
];

export const OUTSIDE_TASHKENT_MESSAGE =
  "Hozircha faqat Toshkent shahri bo'ylab yetkazib beramiz. Xaritadan shahar ichidagi manzilni tanlang.";
