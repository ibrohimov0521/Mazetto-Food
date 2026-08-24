import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { CreateSupplierDto, UpdateSupplierDto } from "./dto/supplier.dto";
import { SuppliersService } from "./suppliers.service";

@Controller("suppliers")
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @Permissions(PERMISSIONS.INVENTORY_VIEW)
  listSuppliers(
    @Query("branchId") branchId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.suppliersService.listSuppliers(branchId, user);
  }

  @Post()
  @Permissions(PERMISSIONS.INVENTORY_CREATE)
  createSupplier(
    @Body() dto: CreateSupplierDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.suppliersService.createSupplier(dto, user);
  }

  @Patch(":id")
  @Permissions(PERMISSIONS.INVENTORY_EDIT)
  updateSupplier(
    @Param("id") id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.suppliersService.updateSupplier(id, dto, user);
  }

  @Delete(":id")
  @Permissions(PERMISSIONS.INVENTORY_EDIT)
  deleteSupplier(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.suppliersService.deleteSupplier(id, user);
  }
}
