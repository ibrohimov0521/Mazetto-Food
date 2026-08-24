import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import {
  CreateIngredientDto,
  CreateStockMovementDto,
  CreateWarehouseDto,
  InventoryQueryDto,
} from "./dto/inventory.dto";
import { InventoryService } from "./inventory.service";

@Controller("inventory")
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get("stock")
  @Permissions(PERMISSIONS.INVENTORY_VIEW)
  getStock(
    @Query() query: InventoryQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.getStock(query, user);
  }

  @Get("movements")
  @Permissions(PERMISSIONS.INVENTORY_VIEW)
  getMovements(
    @Query() query: InventoryQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.getMovements(query, user);
  }

  @Get("cost")
  @Permissions(PERMISSIONS.INVENTORY_VIEW)
  getCost(
    @Query() query: InventoryQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.getCost(query, user);
  }

  @Post("ingredients")
  @Permissions(PERMISSIONS.INVENTORY_CREATE)
  createIngredient(@Body() dto: CreateIngredientDto) {
    return this.inventoryService.createIngredient(dto);
  }

  @Post("warehouses")
  @Permissions(PERMISSIONS.INVENTORY_CREATE)
  createWarehouse(
    @Body() dto: CreateWarehouseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.createWarehouse(dto, user);
  }

  @Post("movements")
  @Permissions(PERMISSIONS.INVENTORY_EDIT)
  createMovement(
    @Body() dto: CreateStockMovementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.createMovement(dto, user);
  }
}
