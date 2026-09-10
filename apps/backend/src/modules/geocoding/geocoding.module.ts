import { Module } from "@nestjs/common";
import { GeocodingController } from "./geocoding.controller";
import { GeocodingService } from "./geocoding.service";

// `RedisCacheService` `CacheModule` orqali global, shuning uchun import yo'q.
@Module({
  controllers: [GeocodingController],
  providers: [GeocodingService],
  exports: [GeocodingService],
})
export class GeocodingModule {}
