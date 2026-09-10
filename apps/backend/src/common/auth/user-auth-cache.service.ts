import { Injectable } from "@nestjs/common";
import { RedisCacheService } from "../../cache/redis-cache.service";
import type { AuthenticatedUser } from "../types/authenticated-user";

/*
 * Autentifikatsiya profilining qisqa muddatli keshi (PHASE 6 H8).
 *
 * MUAMMO. `JwtAuthGuard` HAR so'rovda `user -> roles -> role ->
 * rolePermissions -> permission` bo'ylab to'rt jadvalli join bajarardi.
 * Access token esa rollar va ruxsatlarni ALLAQACHON o'z ichiga oladi
 * (`auth.service.ts` ularni imzolaydi), ya'ni ikkala narx ham to'lanardi:
 * ~50 ta ruxsat har so'rov header'ida yuriydi VA baza baribir o'qiladi.
 *
 * Bazani o'qishning yagona haqiqiy foydasi — DARHOL bekor qilish: rol
 * o'zgardi, xodim bloklandi, parol reset qilindi. Kesh shu foydani
 * yo'qotmasligi kerak, shuning uchun:
 *
 *   1. TTL juda qisqa (30 soniya) — eng yomon holatda kechikish shuncha.
 *   2. Xodim o'zgarganda kesh ANIQ bekor qilinadi, ya'ni odatdagi holatda
 *      kechikish umuman bo'lmaydi.
 *
 * Token'ning O'ZIGA ishonmaslik ataylab: token 15 daqiqa yashaydi va uni
 * bekor qilib bo'lmaydi. 30 soniyalik kesh — 15 daqiqalik ko'r nuqta emas.
 *
 * TRANSPORT `RedisCacheService` da (umumiy JSON kesh, Redis tushganda
 * xotiraga tushadi). Bu servis esa KALIT FORMATI va TTL ni egallaydi: guard
 * o'qiydigan kalit bilan xodim mutatsiyalari o'chiradigan kalit bir xil
 * bo'lishi shart, aks holda bekor qilish jimgina ta'sirsiz qolardi.
 */

const KEY_PREFIX = "auth:user:";

const key = (userId: string) => `${KEY_PREFIX}${userId}`;
const TTL_SECONDS = 30;

@Injectable()
export class UserAuthCacheService {
  constructor(private readonly cache: RedisCacheService) {}

  async read(userId: string): Promise<AuthenticatedUser | null> {
    return this.cache.getJson<AuthenticatedUser>(key(userId));
  }

  async write(user: AuthenticatedUser): Promise<void> {
    await this.cache.setJson(key(user.id), user, TTL_SECONDS * 1000);
  }

  /**
   * Xodim profili o'zgarganda chaqiriladi.
   *
   * Buni chaqirishni unutish xavfsizlik nuqsoni EMAS, faqat 30 soniyagacha
   * kechikish — TTL baribir keshni eskirtiradi. Shu sababli chaqiruv
   * "yaxshilash", "majburiy shart" emas.
   */
  async invalidate(userId: string): Promise<void> {
    await this.cache.delete(key(userId));
  }
}
