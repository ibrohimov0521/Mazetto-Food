import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../../prisma/prisma.module";
import { BranchesModule } from "../branches/branches.module";
import { KitchenModule } from "../kitchen/kitchen.module";
import { OrdersModule } from "../orders/orders.module";
import { TelegramModule } from "../telegram/telegram.module";
import { CustomerOrderEngineService } from "./customer-order-engine.service";
import {
  CustomerPublicController,
  CustomersAdminController,
} from "./customers.controller";
import { CustomerAuthService } from "./customer-auth.service";
import { CustomerCourierService } from "./customer-courier.service";
import { CustomersService } from "./customers.service";
import { CustomerAddressesService } from "./customer-addresses.service";

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
  providers: [CustomersService, CustomerAuthService, CustomerCourierService, CustomerOrderEngineService, CustomerAddressesService],
  exports: [CustomerOrderEngineService],
})
export class CustomersModule {}
