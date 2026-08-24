import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { KitchenModule } from "../kitchen/kitchen.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  imports: [PrismaModule, InventoryModule, KitchenModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
