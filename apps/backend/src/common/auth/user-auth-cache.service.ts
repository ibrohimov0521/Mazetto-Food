import { Injectable } from "@nestjs/common";
import { RedisService } from "../../redis/redis.service";
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
 */

const KEY_PREFIX = "user-auth:";
const TTL_SECONDS = 30;

@Injectable()
export class UserAuthCacheService {
  constructor(private readonly redis: RedisService) {}

  async read(userId: string): Promise<AuthenticatedUser | null> {
    const client = this.redis.getClient();

    if (!client) {
      return null;
    }

    try {
      const raw = await client.get(`${KEY_PREFIX}${userId}`);
      return raw ? (JSON.parse(raw) as AuthenticatedUser) : null;
    } catch {
      // Kesh o'qilmadi — guard bazaga boradi. Autentifikatsiya Redis
      // tufayli buzilmasligi kerak.
      return null;
    }
  }

  async write(user: AuthenticatedUser): Promise<void> {
    const client = this.redis.getClient();

    if (!client) {
      return;
    }

    try {
      await client.set(
        `${KEY_PREFIX}${user.id}`,
        JSON.stringify(user),
        "EX",
        TTL_SECONDS,
      );
    } catch {
      // e'tiborsiz — kesh ixtiyoriy
    }
  }

  /**
   * Xodim profili o'zgarganda chaqiriladi.
   *
   * Buni chaqirishni unutish xavfsizlik nuqsoni EMAS, faqat 30 soniyagacha
   * kechikish — TTL baribir keshni eskirtiradi. Shu sababli chaqiruv
   * "yaxshilash", "majburiy shart" emas.
   */
  async invalidate(userId: string): Promise<void> {
    const client = this.redis.getClient();

    if (!client) {
      return;
    }

    try {
      await client.del(`${KEY_PREFIX}${userId}`);
    } catch {
      // e'tiborsiz — TTL bilan eskiradi
    }
  }
}
