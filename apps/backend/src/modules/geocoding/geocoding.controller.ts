import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../../common/decorators/public.decorator";
import { GeocodingService } from "./geocoding.service";

/*
 * Manzil tanlash mijoz TIZIMGA KIRMASDAN oldin ham ochiladi (savatdan
 * checkout'ga o'tishda), shuning uchun endpointlar `@Public()`.
 *
 * Ochiq bo'lgani uchun chegara alohida va qattiqroq: global chegara 60
 * soniyada 300 ta, u kassa planshetlari uchun mo'ljallangan. Bu yerda har
 * bir so'rov TASHQI xizmatga chiqishi mumkin va Nominatim siyosatini
 * buzsak, butun loyiha IP bo'yicha bloklanadi.
 *
 * 30/daqiqa manzil tanlash uchun yetarli: kesh 4 kasrgacha (~11 m)
 * yaxlitlaydi, ya'ni bitta bino atrofidagi surish takroriy so'rov
 * yaratmaydi.
 */
@Public()
@Throttle({ default: { ttl: 60_000, limit: 30 } })
@Controller("geocoding")
export class GeocodingController {
  constructor(private readonly geocoding: GeocodingService) {}

  @Get("reverse")
  async reverse(
    @Query("lat") lat: string,
    @Query("lng") lng: string,
    @Query("lang") lang = "uz",
  ) {
    const latitude = Number(lat);
    const longitude = Number(lng);

    /*
     * Chegara tekshiruvi ATAYLAB bu yerda YO'Q.
     *
     * Reverse geocode zonadan tashqaridagi nuqta uchun ham chaqiriladi —
     * aynan shunda `inCity: false` qaytib, foydalanuvchiga NIMA UCHUN
     * rad etilgani ko'rsatiladi. Zonani majburlash `normalizeDeliveryLocation`
     * ning ishi; bu endpoint faqat ma'lumot beradi.
     */
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new BadRequestException("lat va lng raqam bo'lishi kerak.");
    }
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      throw new BadRequestException("Koordinata chegaradan tashqarida.");
    }

    return this.geocoding.reverse(latitude, longitude, lang);
  }

  @Get("search")
  async search(@Query("q") query = "", @Query("lang") lang = "uz") {
    if (query.length > 200) {
      throw new BadRequestException("So'rov juda uzun.");
    }

    return this.geocoding.search(query, lang);
  }
}
