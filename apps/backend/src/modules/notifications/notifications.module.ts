import { Global, Module } from "@nestjs/common";
import { RedisModule } from "../../redis/redis.module";
import { TelegramModule } from "../telegram/telegram.module";
import { NotificationsController } from "./notifications.controller";
import { NotificationDeadLetterService } from "./notification-dead-letter.service";

/*
 * Global: o'lik xatlarni yozish har qanday bildirishnoma yo'lidan
 * chaqirilishi kerak, va Telegram moduli allaqachon boshqa modullardan
 * import qilinadi — bog'liqlik halqasi chiqmasligi uchun.
 */
@Global()
@Module({
  imports: [RedisModule, TelegramModule],
  controllers: [NotificationsController],
  providers: [NotificationDeadLetterService],
  exports: [NotificationDeadLetterService],
})
export class NotificationsModule {}
