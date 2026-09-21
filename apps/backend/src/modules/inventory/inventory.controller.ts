import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import {
  CreateIngredientDto,
  CreateStockMovementDto,
  CreateWarehouseDto,
  InventoryQueryDto,
  UpdateIngredientDto,
  UpdateWarehouseDto,
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

  @Get("warehouses")
  @Permissions(PERMISSIONS.INVENTORY_VIEW)
  listWarehouses(
    @CurrentUser() user: AuthenticatedUser,
    @Query("branchId") branchId?: string,
  ) {
    return this.inventoryService.listWarehouses(user, branchId);
  }

  @Get("ingredients")
  @Permissions(PERMISSIONS.INVENTORY_VIEW)
  listIngredients() {
    return this.inventoryService.listIngredients();
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

  @Patch("ingredients/:id")
  @Permissions(PERMISSIONS.INVENTORY_EDIT)
  updateIngredient(
    @Param("id") id: string,
    @Body() dto: UpdateIngredientDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.updateIngredient(id, dto, user);
  }

  @Delete("ingredients/:id")
  @Permissions(PERMISSIONS.INVENTORY_EDIT)
  archiveIngredient(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.archiveIngredient(id, user);
  }

  @Patch("warehouses/:id")
  @Permissions(PERMISSIONS.INVENTORY_EDIT)
  updateWarehouse(
    @Param("id") id: string,
    @Body() dto: UpdateWarehouseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.updateWarehouse(id, dto, user);
  }

  @Delete("warehouses/:id")
  @Permissions(PERMISSIONS.INVENTORY_EDIT)
  archiveWarehouse(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.archiveWarehouse(id, user);
  }

  @Get("readiness")
  @Permissions(PERMISSIONS.INVENTORY_VIEW)
  readiness(
    @CurrentUser() user: AuthenticatedUser,
    @Query("branchId") branchId?: string,
  ) {
    return this.inventoryService.getReadiness(user, branchId);
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
