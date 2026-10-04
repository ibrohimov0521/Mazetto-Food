import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { TelegramOrderNotificationService } from "../telegram/telegram-order-notification.service";

type ClaimedNotification = {
  id: number;
  tenantId: string;
  orderId: string;
  kind: string;
  payload: unknown;
  attempts: number;
  leaseToken: string;
};

const CLAIM_BATCH_SIZE = 1;
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

  @Cron("0 15 3 * * *")
  async pruneDeliveredHistory(): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60_000);
    try {
      for (let batch = 0; batch < 5; batch += 1) {
        const stale = await this.prisma.notificationOutbox.findMany({
          where: { status: "DELIVERED", deliveredAt: { lt: cutoff } },
          orderBy: [{ deliveredAt: "asc" }, { id: "asc" }],
          take: 1_000,
          select: { id: true },
        });
        if (stale.length === 0) return;
        await this.prisma.notificationOutbox.deleteMany({
          where: { id: { in: stale.map(({ id }) => id) }, status: "DELIVERED" },
        });
      }
    } catch (error) {
      this.logger.warn(
        `Delivered notification history cleanup failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
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
        kind: true,
        payload: true,
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
        SELECT job."id"
        FROM "notification_outbox" AS job
        WHERE job."status" = 'PENDING' AND job."scheduledAt" <= ${now}
          AND (
            job."kind" NOT IN ('customer_status', 'staff_status_refresh')
            OR (
              NOT EXISTS (
                SELECT 1
                FROM "notification_outbox" AS active
                WHERE active."tenantId" = job."tenantId"
                  AND active."orderId" = job."orderId"
                  AND active."kind" = job."kind"
                  AND active."status" = 'PROCESSING'
              )
              AND NOT EXISTS (
                SELECT 1
                FROM "notification_outbox" AS earlier
                WHERE earlier."tenantId" = job."tenantId"
                  AND earlier."orderId" = job."orderId"
                  AND earlier."kind" = job."kind"
                  AND earlier."status" = 'PENDING'
                  AND (earlier."createdAt", earlier."id") < (job."createdAt", job."id")
              )
            )
          )
        ORDER BY job."scheduledAt" ASC, job."createdAt" ASC, job."id" ASC
        FOR UPDATE OF job SKIP LOCKED
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
      RETURNING job."id", job."tenantId", job."orderId", job."kind",
                job."payload", job."attempts", job."leaseToken"
    `;
  }

  private async deliver(job: ClaimedNotification): Promise<void> {
    const result =
      job.kind === "staff_new_order"
        ? await this.telegram.deliverOutboxNewOrder(job.orderId, job.tenantId)
        : job.kind === "customer_status"
          ? await this.telegram.deliverOutboxCustomerStatus(
              job.orderId,
              job.tenantId,
              job.payload,
            )
          : job.kind === "staff_status_refresh"
            ? await this.telegram.deliverOutboxStaffStatusRefresh(
                job.orderId,
                job.tenantId,
              )
            : {
                kind: "rejected" as const,
                reason: `Unsupported notification outbox kind: ${job.kind}`,
              };

    if (result === "sent" || result === "ignored") {
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

    if (typeof result === "object" && result.kind === "rejected") {
      await this.markFailed(job, result.reason);
      return;
    }

    if (typeof result === "object" && result.kind === "retryable") {
      const requestedDelay =
        result.retryAfterSeconds === null
          ? 0
          : Math.max(0, result.retryAfterSeconds * 1000);
      if (requestedDelay > MAX_RETRY_AFTER_MS) {
        await this.markFailed(
          job,
          "Telegram rate-limit delay exceeds the automatic retry window.",
        );
        return;
      }
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
      const providerDelay = requestedDelay;
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
    job: Pick<ClaimedNotification, "id" | "tenantId" | "orderId" | "kind" | "attempts" | "leaseToken">,
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
          kind: job.kind,
          orderId: job.orderId,
          error: reason,
          failedAt: now,
          attempts: job.attempts,
        },
        update: {
          kind: job.kind,
          orderId: job.orderId,
          error: reason,
          failedAt: now,
          attempts: job.attempts,
        },
      });
    });
  }
}
