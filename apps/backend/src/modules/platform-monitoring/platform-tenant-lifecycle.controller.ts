import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { CreateRestaurantTenantDto } from "./dto/create-platform-tenant.dto";
import { CreatePlatformTenantBranchDto } from "./dto/create-platform-tenant-branch.dto";
import { PlatformTenantBranchService } from "./platform-tenant-branch.service";
import { PlatformTenantLifecycleService } from "./platform-tenant-lifecycle.service";
import { PlatformTenantMembershipService } from "./platform-tenant-membership.service";
import {
  CreatePlatformTenantMembershipDto,
  UpdatePlatformTenantMembershipRolesDto,
  UpdatePlatformTenantMembershipStatusDto,
} from "./dto/platform-tenant-membership.dto";

@Controller("platform/tenants")
@Roles("PLATFORM_OWNER")
@Permissions(PERMISSIONS.SYSTEM_HEALTH_VIEW)
export class PlatformTenantLifecycleController {
  constructor(
    private readonly tenants: PlatformTenantLifecycleService,
    private readonly branches: PlatformTenantBranchService,
    private readonly memberships: PlatformTenantMembershipService,
  ) {}

  @Post()
  create(
    @Body() dto: CreateRestaurantTenantDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tenants.create(dto, user);
  }

  @Get(":tenantId/membership-role-options")
  listMembershipRoleOptions(@Param("tenantId") tenantId: string) {
    return this.memberships.listAssignableRoles(tenantId);
  }

  @Get(":tenantId/memberships")
  listMemberships(@Param("tenantId") tenantId: string) {
    return this.memberships.list(tenantId);
  }

  @Post(":tenantId/memberships")
  createMembership(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreatePlatformTenantMembershipDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.memberships.create(tenantId, dto, user);
  }

  @Patch(":tenantId/memberships/:membershipId/status")
  setMembershipStatus(
    @Param("tenantId") tenantId: string,
    @Param("membershipId") membershipId: string,
    @Body() dto: UpdatePlatformTenantMembershipStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.memberships.setStatus(tenantId, membershipId, dto.status, user);
  }

  @Patch(":tenantId/memberships/:membershipId/roles")
  replaceMembershipRoles(
    @Param("tenantId") tenantId: string,
    @Param("membershipId") membershipId: string,
    @Body() dto: UpdatePlatformTenantMembershipRolesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.memberships.replaceRoles(tenantId, membershipId, dto, user);
  }

  @Post(":tenantId/branches")
  createBranch(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreatePlatformTenantBranchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.branches.create(tenantId, dto, user);
  }
}
