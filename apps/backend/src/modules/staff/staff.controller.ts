import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import {
  ChangeOwnPasswordDto,
  CreateStaffDto,
  ResetStaffPasswordDto,
  UpdateStaffDto,
  UpdateStaffRoleDto,
  UpdateStaffStatusDto,
} from "./dto/staff.dto";
import { StaffService } from "./staff.service";

@Controller("staff")
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @Permissions(PERMISSIONS.STAFF_VIEW)
  listStaff(@CurrentUser() user: AuthenticatedUser) {
    return this.staffService.listStaff(user);
  }

  @Get(":id")
  @Permissions(PERMISSIONS.STAFF_VIEW)
  getStaff(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.staffService.getStaff(id, user);
  }

  @Post()
  @Permissions(PERMISSIONS.STAFF_CREATE)
  createStaff(@Body() dto: CreateStaffDto, @CurrentUser() user: AuthenticatedUser) {
    return this.staffService.createStaff(dto, user);
  }

  @Patch(":id")
  @Permissions(PERMISSIONS.STAFF_UPDATE)
  updateStaff(
    @Param("id") id: string,
    @Body() dto: UpdateStaffDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.staffService.updateStaff(id, dto, user);
  }

  @Patch(":id/role")
  @Permissions(PERMISSIONS.STAFF_ROLE_ASSIGN)
  updateRole(
    @Param("id") id: string,
    @Body() dto: UpdateStaffRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.staffService.updateRole(id, dto, user);
  }

  @Patch(":id/status")
  @Permissions(PERMISSIONS.STAFF_STATUS_CHANGE)
  updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateStaffStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.staffService.updateStatus(id, dto, user);
  }

  @Post(":id/password-reset")
  @Permissions(PERMISSIONS.STAFF_PASSWORD_RESET)
  resetPassword(
    @Param("id") id: string,
    @Body() dto: ResetStaffPasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.staffService.resetPassword(id, dto, user);
  }

  @Post("me/password")
  changeOwnPassword(
    @Body() dto: ChangeOwnPasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.staffService.changeOwnPassword(dto, user);
  }
}
