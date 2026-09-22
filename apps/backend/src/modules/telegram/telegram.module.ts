import { Module } from "@nestjs/common";
import { BranchesModule } from "../branches/branches.module";
import { CustomerCourierService } from "../customers/customer-courier.service";
import { CustomerOrderEngineService } from "../customers/customer-order-engine.service";
import { KitchenModule } from "../kitchen/kitchen.module";
import { GeocodingModule } from "../geocoding/geocoding.module";
import { OrdersModule } from "../orders/orders.module";
import { PaymentsModule } from "../payments/payments.module";
import { TablesModule } from "../tables/tables.module";
import { CashRegisterModule } from "../cash-register/cash-register.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { TelegramController } from "./telegram.controller";
import { TelegramCustomerAuthService } from "./telegram-customer-auth.service";
import { TelegramCustomerOrderingService } from "./telegram-customer-ordering.service";
import { TelegramCartService } from "./telegram-cart.service";
import { TelegramCheckoutService } from "./telegram-checkout.service";
import { TelegramCheckoutSessionService } from "./telegram-checkout-session.service";
import { TelegramCustomerScreenService } from "./telegram-customer-screen.service";
import { TelegramOrderNotificationService } from "./telegram-order-notification.service";
import { TelegramCustomerOrderHistoryService } from "./telegram-customer-order-history.service";
import { TelegramStaffService } from "./telegram-staff.service";

@Module({
  imports: [PrismaModule, BranchesModule, KitchenModule, TablesModule, CashRegisterModule, OrdersModule, PaymentsModule, GeocodingModule],
  controllers: [TelegramController],
  providers: [
    CustomerCourierService,
    CustomerOrderEngineService,
    TelegramOrderNotificationService,
    TelegramCustomerAuthService,
    TelegramCustomerScreenService,
    TelegramCheckoutSessionService,
    TelegramCartService,
    TelegramCheckoutService,
    TelegramCustomerOrderHistoryService,
    TelegramCustomerOrderingService,
    TelegramStaffService,
  ],
  exports: [TelegramOrderNotificationService, TelegramCustomerAuthService],
})
export class TelegramModule {}
