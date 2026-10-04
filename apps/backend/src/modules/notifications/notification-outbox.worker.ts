import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { TelegramOrderNotificationService } from "../telegram/telegram-order-notification.service";

type ClaimedNotification = {
  id: number;
  tenantId: string;
  orderId: string;
  attempts: number;
  leaseToken: string;
};

const CLAIM_BATCH_SIZE = 10;
const LEASE_DURATION_MS = 60_000;
const MAX_ATTEMPTS = 12;
const RETRY_BASE_MS = 5_000;
const RETRY_MAX_MS = 5 * 60_000;
const MAX_RETRY_AFTER_MS = 24 * 60 * 60_000;

@Injectable()
export class NotificationOutboxWorker {
  private readonly logger = new Logger(NotificationOutboxWorker.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramOrderNotificationService,
  ) {}

  @Cron("*/5 * * * * *")
  async dispatchPending(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      await this.recoverExpiredLeases();
      const jobs = await this.claimBatch();
      for (const job of jobs) {
        await this.deliver(job);
      }
    } catch (error) {
      this.logger.warn(
        `Notification outbox pass failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    } finally {
      this.running = false;
    }
  }

  private async recoverExpiredLeases(): Promise<void> {
    const now = new Date();
    const expired = await this.prisma.notificationOutbox.findMany({
      where: { status: "PROCESSING", leaseExpiresAt: { lte: now } },
      orderBy: [{ leaseExpiresAt: "asc" }, { id: "asc" }],
      take: CLAIM_BATCH_SIZE,
      select: {
        id: true,
        tenantId: true,
        orderId: true,
        attempts: true,
        leaseToken: true,
      },
    });

    for (const job of expired) {
      if (!job.leaseToken) continue;
      await this.markUncertain(
        job as ClaimedNotification,
        "Worker lease expired; the Telegram delivery outcome is unknown.",
      );
    }
  }

  private async claimBatch(): Promise<ClaimedNotification[]> {
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + LEASE_DURATION_MS);
    const leaseToken = randomUUID();

    return this.prisma.$queryRaw<ClaimedNotification[]>`
      WITH candidates AS (
        SELECT "id"
        FROM "notification_outbox"
        WHERE "status" = 'PENDING' AND "scheduledAt" <= ${now}
        ORDER BY "scheduledAt" ASC, "createdAt" ASC, "id" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${CLAIM_BATCH_SIZE}
      )
      UPDATE "notification_outbox" AS job
      SET "status" = 'PROCESSING',
          "leaseToken" = ${leaseToken},
          "leaseExpiresAt" = ${leaseExpiresAt},
          "attempts" = job."attempts" + 1,
          "updatedAt" = ${now}
      FROM candidates
      WHERE job."id" = candidates."id"
      RETURNING job."id", job."tenantId", job."orderId",
                job."attempts", job."leaseToken"
    `;
  }

  private async deliver(job: ClaimedNotification): Promise<void> {
    const result = await this.telegram.deliverOutboxNewOrder(
      job.orderId,
      job.tenantId,
    );

    if (result === "sent") {
      await this.prisma.notificationOutbox.updateMany({
        where: {
          id: job.id,
          status: "PROCESSING",
          leaseToken: job.leaseToken,
        },
        data: {
          status: "DELIVERED",
          deliveredAt: new Date(),
          leaseToken: null,
          leaseExpiresAt: null,
          lastError: null,
        },
      });
      return;
    }

    if (typeof result === "object" && result.kind === "retryable") {
      if (job.attempts >= MAX_ATTEMPTS) {
        await this.markFailed(
          job,
          "Telegram repeatedly rate-limited this notification.",
        );
        return;
      }
      const exponentialDelay = Math.min(
        RETRY_MAX_MS,
        RETRY_BASE_MS * 2 ** Math.min(job.attempts - 1, 6),
      );
      const providerDelay =
        result.retryAfterSeconds === null
          ? 0
          : Math.min(
              MAX_RETRY_AFTER_MS,
              Math.max(0, result.retryAfterSeconds * 1000),
            );
      await this.reschedule(
        job,
        Math.max(exponentialDelay, providerDelay),
        "Telegram rate-limited the request; retry is safe.",
      );
      return;
    }

    if (result === "skipped") {
      const order = await this.prisma.order.findFirst({
        where: { id: job.orderId, branch: { tenantId: job.tenantId } },
        select: { id: true },
      });
      if (!order || job.attempts >= MAX_ATTEMPTS) {
        await this.markFailed(
          job,
          order
            ? "Telegram delivery is not configured after repeated checks."
            : "The order no longer exists in its tenant.",
        );
        return;
      }
      await this.reschedule(
        job,
        RETRY_MAX_MS,
        "Telegram delivery is currently unavailable.",
      );
      return;
    }

    await this.markUncertain(
      job,
      "Telegram did not confirm delivery; automatic resend is disabled to avoid duplicates.",
    );
  }

  private async reschedule(
    job: ClaimedNotification,
    delayMs: number,
    reason: string,
  ): Promise<void> {
    await this.prisma.notificationOutbox.updateMany({
      where: {
        id: job.id,
        status: "PROCESSING",
        leaseToken: job.leaseToken,
      },
      data: {
        status: "PENDING",
        scheduledAt: new Date(Date.now() + delayMs),
        leaseToken: null,
        leaseExpiresAt: null,
        lastError: reason,
      },
    });
  }

  private async markFailed(
    job: ClaimedNotification,
    reason: string,
  ): Promise<void> {
    await this.markTerminal(job, "FAILED", reason);
  }

  private async markUncertain(
    job: ClaimedNotification,
    reason: string,
  ): Promise<void> {
    await this.markTerminal(job, "UNCERTAIN", reason);
  }

  private async markTerminal(
    job: Pick<ClaimedNotification, "id" | "tenantId" | "orderId" | "attempts" | "leaseToken">,
    status: "FAILED" | "UNCERTAIN",
    reason: string,
  ): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.notificationOutbox.updateMany({
        where: {
          id: job.id,
          status: "PROCESSING",
          leaseToken: job.leaseToken,
        },
        data: {
          status,
          leaseToken: null,
          leaseExpiresAt: null,
          lastError: reason,
        },
      });
      if (updated.count === 0) return;

      const messageId = `outbox-${job.id}`;
      await tx.notificationDeadLetter.upsert({
        where: {
          tenantId_messageId: { tenantId: job.tenantId, messageId },
        },
        create: {
          tenantId: job.tenantId,
          messageId,
          kind: "staff_new_order",
          orderId: job.orderId,
          error: reason,
          failedAt: now,
          attempts: job.attempts,
        },
        update: {
          error: reason,
          failedAt: now,
          attempts: job.attempts,
        },
      });
    });
  }
}
