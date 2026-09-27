import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { RedisModule } from "../../redis/redis.module";
import {
  PlatformEventsController,
  PlatformDiagnosticsController,
  PlatformAuditController,
  PlatformHeartbeatController,
  PlatformMonitoringController,
  PlatformTenantsController,
  PlatformReportsController,
} from "./platform-monitoring.controller";
import { PlatformMonitoringService } from "./platform-monitoring.service";
import { NodeDnsTxtResolver, TenantDomainService } from "./tenant-domain.service";

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [PlatformMonitoringController, PlatformTenantsController, PlatformEventsController, PlatformDiagnosticsController, PlatformAuditController, PlatformReportsController, PlatformHeartbeatController],
  providers: [PlatformMonitoringService, TenantDomainService, NodeDnsTxtResolver],
  exports: [PlatformMonitoringService],
})
export class PlatformMonitoringModule {}
