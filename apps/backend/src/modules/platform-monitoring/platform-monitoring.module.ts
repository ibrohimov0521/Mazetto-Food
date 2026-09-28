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
import {
  NodeDnsTxtResolver,
  TenantDomainService,
} from "./tenant-domain.service";
import { PlatformTenantLifecycleController } from "./platform-tenant-lifecycle.controller";
import { KitchenModule } from "../kitchen/kitchen.module";
import { PlatformTenantLifecycleService } from "./platform-tenant-lifecycle.service";
import { PlatformTenantBranchService } from "./platform-tenant-branch.service";
import { PlatformTenantMembershipService } from "./platform-tenant-membership.service";

@Module({
  imports: [PrismaModule, RedisModule, KitchenModule],
  controllers: [
    PlatformMonitoringController,
    PlatformTenantsController,
    PlatformEventsController,
    PlatformDiagnosticsController,
    PlatformAuditController,
    PlatformReportsController,
    PlatformHeartbeatController,
    PlatformTenantLifecycleController,
  ],
  providers: [
    PlatformMonitoringService,
    TenantDomainService,
    NodeDnsTxtResolver,
    PlatformTenantLifecycleService,
    PlatformTenantBranchService,
    PlatformTenantMembershipService,
  ],
  exports: [PlatformMonitoringService],
})
export class PlatformMonitoringModule {}
