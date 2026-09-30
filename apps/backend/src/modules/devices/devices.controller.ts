import {
  BadRequestException,
  Body,
  ForbiddenException,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { TenantRequestContextService } from "../../common/tenant/tenant-request-context.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import type { Request } from "express";
import { CreateDeviceDto, EnrollDeviceDto, UpdateDeviceDto } from "./dto/device.dto";
import { DevicesService } from "./devices.service";

@Controller("devices")
export class DevicesController {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly tenantRequestContext: TenantRequestContextService,
  ) {}

  @Get()
  @Permissions(PERMISSIONS.DEVICE_VIEW)
  listDevices(
    @Query("branchId") branchId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.devicesService.listDevices(branchId, user);
  }

  @Post()
  @Permissions(PERMISSIONS.DEVICE_MANAGE)
  createDevice(
    @Body() dto: CreateDeviceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.devicesService.createDevice(dto, user);
  }

  @Post("heartbeat")
  heartbeat(
    @Headers("x-mazetto-device-id") deviceId: string | undefined,
    @Body() body: { softwareVersion?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!deviceId?.trim()) {
      throw new BadRequestException("Device identity is required");
    }

    return this.devicesService.heartbeat(deviceId, body?.softwareVersion, user);
  }

  @Public()
  @Post("enroll")
  async enroll(@Body() dto: EnrollDeviceDto, @Req() request: Request) {
    const context = await this.tenantRequestContext.resolve(request.headers.host);
    if (context.kind !== "TRUSTED") {
      throw new ForbiddenException(
        "Device enrollment requires a verified active restaurant domain",
      );
    }
    return this.devicesService.enroll(dto, context.tenantId);
  }

  @Patch(":id")
  @Permissions(PERMISSIONS.DEVICE_MANAGE)
  updateDevice(
    @Param("id") id: string,
    @Body() dto: UpdateDeviceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.devicesService.updateDevice(id, dto, user);
  }

  @Delete("bulk")
  @Permissions(PERMISSIONS.DEVICE_MANAGE)
  deleteDevices(
    @Body() dto: { ids: string[] },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.devicesService.deleteDevices(dto.ids, user);
  }

  @Delete(":id")
  @Permissions(PERMISSIONS.DEVICE_MANAGE)
  deleteDevice(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.devicesService.deleteDevice(id, user);
  }

  @Post(":id/enrollment-code")
  @Permissions(PERMISSIONS.DEVICE_MANAGE)
  rotateEnrollmentCode(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.devicesService.rotateEnrollmentCode(id, user);
  }
}
