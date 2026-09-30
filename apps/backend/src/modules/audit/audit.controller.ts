import { Controller, Get, Query } from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { AuditService } from "./audit.service";
import { ListAuditLogsDto } from "./dto/list-audit-logs.dto";

@Controller("audit-logs")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles("SUPER_ADMIN", "PLATFORM_OWNER")
  @Permissions(PERMISSIONS.AUDIT_VIEW)
  listAuditLogs(
    @Query() query: ListAuditLogsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.auditService.listAuditLogs(query, user);
  }

  @Get("facets")
  @Roles("SUPER_ADMIN", "PLATFORM_OWNER")
  @Permissions(PERMISSIONS.AUDIT_VIEW)
  listAuditFacets(@CurrentUser() user: AuthenticatedUser) {
    return this.auditService.listAuditFacets(user);
  }
}
