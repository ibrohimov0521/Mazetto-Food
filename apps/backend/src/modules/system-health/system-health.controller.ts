import { Controller, Get } from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { SystemHealthService } from "./system-health.service";

@Controller("system/health-metrics")
export class SystemHealthController {
  constructor(private readonly health: SystemHealthService) {}

  @Get()
  @Roles("SUPER_ADMIN")
  @Permissions(PERMISSIONS.SYSTEM_HEALTH_VIEW)
  getSnapshot() {
    return this.health.snapshot();
  }
}
