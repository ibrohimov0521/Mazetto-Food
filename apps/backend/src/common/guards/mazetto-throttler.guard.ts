import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { Request } from "express";
import { resolveClientAddress } from "../http/client-address";

/*
 * Global rate limit uchun tracker (PHASE 6 H3).
 *
 * `ThrottlerGuard` standart holda `req.ip` ni ishlatadi. Express'da
 * `trust proxy` o'rnatilmagani uchun u har doim reverse proxy'ning manzilini
 * qaytaradi — ya'ni barcha mijozlar BITTA bucket'ga tushib, chegara butun
 * ishlab chiqarish trafigiga birga qo'llanardi.
 *
 * Shuning uchun H1 dagi bir xil hal qiluvchi ishlatiladi: u proxy header'iga
 * faqat `TRUSTED_PROXY_HOP_COUNT` e'lon qilinganda ishonadi. Bu ikkala
 * qatlamning ham bir xil manzil tushunchasiga tayanishini kafolatlaydi.
 */
@Injectable()
export class MazettoThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Request): Promise<string> {
    return resolveClientAddress(req);
  }
}
