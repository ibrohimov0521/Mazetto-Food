import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { resolveRestaurantTenantId } from "../../common/auth/tenant-scope";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import { TelegramOrderNotificationService } from "../telegram/telegram-order-notification.service";
import { NotificationDeadLetterService } from "./notification-dead-letter.service";

/*
 * Yuborilmagan bildirishnomalar (Q6).
 *
 * Ilgari yo'qotishning yagona izi server logining bir qatori edi. Endi
 * egasi "bugun nechta buyurtma oshxonaga yetib bormagan" degan savolga
 * javob ola oladi va ularni qayta yubora oladi.
 */
@Controller("notifications")
export class NotificationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deadLetters: NotificationDeadLetterService,
    private readonly telegramNotifications: TelegramOrderNotificationService,
  ) {}

  @Get("dead-letters")
  @Permissions(PERMISSIONS.NOTIFICATION_MANAGE)
  async list(@CurrentUser() actor: AuthenticatedUser, @Query("limit") limit?: string) {
    const tenantId = await resolveRestaurantTenantId(this.prisma, actor);
    const parsed = Number(limit);
    return this.deadLetters.list(tenantId, Number.isFinite(parsed) ? parsed : 50);
  }

  /*
   * `POST`, `GET` emas: qayta yuborish TASHQI xabar jo'natadi. Uni
   * brauzer prefetch'i yoki havolani bosish bilan ishga tushirib
   * bo'lmasligi kerak.
   */
  @Post("dead-letters/:messageId/retry")
  @Permissions(PERMISSIONS.NOTIFICATION_MANAGE)
  async retry(@CurrentUser() actor: AuthenticatedUser, @Param("messageId") messageId: string) {
    const tenantId = await resolveRestaurantTenantId(this.prisma, actor);
    const retried =
      await this.telegramNotifications.retryDeadLetter(tenantId, messageId);

    if (!retried) {
      /*
       * Yozuv topilmadi yoki turi qayta yuborilmaydi (holat yangilanishi
       * eskirgan hodisaga bog'liq — uni qayta yuborish hozirgi holatni
       * buzardi).
       */
      throw new NotFoundException(
        "Bu yozuv topilmadi yoki uni qayta yuborib bo'lmaydi.",
      );
    }

    return { messageId, retried };
  }
}
