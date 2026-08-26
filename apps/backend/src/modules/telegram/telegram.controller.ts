import { Body, Controller, Param, Post, UnauthorizedException } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator";
import { TelegramCustomerAuthService } from "./telegram-customer-auth.service";
import { TelegramOrderNotificationService } from "./telegram-order-notification.service";

@Controller("telegram")
export class TelegramController {
  constructor(
    private readonly telegramCustomerAuthService: TelegramCustomerAuthService,
    private readonly telegramOrderNotificationService: TelegramOrderNotificationService,
  ) {}

  @Public()
  @Post("webhook/:secret")
  async handleWebhook(@Param("secret") secret: string, @Body() update: unknown) {
    this.assertWebhookSecret(secret);
    const customerResult =
      await this.telegramCustomerAuthService.handleWebhookUpdate(update);

    if (customerResult.handled) {
      return customerResult;
    }

    return this.telegramOrderNotificationService.handleWebhook(secret, update);
  }

  private assertWebhookSecret(secret: string): void {
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (!expectedSecret || secret !== expectedSecret) {
      throw new UnauthorizedException("Invalid Telegram webhook secret");
    }
  }
}
