import { Controller, Get, Query } from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { AuditService } from "./audit.service";
import { ListAuditLogsDto } from "./dto/list-audit-logs.dto";

@Controller("audit-logs")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Permissions(PERMISSIONS.AUDIT_VIEW)
  listAuditLogs(@Query() query: ListAuditLogsDto) {
    return this.auditService.listAuditLogs(query);
  }

  @Get("facets")
  @Permissions(PERMISSIONS.AUDIT_VIEW)
  listAuditFacets() {
    return this.auditService.listAuditFacets();
  }
}
