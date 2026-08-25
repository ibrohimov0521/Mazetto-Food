import { Module } from "@nestjs/common";
import { KitchenModule } from "../kitchen/kitchen.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { TelegramController } from "./telegram.controller";
import { TelegramOrderNotificationService } from "./telegram-order-notification.service";

@Module({
  imports: [PrismaModule, KitchenModule],
  controllers: [TelegramController],
  providers: [TelegramOrderNotificationService],
  exports: [TelegramOrderNotificationService],
})
export class TelegramModule {}
