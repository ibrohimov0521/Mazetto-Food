import { Module } from "@nestjs/common";
import { BranchesModule } from "../branches/branches.module";
import { CustomerOrderEngineService } from "../customers/customer-order-engine.service";
import { KitchenModule } from "../kitchen/kitchen.module";
import { OrdersModule } from "../orders/orders.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { TelegramController } from "./telegram.controller";
import { TelegramCustomerAuthService } from "./telegram-customer-auth.service";
import { TelegramCustomerOrderingService } from "./telegram-customer-ordering.service";
import { TelegramOrderNotificationService } from "./telegram-order-notification.service";

@Module({
  imports: [PrismaModule, BranchesModule, KitchenModule, OrdersModule],
  controllers: [TelegramController],
  providers: [
    CustomerOrderEngineService,
    TelegramOrderNotificationService,
    TelegramCustomerAuthService,
    TelegramCustomerOrderingService,
  ],
  exports: [TelegramOrderNotificationService, TelegramCustomerAuthService],
})
export class TelegramModule {}
