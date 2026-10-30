import { BadRequestException } from "@nestjs/common";

/*
 * Biznes sozlamalari reestri (7-bosqich Q1).
 *
 * IKKI QOIDA, ikkalasi ham QueenFood'ning `setting-rules.ts` idagi
 * qimmat darsdan olingan.
 *
 * 1. YOZISHDA tekshiriladi VA normallashtiriladi.
 *
 *    Saqlangan satrga ko'r-ko'rona ishonish jimgina buzadi: xato yozilgan
 *    boolean ("True") FALSE deb o'qiladi, raqam bo'lmagan int esa hech
 *    qanday xabarsiz hard-coded default'ga tushadi — UI esa axlatni
 *    "joriy qiymat" deb ko'rsatib turadi.
 *
 * 2. O'QISH kalitlari ham SHU reestrdan.
 *
 *    Aks holda xato yozilgan kalit abadiy fallback qaytaradi. Bu kill
 *    switch'lar uchun eng yomoni: biznes "o'chirdim" deb o'ylagan funksiya
 *    jimgina ishlab turadi va admin panel esa haqiqiy qatorni to'g'ri
 *    ko'rsatadi, ya'ni nosozlikni deyarli topib bo'lmaydi.
 *
 * `SettingKey` tipi reestrdan HOSIL QILINADI — bitta ro'yxat, ikkitasi emas.
 * Yangi sozlamani shu yerga qo'shish uni ham yoziladigan, ham o'qiladigan
 * qiladi.
 */

type SettingRule =
  | { kind: "int"; min: number; max: number; fallback: number }
  | { kind: "bool"; fallback: boolean }
  | { kind: "csv-enum"; values: readonly string[]; fallback: string }
  | { kind: "string"; fallback: string };

const CASHIER_PAYMENT_METHOD_CODES = ["CASH"] as const;

export type CashierPaymentMethodCode =
  (typeof CASHIER_PAYMENT_METHOD_CODES)[number];

export function isCashierPaymentMethodCode(
  code: string,
): code is CashierPaymentMethodCode {
  return (CASHIER_PAYMENT_METHOD_CODES as readonly string[]).includes(
    code.trim().toUpperCase(),
  );
}

const INT = (min: number, max: number, fallback: number): SettingRule => ({
  kind: "int",
  min,
  max,
  fallback,
});
const BOOL = (fallback: boolean): SettingRule => ({ kind: "bool", fallback });

/*
 * `satisfies` ATAYLAB — `Record<string, SettingRule>` annotatsiyasi emas.
 *
 * Annotatsiya kalit nomlarini `string` ga kengaytirib yuborardi va quyidagi
 * `SettingKey` union'ini hosil qilib bo'lmasdi.
 */
const SETTING_RULES = {
  // --- Mijoz tasdiqlash kodlari ---------------------------------------
  //
  // Bu to'rttasi kodda `customers.service.ts` va
  // `telegram-customer-auth.service.ts` da TAKRORLANGAN edi: biri
  // o'zgartirilsa ikkinchisi ortda qolardi va hech narsa ogohlantirmasdi.
  customer_code_ttl_minutes: INT(1, 60, 10),
  customer_code_attempt_limit: INT(1, 20, 5),
  customer_code_request_limit: INT(1, 20, 3),
  customer_code_request_window_seconds: INT(10, 3600, 60),

  // --- Login cheklovi --------------------------------------------------
  login_throttle_address_failures: INT(1, 100, 5),
  login_throttle_identifier_failures: INT(1, 200, 20),
  login_throttle_window_minutes: INT(1, 1440, 15),

  // --- Mijoz buyurtmasi ------------------------------------------------
  customer_order_attempt_ttl_hours: INT(1, 168, 24),
  telegram_checkout_session_ttl_minutes: INT(5, 1440, 60),
  telegram_menu_page_size: INT(3, 20, 8),
  // Personal Telegram notifications for order-receiving staff.
  // Defaults to off until the restaurant enables each recipient group.
  telegram_owner_telegram_user_id: {
    kind: "string",
    fallback: "",
  },
  telegram_owner_order_notifications_enabled: BOOL(false),
  telegram_cashier_order_notifications_enabled: BOOL(false),
  telegram_courier_order_notifications_enabled: BOOL(false),

  // --- Mijozga ochiq ---------------------------------------------------
  //
  // Mijoz tomoni to'lov usullarini O'ZI hal qilmaydi — server yagona manba.
  // Hozir faqat naqd to'lov qabul qilinadi.
  customer_payment_methods: {
    kind: "csv-enum",
    values: ["CASH"],
    fallback: "CASH",
  },
  // Kassa va mijoz checkout'i bir xil naqd siyosatiga bo'ysunadi.
  cashier_payment_methods: {
    kind: "csv-enum",
    values: CASHIER_PAYMENT_METHOD_CODES,
    fallback: "CASH",
  },
  // POS kassasida yaratilgan buyurtmalar oshxona navbatida ko'rinsinmi.
  kitchen_pos_orders_enabled: BOOL(false),
  // Har bir buyurtma manbasi va Toshkent sanasi uchun boshlang'ich raqam.
  order_display_number_start: INT(1, 1_000_000, 101),
  // Yetkazish darvozasi. `false` — mijoz checkout'da yetkazishni tanlay
  // olmaydi. Kuryer ishi tugaguncha o'chiq (B bloki).
  customer_delivery_enabled: BOOL(false),

  /*
   * Yetkazish narxi, SO'MDA. Yagona qat'iy summa — savat hajmiga ham,
   * masofaga ham qaramaydi.
   *
   * Nima uchun butun so'm (tiyin emas): O'zbekistonda narxlar so'mda
   * ko'rsatiladi va tiyin amalda ishlatilmaydi. `Prisma.Decimal` ga
   * o'tkazilganda kasr qismi 0 bo'ladi.
   *
   * Yuqori chegara 1 000 000 — bu sozlama emas, XATODAN himoya: nol
   * ortiqcha yozib qo'yilsa admin panel darhol rad etadi.
   *
   * Pog'onali jadvalga (porsiya yoki masofa bo'yicha) o'tish kerak bo'lsa,
   * bu kalit o'rniga JSON jadval sozlamasi qo'yiladi — `resolveDeliveryFee`
   * ning yagona joyda turgani shuning uchun.
   */
  customer_delivery_fee: INT(0, 1_000_000, 20_000),
  /*
   * Shu radius ICHIDA yetkazish tekin, undan uzoqda yuqoridagi narx
   * olinadi. Metrda.
   *
   * Sozlamada, kodda emas: bu marketing qarori va aksiya paytida
   * deploysiz o'zgartirilishi kerak. 0 — tekin zona yo'q.
   */
  customer_free_delivery_radius_meters: INT(0, 50_000, 1_000),
} satisfies Record<string, SettingRule>;

export type SettingKey = keyof typeof SETTING_RULES;

/** Mijoz tomoniga oshkor qilinadigan kalitlar. */
export const PUBLIC_SETTING_KEYS = [
  "customer_payment_methods",
  "customer_delivery_enabled",
  /*
   * Narx mijozga OCHIQ: u savatda "yetkazish: 20 000" ni checkout'ga
   * o'tishdan OLDIN ko'rishi kerak. Yashirin narx buyurtmani oxirgi
   * qadamda tashlab ketishning asosiy sababi.
   *
   * Bu oshkor qilish emas — narxni baribir server hisoblaydi, mijoz
   * yuborgan qiymat qabul qilinmaydi.
   */
  "customer_delivery_fee",
] as const satisfies readonly SettingKey[];

/**
 * Checkout natijasiga darhol ta'sir qiladigan biznes sozlamalari.
 *
 * Bu ro'yxat `PUBLIC_SETTING_KEYS` bilan bir xil tushuncha emas. Masalan,
 * tekin yetkazish radiusini browser bilishi shart emas (narxni server
 * hisoblaydi), lekin uning o'zgarishi mijoz to'laydigan summani darhol
 * almashtiradi va admin UI tasdiqlash so'rashi kerak.
 */
export const CUSTOMER_CHECKOUT_SETTING_KEYS = [
  "customer_payment_methods",
  "customer_delivery_enabled",
  "customer_delivery_fee",
  "customer_free_delivery_radius_meters",
] as const satisfies readonly SettingKey[];

export const settingKeys = Object.keys(SETTING_RULES) as SettingKey[];

export function isKnownSettingKey(key: string): key is SettingKey {
  return key in SETTING_RULES;
}

export function isPublicSettingKey(key: SettingKey): boolean {
  return (PUBLIC_SETTING_KEYS as readonly string[]).includes(key);
}

export function affectsCustomerCheckout(key: SettingKey): boolean {
  return (CUSTOMER_CHECKOUT_SETTING_KEYS as readonly string[]).includes(key);
}

/*
 * Env boolean'lari bilan bir xil sabab: `Boolean("false") === true`, ya'ni
 * naiv o'girish bayroqni o'chirib bo'lmaydigan qilib qo'yardi.
 */
const TRUE_WORDS = new Set(["true", "1", "yes", "ha", "on"]);
const FALSE_WORDS = new Set(["false", "0", "no", "yo'q", "off"]);

/**
 * Qiymatni tekshiradi va SAQLANADIGAN kanonik ko'rinishini qaytaradi.
 *
 * Kanonik qilish muhim: "TRUE", " true " va "1" bir xil qatorga aylanadi,
 * ya'ni o'quvchi tomon bir nechta ko'rinishni qo'llab-quvvatlashi shart emas.
 */
export function validateSettingValue(key: SettingKey, raw: string): string {
  const rule: SettingRule = SETTING_RULES[key];
  const value = raw.trim();

  if (rule.kind === "int") {
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < rule.min || parsed > rule.max) {
      throw new BadRequestException(
        `"${key}" ${rule.min}–${rule.max} oralig'idagi butun son bo'lishi kerak`,
      );
    }

    return String(parsed);
  }

  if (rule.kind === "bool") {
    const lowered = value.toLowerCase();

    if (TRUE_WORDS.has(lowered)) {
      return "true";
    }

    if (FALSE_WORDS.has(lowered)) {
      return "false";
    }

    throw new BadRequestException(
      `"${key}" mantiqiy qiymat bo'lishi kerak (true/false)`,
    );
  }

  if (rule.kind === "csv-enum") {
    const entries = value
      .split(",")
      .map((entry) => entry.trim().toUpperCase())
      .filter(Boolean);

    if (entries.length === 0) {
      throw new BadRequestException(
        `"${key}" kamida bitta qiymat talab qiladi`,
      );
    }

    for (const entry of entries) {
      if (!rule.values.includes(entry)) {
        throw new BadRequestException(
          `"${key}" uchun noma'lum qiymat "${entry}". Ruxsat etilgan: ${rule.values.join(", ")}`,
        );
      }
    }

    // Takrorlar olib tashlanadi, tartib saqlanadi.
    return [...new Set(entries)].join(",");
  }

  if (key === "telegram_owner_telegram_user_id" && value !== "" && !/^[1-9][0-9]{4,19}$/.test(value)) {
    throw new BadRequestException("Owner Telegram ID /myid orqali olingan musbat raqam bo'lishi kerak");
  }

  return value;
}

/*
 * O'QISHDAGI parserlar ATAYLAB YUMSHOQ.
 *
 * Yozish qatlami reestrdan oldin yaratilgan qatorlarni kafolatlamaydi (va
 * bazaga qo'lda yozish ham mumkin), shuning uchun o'qish ikkinchi himoya
 * qatlami bo'lib qoladi: buzuq qiymat default'ga tushadi, ilovani
 * qulatmaydi.
 */
export function parseIntSetting(
  key: SettingKey,
  stored: string | undefined,
): number {
  const rule = SETTING_RULES[key];

  if (rule.kind !== "int") {
    throw new Error(`${key} butun son sozlamasi emas`);
  }

  if (stored === undefined) {
    return rule.fallback;
  }

  const parsed = Number(stored.trim());

  if (!Number.isInteger(parsed) || parsed < rule.min || parsed > rule.max) {
    return rule.fallback;
  }

  return parsed;
}

export function parseBoolSetting(
  key: SettingKey,
  stored: string | undefined,
): boolean {
  const rule = SETTING_RULES[key];

  if (rule.kind !== "bool") {
    throw new Error(`${key} mantiqiy sozlama emas`);
  }

  if (stored === undefined) {
    return rule.fallback;
  }

  const lowered = stored.trim().toLowerCase();

  if (TRUE_WORDS.has(lowered)) {
    return true;
  }

  if (FALSE_WORDS.has(lowered)) {
    return false;
  }

  return rule.fallback;
}

export function parseCsvSetting(
  key: SettingKey,
  stored: string | undefined,
): string[] {
  const rule = SETTING_RULES[key];

  if (rule.kind !== "csv-enum") {
    throw new Error(`${key} CSV sozlamasi emas`);
  }

  const source = stored ?? rule.fallback;
  const entries = source
    .split(",")
    .map((entry) => entry.trim().toUpperCase())
    .filter((entry) => rule.values.some((value) => value === entry));

  if (entries.length > 0) {
    return [...new Set(entries)];
  }

  // A missing value uses the documented default, but a corrupt or explicitly
  // empty cashier allowlist must not silently re-enable cash.
  if (key === "cashier_payment_methods" && stored !== undefined) {
    return [];
  }

  return [rule.fallback];
}

/** Reestrdagi default — sozlama hali yozilmagan bo'lsa shu ishlatiladi. */
export function settingFallback(key: SettingKey): string {
  const rule = SETTING_RULES[key];
  return String(rule.fallback);
}

export function describeSettingRule(key: SettingKey): SettingRule {
  return SETTING_RULES[key];
}
