import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { BranchesService } from "./branches.service";
import {
  CreateBranchDto,
  SetBranchWorkingHoursDto,
  SetProductBranchAvailabilityDto,
  UpdateBranchDto,
} from "./dto/branch.dto";

@Controller("branches")
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @Permissions(PERMISSIONS.BRANCH_VIEW)
  listBranches(@CurrentUser() user: AuthenticatedUser) {
    return this.branchesService.listBranches(user);
  }

  @Get(":id")
  @Permissions(PERMISSIONS.BRANCH_VIEW)
  getBranch(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.branchesService.getBranch(id, user);
  }

  @Post()
  @Permissions(PERMISSIONS.BRANCH_CREATE)
  createBranch(
    @Body() dto: CreateBranchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.branchesService.createBranch(dto, user);
  }

  @Patch(":id")
  @Permissions(PERMISSIONS.BRANCH_EDIT)
  updateBranch(
    @Param("id") id: string,
    @Body() dto: UpdateBranchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.branchesService.updateBranch(id, dto, user);
  }

  @Patch(":id/working-hours")
  @Permissions(PERMISSIONS.BRANCH_EDIT)
  setWorkingHours(
    @Param("id") id: string,
    @Body() dto: SetBranchWorkingHoursDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.branchesService.setWorkingHours(id, dto.hours, user);
  }

  @Patch(":id/product-availability")
  @Permissions(PERMISSIONS.BRANCH_EDIT)
  setProductAvailability(
    @Param("id") id: string,
    @Body() dto: SetProductBranchAvailabilityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.branchesService.setProductAvailability(id, dto, user);
  }
}
