import { Controller, Get } from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { RolesService } from "./roles.service";

@Controller()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get("roles")
  @Permissions(PERMISSIONS.ROLE_VIEW)
  listRoles() {
    return this.rolesService.listRoles();
  }

  @Get("permissions")
  @Permissions(PERMISSIONS.PERMISSION_VIEW)
  listPermissions() {
    return this.rolesService.listPermissions();
  }
}
