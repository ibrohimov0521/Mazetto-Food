import { Module } from "@nestjs/common";
import { SystemHealthController } from "./system-health.controller";
import { SystemHealthService } from "./system-health.service";
import { GeocodingModule } from "../geocoding/geocoding.module";
import { UploadsModule } from "../uploads/uploads.module";

@Module({
  imports: [GeocodingModule, UploadsModule],
  controllers: [SystemHealthController],
  providers: [SystemHealthService],
})
export class SystemHealthModule {}
