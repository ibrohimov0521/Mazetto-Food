import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { RolesService } from "./roles.service";
import { CreateRoleDto, UpdateRoleDto } from "./dto/role-management.dto";

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

  @Post("roles")
  @Roles("SUPER_ADMIN")
  @Permissions(PERMISSIONS.ROLE_MANAGE)
  createRole(
    @Body() dto: CreateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.createRole(dto, user);
  }

  @Patch("roles/:id")
  @Roles("SUPER_ADMIN")
  @Permissions(PERMISSIONS.ROLE_MANAGE)
  updateRole(
    @Param("id") id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.updateRole(id, dto, user);
  }

  @Delete("roles/:id")
  @Roles("SUPER_ADMIN")
  @Permissions(PERMISSIONS.ROLE_MANAGE)
  deleteRole(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.deleteRole(id, user);
  }
}
