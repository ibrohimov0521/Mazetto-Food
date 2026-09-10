import { Injectable, Logger } from "@nestjs/common";
import { RedisCacheService } from "../../cache/redis-cache.service";
import {
  isWithinTashkent,
  tashkentViewbox,
} from "../customers/tashkent-bounds";

/*
 * Nominatim proxy.
 *
 * NIMA UCHUN BRAUZERDAN TO'G'RIDAN-TO'G'RI EMAS (QueenFood tajribasi):
 *
 * 1. Nominatim IP bo'yicha rate limit qo'yadi. Bitta ofis NAT ortidan
 *    chiqadi, ya'ni bir necha xodim = bitta IP = darhol 429.
 * 2. Kesh bo'lmaydi — bir xil manzil qayta-qayta so'raladi.
 * 3. Mijoz koordinatalari uchinchi tomonga to'g'ridan-to'g'ri oqadi.
 * 4. Self-hosted geocoder'ga o'tish uchun frontend relizi kerak bo'lardi;
 *    proxy bo'lsa `NOMINATIM_URL` ni almashtirish yetadi.
 */

const DEFAULT_NOMINATIM_URL = "https://nominatim.openstreetmap.org";
const REQUEST_TIMEOUT_MS = 5_000;

/*
 * Manzillar ko'chmaydi, shuning uchun reverse uzoq keshlanadi.
 * Qidiruv natijalari o'zgarishi mumkin (yangi obyektlar), TTL qisqaroq.
 */
const REVERSE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 kun
const SEARCH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 kun

/*
 * Kesh kaliti koordinatani 4 kasrgacha yaxlitlaydi — bu ~11 metr. Xaritada
 * qo'l bilan tanlangan qo'shni nuqtalar bitta kalitga tushadi, ya'ni bir bino
 * atrofidagi o'nlab bosish bitta so'rovga aylanadi.
 */
const KEY_PRECISION = 4;

const SUPPORTED_LANGS = ["uz", "ru", "en"] as const;
type Lang = (typeof SUPPORTED_LANGS)[number];

/*
 * Nominatim `state` maydonini `accept-language` ga tarjima qiladi, shuning
 * uchun regex UCHALA tilni ham ushlashi kerak. "Toshkent viloyati" shahar
 * emas — u yerga yetkazib berilmaydi.
 */
const REGION_PATTERN = /viloyat|область|region/i;

export type ReverseResult = {
  /** Bo'sh satr = geokoder javob bermadi (fail-open). */
  label: string;
  inCity: boolean;
};

export type SearchResult = {
  label: string;
  latitude: number;
  longitude: number;
};

type NominatimAddress = {
  country_code?: string;
  state?: string;
  county?: string;
};

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  constructor(private readonly cache: RedisCacheService) {}

  async reverse(
    latitude: number,
    longitude: number,
    lang: string,
  ): Promise<ReverseResult> {
    const language = normalizeLang(lang);
    const key = `geo:rev:${language}:${latitude.toFixed(KEY_PRECISION)}:${longitude.toFixed(KEY_PRECISION)}`;

    const cached = await this.cache.getJson<ReverseResult>(key);
    if (cached) {
      return cached;
    }

    const url = new URL("/reverse", this.baseUrl());
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("accept-language", language);
    url.searchParams.set("zoom", "18");

    const payload = await this.request<{
      display_name?: string;
      address?: NominatimAddress;
    }>(url);

    /*
     * FAIL-OPEN, MAJBURIY.
     *
     * Chaqiruvchi allaqachon quti tekshiruvidan o'tgan (`isWithinTashkent`),
     * shuning uchun geokoder ishlamay qolishi buyurtmani BLOKLAMASLIGI kerak
     * — u faqat "manzil yorlig'i yo'q" holatiga tushishi mumkin.
     *
     * Bu natija KESHLANMAYDI: aks holda bir daqiqalik uzilish 30 kunga
     * muzlab qolardi.
     */
    if (!payload) {
      return { label: "", inCity: true };
    }

    const address = payload.address ?? {};
    const inCity =
      (address.country_code ?? "").toLowerCase() === "uz" &&
      !REGION_PATTERN.test(address.state ?? "") &&
      !REGION_PATTERN.test(address.county ?? "");

    const result: ReverseResult = {
      label: payload.display_name?.trim() ?? "",
      inCity,
    };

    await this.cache.setJson(key, result, REVERSE_TTL_MS);
    return result;
  }

  async search(query: string, lang: string): Promise<SearchResult[]> {
    const language = normalizeLang(lang);
    const normalized = query.trim().toLowerCase().replace(/\s+/g, " ");

    if (normalized.length < 3) {
      return [];
    }

    const key = `geo:search:${language}:${normalized}`;
    const cached = await this.cache.getJson<SearchResult[]>(key);
    if (cached) {
      return cached;
    }

    const url = new URL("/search", this.baseUrl());
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("q", normalized);
    url.searchParams.set("accept-language", language);
    /*
     * `countrycodes` + `viewbox` + `bounded=1` — qidiruvni Toshkent shahriga
     * qamaydi. Usiz "Navoiy ko'chasi" so'rovi boshqa viloyatdagi ko'chani
     * birinchi o'ringa chiqarardi.
     */
    url.searchParams.set("countrycodes", "uz");
    url.searchParams.set("viewbox", tashkentViewbox());
    url.searchParams.set("bounded", "1");
    url.searchParams.set("limit", "5");

    const payload = await this.request<
      Array<{ display_name?: string; lat?: string; lon?: string }>
    >(url);

    // Fail-open: qidiruv ishlamasa bo'sh ro'yxat — foydalanuvchi xaritadan
    // qo'lda tanlay oladi. Keshlanmaydi.
    if (!Array.isArray(payload)) {
      return [];
    }

    const results = payload
      .map((item) => ({
        label: item.display_name?.trim() ?? "",
        latitude: Number(item.lat),
        longitude: Number(item.lon),
      }))
      /*
       * `bounded=1` ga qaramay ikkinchi filtr: Nominatim ba'zan viewbox
       * chekkasidagi natijalarni qaytaradi, va zonadan tashqaridagi natija
       * tanlanganda server baribir rad etadi — uni ko'rsatmagan ma'qul.
       */
      .filter(
        (item) =>
          item.label && isWithinTashkent(item.latitude, item.longitude),
      );

    await this.cache.setJson(key, results, SEARCH_TTL_MS);
    return results;
  }

  private baseUrl(): string {
    return process.env.NOMINATIM_URL?.trim() || DEFAULT_NOMINATIM_URL;
  }

  /** Xato bo'lsa `null` — chaqiruvchi fail-open qaror qabul qiladi. */
  private async request<T>(url: URL): Promise<T | null> {
    try {
      const response = await fetch(url, {
        headers: {
          /*
           * Nominatim foydalanish siyosati aniqlanadigan `User-Agent` ni
           * TALAB qiladi. Usiz so'rovlar bloklanadi.
           */
          "User-Agent": "MazettoFood/1.0 (+https://mazettofood.uz)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logger.warn(`Geocoder ${url.pathname} javobi: ${response.status}`);
        return null;
      }

      return (await response.json()) as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      this.logger.warn(`Geocoder ${url.pathname} so'rovi muvaffaqiyatsiz: ${message}`);
      return null;
    }
  }
}

function normalizeLang(value: string): Lang {
  const lang = value.trim().toLowerCase().slice(0, 2);
  return (SUPPORTED_LANGS as readonly string[]).includes(lang)
    ? (lang as Lang)
    : "uz";
}
