import {
  parseBoolSetting,
  parseCsvSetting,
  parseIntSetting,
  type SettingKey,
} from "../src/modules/settings/setting-rules";
import type { SettingsService } from "../src/modules/settings/settings.service";

/*
 * Sozlama servisining test o'rinbosari (7-bosqich Q1).
 *
 * Qiymatlarni REESTRDAN oladi: `undefined` uzatilganda har parser o'zining
 * e'lon qilingan default'ini qaytaradi. Shu sababli bu stub reestrdan
 * uzilib qolmaydi — default o'zgarsa stub ham o'zgaradi, qo'lda yangilash
 * kerak emas.
 *
 * Bazasiz skriptlar uchun: haqiqiy `SettingsService` Prisma va Redis talab
 * qiladi, tekshirilayotgan mantiq esa ularga bog'liq emas.
 */
export function createSettingsStub(): SettingsService {
  return {
    getInt: async (key: SettingKey) => parseIntSetting(key, undefined),
    getBool: async (key: SettingKey) => parseBoolSetting(key, undefined),
    getCsv: async (key: SettingKey) => parseCsvSetting(key, undefined),
  } as unknown as SettingsService;
}
