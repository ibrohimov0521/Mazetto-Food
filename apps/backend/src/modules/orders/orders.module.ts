import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { KitchenModule } from "../kitchen/kitchen.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { OrderActionService } from "./order-action.service";
import { PosController } from "./pos.controller";

@Module({
  imports: [PrismaModule, InventoryModule, KitchenModule],
  controllers: [OrdersController, PosController],
  providers: [OrdersService, OrderActionService],
  exports: [OrdersService, OrderActionService],
})
export class OrdersModule {}
