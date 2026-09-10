import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { CustomerOrderAttemptStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

/*
 * Eskirgan texnik qatorlarni tozalash (7-bosqich Q2).
 *
 * MUAMMO. Backendda birorta ham rejalashtirilgan ish yo'q edi — `setInterval`
 * ham, `@Cron` ham. Sxemada esa `expiresAt` INDEKSLARI mavjud, ya'ni kimdir
 * tozalashni ko'zda tutgan, lekin tozalovchi hech qachon yozilmagan. Natijada
 * har OTP so'rovi, har sessiya va har Telegram checkout sessiyasi bazada
 * abadiy qolardi.
 *
 * QAT'IY CHEGARA: bu yerdagi ishlar BIZNES qatorlariga TEGMAYDI.
 *
 * QueenFood'da aynan shu joyda qimmat dars bo'lgan: ularning buyurtma
 * tozalagichi `BANK_TRANSFER` to'lovlarini ham qamrab olgan va operator
 * tasdiqlashini kutayotgan invoys buyurtmalari TTL'dan keyin JIMGINA
 * o'z-o'zini bekor qilgan. Shuning uchun bu yerda faqat sessiya, challenge va
 * urinish kabi texnik qatorlar bor — buyurtma, to'lov yoki chek YO'Q.
 */

/** Bir yurishda o'chiriladigan maksimal qator. */
const BATCH_SIZE = 1_000;

/*
 * Bekor qilingan sessiya darhol emas, MUDDAT ichida saqlanadi.
 *
 * Sabab: `refresh` bekor qilingan sessiyani ko'rib "qayta ishlatishga
 * urinish" degan xulosa chiqaradi. Qatorni darhol o'chirish bu signalni
 * yo'qotardi va o'g'irlangan token oddiy "topilmadi" bo'lib ko'rinardi.
 */
const REVOKED_RETENTION_DAYS = 30;

/*
 * Muddati o'tgan PENDING urinish.
 *
 * `CustomerOrderEngineService` uni allaqachon "eskirgan" deb tanidi va qayta
 * urinishda o'chiradi (AUD-004). Bu ish faqat qayta urinish KELMAGAN
 * holatlarni yig'ishtiradi.
 */
const STALE_ATTEMPT_HOURS = 24;

@Injectable()
export class MaintenanceScheduler {
  private readonly logger = new Logger(MaintenanceScheduler.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    const revokedBefore = new Date(
      now.getTime() - REVOKED_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    await this.run("sessions", async () => {
      const { count } = await this.prisma.session.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { revokedAt: { lt: revokedBefore } },
          ],
        },
      });
      return count;
    });

    await this.run("customer sessions", async () => {
      const { count } = await this.prisma.customerSession.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { revokedAt: { lt: revokedBefore } },
          ],
        },
      });
      return count;
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredChallenges(): Promise<void> {
    const now = new Date();

    /*
     * Tasdiqlash kodlari eng tez o'sadigan jadval: har login urinishi bitta
     * qator qoldiradi va ular hech qachon o'chirilmasdi.
     *
     * Ishlatilgan (`consumedAt`) qatorlar ham o'chiriladi — kod bir marta
     * ishlatiladi, saqlashning ma'nosi yo'q.
     */
    await this.run("verification challenges", async () => {
      const stale = await this.prisma.customerVerificationChallenge.findMany({
        where: {
          OR: [{ expiresAt: { lt: now } }, { consumedAt: { not: null } }],
        },
        select: { id: true },
        take: BATCH_SIZE,
      });

      if (stale.length === 0) {
        return 0;
      }

      const { count } = await this.prisma.customerVerificationChallenge.deleteMany({
        where: { id: { in: stale.map((row) => row.id) } },
      });
      return count;
    });

    await this.run("telegram checkout sessions", async () => {
      const stale = await this.prisma.telegramCheckoutSession.findMany({
        where: { expiresAt: { lt: now } },
        select: { id: true },
        take: BATCH_SIZE,
      });

      if (stale.length === 0) {
        return 0;
      }

      const { count } = await this.prisma.telegramCheckoutSession.deleteMany({
        where: { id: { in: stale.map((row) => row.id) } },
      });
      return count;
    });
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async cleanupStaleOrderAttempts(): Promise<void> {
    const threshold = new Date(Date.now() - STALE_ATTEMPT_HOURS * 60 * 60 * 1000);

    await this.run("stale order attempts", async () => {
      /*
       * FAQAT buyurtma YARATMAGAN urinishlar.
       *
       * `customerOrderId` to'ldirilgan qator — muvaffaqiyatli checkout'ning
       * idempotentlik yozuvi. Uni o'chirish o'sha kalit bilan qayta kelgan
       * so'rovni YANGI buyurtma sifatida o'tkazib yuborardi, ya'ni tozalash
       * ishi dublikat buyurtma sababiga aylanardi.
       */
      const stale = await this.prisma.customerOrderAttempt.findMany({
        where: {
          status: CustomerOrderAttemptStatus.PENDING,
          customerOrderId: null,
          createdAt: { lt: threshold },
        },
        select: { id: true },
        take: BATCH_SIZE,
      });

      if (stale.length === 0) {
        return 0;
      }

      const { count } = await this.prisma.customerOrderAttempt.deleteMany({
        where: { id: { in: stale.map((row) => row.id) } },
      });
      return count;
    });
  }

  /**
   * Bitta tozalash qadamini xavfsiz bajaradi.
   *
   * Muvaffaqiyatsizlik ILOVANI QULATMASLIGI kerak: bu ishlar fon xizmati va
   * ularning xatosi savdoni to'xtatishga arzimaydi. Faqat haqiqatan qator
   * o'chirilganda log yoziladi, aks holda kunlik log bo'sh yurishlar bilan
   * to'lib ketardi.
   */
  private async run(label: string, task: () => Promise<number>): Promise<void> {
    try {
      const count = await task();

      if (count > 0) {
        this.logger.log(`Tozalandi: ${label} — ${count} qator`);
      }
    } catch (error) {
      this.logger.warn(
        `Tozalash bajarilmadi (${label}): ${
          error instanceof Error ? error.message : "noma'lum xato"
        }`,
      );
    }
  }
}
