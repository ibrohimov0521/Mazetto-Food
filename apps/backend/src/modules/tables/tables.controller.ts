import {
  Body,
  Controller,
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
import {
  CreateHallDto,
  CreateTableDto,
  CreateTableOrderDto,
  UpdateTableStatusDto,
} from "./dto/tables.dto";
import { TablesService } from "./tables.service";

@Controller()
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Get("tables")
  @Permissions(PERMISSIONS.TABLE_VIEW)
  listTables(
    @Query("branchId") branchId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tablesService.listTables(branchId, user);
  }

  @Get("tables/:id")
  @Permissions(PERMISSIONS.TABLE_VIEW)
  getTable(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tablesService.getTable(id, user);
  }

  @Post("tables/:id/orders")
  @Permissions(PERMISSIONS.ORDER_CREATE)
  createOrderForTable(
    @Param("id") id: string,
    @Body() dto: CreateTableOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tablesService.createOrderForTable(id, dto, user);
  }

  @Patch("tables/:id/status")
  @Permissions(PERMISSIONS.TABLE_EDIT)
  updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateTableStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tablesService.updateStatus(id, dto, user);
  }

  @Post("halls")
  @Permissions(PERMISSIONS.TABLE_CREATE)
  createHall(
    @Body() dto: CreateHallDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tablesService.createHall(dto, user);
  }

  @Post("tables")
  @Permissions(PERMISSIONS.TABLE_CREATE)
  createTable(
    @Body() dto: CreateTableDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tablesService.createTable(dto, user);
  }

  @Get("waiter/orders")
  @Permissions(PERMISSIONS.ORDER_VIEW)
  listWaiterOrders(@CurrentUser() user: AuthenticatedUser) {
    return this.tablesService.listWaiterOrders(user);
  }
}
