import { Body, Controller, Get, Param, Patch, Post, Put } from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { TenantLifecycleConfirmationDto } from "./dto/tenant-lifecycle-confirmation.dto";
import { CreateRestaurantTenantDto } from "./dto/create-platform-tenant.dto";
import { CreatePlatformTenantOnboardingDto } from "./dto/create-platform-tenant-onboarding.dto";
import { CreatePlatformTenantBranchDto } from "./dto/create-platform-tenant-branch.dto";
import { UpdatePlatformTenantFeaturesDto } from "./dto/update-platform-tenant-features.dto";
import { UpdatePlatformTenantTelegramDto } from "./dto/update-platform-tenant-telegram.dto";
import { PlatformTenantBranchService } from "./platform-tenant-branch.service";
import { PlatformTenantFeatureService } from "./platform-tenant-feature.service";
import { PlatformTenantLifecycleService } from "./platform-tenant-lifecycle.service";
import { PlatformTenantMembershipService } from "./platform-tenant-membership.service";
import { PlatformTenantProvisioningService } from "./platform-tenant-provisioning.service";
import { PlatformTenantTelegramService } from "./platform-tenant-telegram.service";
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
    private readonly provisioning: PlatformTenantProvisioningService,
    private readonly features: PlatformTenantFeatureService,
    private readonly telegram: PlatformTenantTelegramService,
  ) {}

  @Post()
  create(
    @Body() dto: CreateRestaurantTenantDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tenants.create(dto, user);
  }

  @Get(":tenantId/activation-preview")
  activationPreview(@Param("tenantId") tenantId: string) {
    return this.tenants.activationPreview(tenantId);
  }

  @Post(":tenantId/activate")
  activate(
    @Param("tenantId") tenantId: string,
    @Body() dto: TenantLifecycleConfirmationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tenants.activate(tenantId, dto, user);
  }

  @Get(":tenantId/archive-preview")
  archivePreview(@Param("tenantId") tenantId: string) {
    return this.tenants.archivePreview(tenantId);
  }

  @Post(":tenantId/archive")
  archive(
    @Param("tenantId") tenantId: string,
    @Body() dto: TenantLifecycleConfirmationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tenants.archive(tenantId, dto, user);
  }

  @Post(":tenantId/restore")
  restore(
    @Param("tenantId") tenantId: string,
    @Body() dto: TenantLifecycleConfirmationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tenants.restore(tenantId, dto, user);
  }

  @Post("onboard")
  onboard(@Body() dto: CreatePlatformTenantOnboardingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.provisioning.provision(dto, user);
  }

  @Get(":tenantId/telegram")
  getTelegram(@Param("tenantId") tenantId: string) {
    return this.telegram.get(tenantId);
  }

  @Put(":tenantId/telegram")
  updateTelegram(
    @Param("tenantId") tenantId: string,
    @Body() dto: UpdatePlatformTenantTelegramDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.telegram.update(tenantId, dto, user);
  }

  @Get(":tenantId/features")
  listFeatures(@Param("tenantId") tenantId: string) {
    return this.features.list(tenantId);
  }

  @Put(":tenantId/features")
  replaceFeatures(@Param("tenantId") tenantId: string, @Body() dto: UpdatePlatformTenantFeaturesDto, @CurrentUser() user: AuthenticatedUser) {
    return this.features.replace(tenantId, dto.enabledCodes, user);
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
