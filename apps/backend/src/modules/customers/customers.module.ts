import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../../prisma/prisma.module";
import { BranchesModule } from "../branches/branches.module";
import { KitchenModule } from "../kitchen/kitchen.module";
import { OrdersModule } from "../orders/orders.module";
import { TelegramModule } from "../telegram/telegram.module";
import { CustomerOrderEngineService } from "./customer-order-engine.service";
import { CustomerPublicController, CustomersAdminController } from "./customers.controller";
import { CustomersService } from "./customers.service";

@Module({
  imports: [
    JwtModule.register({}),
    PrismaModule,
    BranchesModule,
    KitchenModule,
    OrdersModule,
    TelegramModule,
  ],
  controllers: [CustomerPublicController, CustomersAdminController],
  providers: [CustomersService, CustomerOrderEngineService],
  exports: [CustomerOrderEngineService],
})
export class CustomersModule {}
