import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { CreateDeviceDto, UpdateDeviceDto } from "./dto/device.dto";
import { DevicesService } from "./devices.service";

@Controller("devices")
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

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

  @Patch(":id")
  @Permissions(PERMISSIONS.DEVICE_MANAGE)
  updateDevice(
    @Param("id") id: string,
    @Body() dto: UpdateDeviceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.devicesService.updateDevice(id, dto, user);
  }
}
