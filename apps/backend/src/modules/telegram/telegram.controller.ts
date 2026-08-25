import { Body, Controller, Param, Post } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator";
import { TelegramOrderNotificationService } from "./telegram-order-notification.service";

@Controller("telegram")
export class TelegramController {
  constructor(
    private readonly telegramOrderNotificationService: TelegramOrderNotificationService,
  ) {}

  @Public()
  @Post("webhook/:secret")
  handleWebhook(@Param("secret") secret: string, @Body() update: unknown) {
    return this.telegramOrderNotificationService.handleWebhook(secret, update);
  }
}
