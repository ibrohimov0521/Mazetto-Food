import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

/*
 * Redis ulanishi (7-bosqich 3-to'lqin).
 *
 * Redis `docker-compose.yml` da BOSHIDANOQ ko'tarilgan edi, lekin kodda
 * umuman ishlatilmasdi. Uni tiriltirish uchta muammoni yopadi:
 *
 *   H2 — login cheklovi jarayon xotirasida edi: deploy'da nolga tushardi,
 *        ikkinchi instance o'zicha sanardi va jadval cheksiz o'sardi.
 *   H3 — global rate limit hisoblagichlari ham xuddi shunday.
 *   H8 — JWT guard har so'rovda ruxsatlarni bazadan qayta o'qiydi.
 *
 * XATOGA CHIDAMLILIK. Redis ishlamay qolsa ilova QULAMAYDI: bu qatlam
 * kesh va hisoblagich uchun, biznes ma'lumoti uchun emas. `getClient()`
 * ulanmagan holatda `null` qaytaradi va chaqiruvchi o'z zaxira yo'liga
 * tushadi. Bu ataylab: Redis tushgani uchun kassa ishlamay qolishi
 * cheklovning o'zidan ko'ra qimmatroq.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private hasLoggedFailure = false;

  constructor() {
    const url = resolveRedisUrl();

    if (!url) {
      this.logger.warn("REDIS_URL berilmagan — kesh va cheklov xotirada ishlaydi");
      return;
    }

    const client = new Redis(url, {
      // Ulanmaganda so'rovlar NAVBATGA TURMASIN: chaqiruvchi darhol xato
      // olib zaxira yo'liga tushishi kerak, aks holda har bir login
      // Redis timeout'ini kutib turardi.
      enableOfflineQueue: false,
      lazyConnect: false,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => Math.min(times * 500, 5000),
    });

    client.on("error", (error: Error) => {
      // Faqat BIRINCHI xato loglanadi — ulanish uzilganda ioredis uni
      // qayta-qayta chiqarib, logni to'ldirib yuborardi.
      if (!this.hasLoggedFailure) {
        this.hasLoggedFailure = true;
        this.logger.warn(`Redis ulanmadi (zaxira yo'lga o'tildi): ${error.message}`);
      }
    });

    client.on("ready", () => {
      this.hasLoggedFailure = false;
      this.logger.log("Redis ulanishi tayyor");
    });

    this.client = client;
  }

  /** Ulanmagan bo'lsa `null` — chaqiruvchi zaxira yo'lini tanlaydi. */
  getClient(): Redis | null {
    return this.client?.status === "ready" ? this.client : null;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit().catch(() => undefined);
  }
}

/*
 * `REDIS_URL` to'liq berilishi mumkin; berilmasa `REDIS_PORT` dan yig'iladi.
 *
 * Bu mashinada 6379 ni boshqa loyihaning konteyneri egallagan, shuning uchun
 * `.env` da 6380 turibdi — port env'dan olinishi shart, kodga yozilmasligi.
 */
function resolveRedisUrl(): string | undefined {
  const explicit = process.env.REDIS_URL?.trim();

  if (explicit) {
    return explicit;
  }

  const port = process.env.REDIS_PORT?.trim();

  return port ? `redis://127.0.0.1:${port}` : undefined;
}
