import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { RedisModule } from "../../redis/redis.module";
import {
  PlatformEventsController,
  PlatformDiagnosticsController,
  PlatformAuditController,
  PlatformHeartbeatController,
  PlatformMonitoringController,
  PlatformReportsController,
} from "./platform-monitoring.controller";
import { PlatformMonitoringService } from "./platform-monitoring.service";

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [PlatformMonitoringController, PlatformEventsController, PlatformDiagnosticsController, PlatformAuditController, PlatformReportsController, PlatformHeartbeatController],
  providers: [PlatformMonitoringService],
  exports: [PlatformMonitoringService],
})
export class PlatformMonitoringModule {}
