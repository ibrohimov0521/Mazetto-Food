import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import {
  CreatePlatformSiteDto,
  PlatformHeartbeatDto,
  UpdatePlatformSiteDto,
} from "./dto/platform-monitoring.dto";
import { PlatformMonitoringService } from "./platform-monitoring.service";

@Controller("platform/sites")
@Roles("PLATFORM_OWNER")
@Permissions(PERMISSIONS.SYSTEM_HEALTH_VIEW)
export class PlatformMonitoringController {
  constructor(private readonly monitoring: PlatformMonitoringService) {}

  @Get()
  listSites() {
    return this.monitoring.listSites();
  }

  @Post()
  createSite(
    @Body() dto: CreatePlatformSiteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.monitoring.createSite(dto, user);
  }

  @Patch(":id")
  updateSite(
    @Param("id") id: string,
    @Body() dto: UpdatePlatformSiteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.monitoring.updateSite(id, dto, user);
  }

  @Post(":id/rotate-token")
  rotateAgentToken(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.monitoring.rotateAgentToken(id, user);
  }

  @Get(":id/events")
  listEvents(
    @Param("id") id: string,
    @Query("limit", new ParseIntPipe({ optional: true })) limit = 50,
    @Query("branchId") branchId?: string,
  ) {
    return this.monitoring.listEvents(id, limit, branchId);
  }
}

@Controller("platform/events")
@Roles("PLATFORM_OWNER")
@Permissions(PERMISSIONS.SYSTEM_HEALTH_VIEW)
export class PlatformEventsController {
  constructor(private readonly monitoring: PlatformMonitoringService) {}

  @Get()
  listRecentEvents(
    @Query("limit", new ParseIntPipe({ optional: true })) limit = 50,
    @Query("siteId") siteId?: string,
    @Query("state") state = "all",
  ) {
    return this.monitoring.listRecentEvents(limit, siteId, state);
  }

  @Post(":id/acknowledge")
  acknowledgeEvent(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.monitoring.acknowledgeEvent(id, user);
  }
}

@Controller("platform/diagnostics")
@Roles("PLATFORM_OWNER")
@Permissions(PERMISSIONS.SYSTEM_HEALTH_VIEW)
export class PlatformDiagnosticsController {
  constructor(private readonly monitoring: PlatformMonitoringService) {}

  @Get()
  listDiagnostics(
    @Query("limit", new ParseIntPipe({ optional: true })) limit = 100,
    @Query("siteId") siteId?: string,
    @Query("severity") severity?: string,
  ) {
    return this.monitoring.listDiagnostics(limit, siteId, severity);
  }
}

@Controller("platform/audit")
@Roles("PLATFORM_OWNER")
@Permissions(PERMISSIONS.SYSTEM_HEALTH_VIEW)
export class PlatformAuditController {
  constructor(private readonly monitoring: PlatformMonitoringService) {}

  @Get()
  listPlatformAudit(
    @Query("limit", new ParseIntPipe({ optional: true })) limit = 50,
    @Query("offset", new ParseIntPipe({ optional: true })) offset = 0,
    @Query("q") query?: string,
  ) {
    return this.monitoring.listPlatformAudit(limit, offset, query);
  }
}

@Controller("platform/reports")
@Roles("PLATFORM_OWNER")
@Permissions(PERMISSIONS.SYSTEM_HEALTH_VIEW)
export class PlatformReportsController {
  constructor(private readonly monitoring: PlatformMonitoringService) {}

  @Get()
  listReports(
    @Query("days", new ParseIntPipe({ optional: true })) days = 14,
    @Query("siteId") siteId?: string,
  ) {
    return this.monitoring.listPlatformReports(days, siteId);
  }
}

@Controller("platform/heartbeat")
export class PlatformHeartbeatController {
  constructor(private readonly monitoring: PlatformMonitoringService) {}

  @Post(":siteKey")
  @Public()
  receiveHeartbeat(
    @Param("siteKey") siteKey: string,
    @Headers("x-bestteam-agent-token") token: string | undefined,
    @Body() heartbeat: PlatformHeartbeatDto,
  ) {
    return this.monitoring.receiveHeartbeat(siteKey, token, heartbeat);
  }
}
