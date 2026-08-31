import { Body, Controller, Param, Post, UnauthorizedException } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator";
import { TelegramCustomerAuthService } from "./telegram-customer-auth.service";
import { TelegramOrderNotificationService } from "./telegram-order-notification.service";

type TelegramDiagnosticMessage = {
  chat?: {
    id?: number | string;
    title?: string;
    type?: string;
  };
  text?: string;
};
type TelegramDiagnosticUpdate = {
  message?: TelegramDiagnosticMessage;
};

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

    if (await this.handleStaffChatIdDiagnostic(update)) {
      return { ok: true, handled: true };
    }

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

  private async handleStaffChatIdDiagnostic(update: unknown): Promise<boolean> {
    const message = this.toTelegramDiagnosticUpdate(update).message;

    if (!message?.chat?.id || !this.isStaffIdCommand(message.text)) {
      return false;
    }

    await this.telegramRequest("sendMessage", {
      chat_id: message.chat.id,
      text: [
        "MAZETTO Staff",
        `Chat ID: ${message.chat.id}`,
        `Chat type: ${message.chat.type ?? "unknown"}`,
        ...(message.chat.title ? [`Title: ${message.chat.title}`] : []),
      ].join("\n"),
    });

    return true;
  }

  private isStaffIdCommand(text: string | undefined): boolean {
    return /^\/staffid(?:@[A-Za-z0-9_]+)?$/.test(text?.trim() ?? "");
  }

  private toTelegramDiagnosticUpdate(update: unknown): TelegramDiagnosticUpdate {
    return update && typeof update === "object" ? (update as TelegramDiagnosticUpdate) : {};
  }

  private async telegramRequest(method: string, payload: unknown): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      return;
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Telegram ${method} failed with ${response.status}`);
    }
  }
}
