import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { resolveBranchScope } from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import type { ListReceiptsDto } from "./dto/list-receipts.dto";
import type { ListPrintJobsDto } from "./dto/print-job.dto";
import { queuePrintJobsForReceipt } from "./receipt-writer";
import { writeAuditLog } from "../audit/audit-write";

@Injectable()
export class ReceiptsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cheklar ro'yxati.
   *
   * Chek MAZMUNI (`content`) va ESC/POS satri bu yerda qaytarilmaydi —
   * ular faqat bitta chek so'ralganda kerak. Ro'yxat yengil bo'lib qoladi.
   */
  async listReceipts(query: ListReceiptsDto, user: AuthenticatedUser) {
    const branchId = resolveBranchScope(user, query.branchId);
    const createdAt =
      query.from || query.to
        ? {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          }
        : undefined;

    return this.prisma.receipt.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        ...(query.orderId ? { orderId: query.orderId } : {}),
        ...(typeof query.printed === "boolean" ? { printed: query.printed } : {}),
        ...(createdAt ? { createdAt } : {}),
      },
      orderBy: { createdAt: "desc" },
      skip: query.offset,
      take: query.limit,
      select: {
        id: true,
        documentType: true,
        receiptNumber: true,
        total: true,
        printed: true,
        printedAt: true,
        createdAt: true,
        orderId: true,
        branch: { select: { id: true, code: true, name: true } },
        order: {
          select: {
            id: true,
            orderNumber: true,
            displayOrderNumber: true,
            status: true,
            paymentStatus: true,
            source: true,
          },
        },
      },
    });
  }

  async listPrintJobs(query: ListPrintJobsDto, user: AuthenticatedUser) {
    const branchId = resolveBranchScope(user, query.branchId);
    await this.restoreMissingPrintJobs(branchId);
    return this.prisma.printJob.findMany({
      where: { ...(branchId ? { branchId } : {}), ...(query.status ? { status: query.status } : {}) },
      orderBy: [{ status: "asc" }, { nextAttemptAt: "asc" }, { createdAt: "asc" }],
      take: query.limit,
      select: {
        id: true,
        status: true,
        attemptCount: true,
        maxAttempts: true,
        nextAttemptAt: true,
        leaseExpiresAt: true,
        lastError: true,
        printedAt: true,
        createdAt: true,
        branch: { select: { id: true, name: true, code: true } },
        receipt: { select: { id: true, receiptNumber: true, total: true, content: true, order: { select: { orderNumber: true, displayOrderNumber: true } } } },
        printer: { select: { id: true, name: true, type: true, metadata: true } },
        attempts: { orderBy: { startedAt: "desc" }, take: 1, select: { agentId: true, outcome: true, startedAt: true, completedAt: true } },
      },
    });
  }

  async deleteReceipts(ids: string[], user: AuthenticatedUser) {
    const uniqueIds = [...new Set((ids ?? []).filter((id) => typeof id === "string" && id.trim()))];
    if (!uniqueIds.length) throw new BadRequestException("Kamida bitta chek tanlanishi kerak");
    const receipts = await this.prisma.receipt.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, branchId: true, receiptNumber: true, documentType: true },
    });
    for (const receipt of receipts) resolveBranchScope(user, receipt.branchId);
    if (receipts.length !== uniqueIds.length) throw new NotFoundException("Tanlangan cheklarning biri topilmadi");
    await this.prisma.$transaction(async (tx) => {
      await tx.receipt.deleteMany({ where: { id: { in: uniqueIds } } });
      await writeAuditLog(tx, {
        userId: user.id,
        action: "RECEIPTS_BULK_DELETED",
        entity: "Receipt",
        metadata: { ids: receipts.map((receipt) => receipt.id), receipts },
      });
    });
    return { deleted: true, count: uniqueIds.length, ids: uniqueIds };
  }

  private async restoreMissingPrintJobs(branchId?: string) {
    const receipts = await this.prisma.receipt.findMany({
      where: {
        printed: false,
        ...(branchId ? { branchId } : {}),
        printJobs: { none: {} },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: { id: true, branchId: true, content: true },
    });

    for (const receipt of receipts) {
      await this.prisma.$transaction(async (tx) => {
        const existingJob = await tx.printJob.findFirst({
          where: { receiptId: receipt.id },
          select: { id: true },
        });
        if (!existingJob) await queuePrintJobsForReceipt(tx, receipt);
      });
    }
  }

  async getReceipt(id: string, user: AuthenticatedUser) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id },
      include: {
        branch: true,
        order: {
          include: {
            items: true,
            payments: { include: { method: true, acceptedBy: true } },
            closedBy: true,
          },
        },
      },
    });

    if (!receipt) {
      throw new NotFoundException("Receipt not found");
    }

    resolveBranchScope(user, receipt.branchId);

    return {
      ...receipt,
      escpos: this.buildEscPos(receipt),
    };
  }

  async getReceiptByOrder(orderId: string, user: AuthenticatedUser) {
    const branchId = resolveBranchScope(user);
    const receipt = await this.prisma.receipt.findFirst({
      where: {
        orderId,
        documentType: "RECEIPT",
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (!receipt) {
      throw new NotFoundException("Receipt not found");
    }

    return this.getReceipt(receipt.id, user);
  }

  async markPrinted(id: string, user: AuthenticatedUser) {
    await this.getReceipt(id, user);

    await this.prisma.receipt.update({
      where: { id },
      data: {
        printed: true,
        printedAt: new Date(),
      },
    });

    return this.getReceipt(id, user);
  }


  async reprintReceipt(id: string, user: AuthenticatedUser) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id },
      select: { id: true, branchId: true, content: true },
    });
    if (!receipt) throw new NotFoundException("Receipt not found");
    resolveBranchScope(user, receipt.branchId);
    await this.prisma.$transaction(async (tx) => {
      await queuePrintJobsForReceipt(tx, receipt);
      await tx.receipt.update({
        where: { id: receipt.id },
        data: { printed: false, printedAt: null },
      });
    });
    return this.getReceipt(id, user);
  }
  async claimPrintJob(
    branchId: string | undefined,
    agentId: string,
    user: AuthenticatedUser,
    printerIds: string[] = [],
    acceptUnassigned = false,
    deviceId?: string,
  ) {
    const device = deviceId?.trim()
      ? await this.prisma.device.findUnique({
          where: { hardwareId: deviceId.trim() },
          select: { branchId: true, isActive: true, enrolledAt: true },
        })
      : null;
    if (deviceId?.trim() && (!device?.isActive || !device.enrolledAt)) {
      throw new BadRequestException("Enrolled print device is required");
    }
    if (device && branchId && branchId !== device.branchId) {
      throw new BadRequestException("Print device belongs to another branch");
    }
    const scopedBranchId = resolveBranchScope(user, device?.branchId ?? branchId);
    if (!scopedBranchId) throw new BadRequestException("Branch is required");
    await this.restoreMissingPrintJobs(scopedBranchId);
    const targetFilters: Prisma.PrintJobWhereInput[] = [];
    if (printerIds.length > 0) targetFilters.push({ printerId: { in: printerIds } });
    if (acceptUnassigned) targetFilters.push({ printerId: null });
    if (targetFilters.length === 0) return null;
    const now = new Date();
    const job = await this.prisma.printJob.findFirst({
      where: {
        branchId: scopedBranchId,
        AND: [
          { OR: targetFilters },
          {
            OR: [
              { status: "PENDING", nextAttemptAt: { lte: now } },
              { status: "PROCESSING", leaseExpiresAt: { lte: now } },
            ],
          },
        ],
      },
      orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
    });
    if (!job) return null;
    const leaseToken = randomUUID();
    const claimed = await this.prisma.printJob.updateMany({
      where: { id: job.id, status: job.status, ...(job.status === "PENDING" ? { nextAttemptAt: { lte: now } } : { leaseExpiresAt: { lte: now } }) },
      data: { status: "PROCESSING", leaseToken, leaseExpiresAt: new Date(now.getTime() + 120_000), attemptCount: { increment: 1 }, lastError: null },
    });
    if (claimed.count !== 1) return null;
    await this.prisma.printAttempt.create({ data: { jobId: job.id, agentId, leaseToken } });
    return this.prisma.printJob.findUnique({ where: { id: job.id }, include: { receipt: true, printer: true } });
  }

  async completePrintJob(id: string, leaseToken: string, user: AuthenticatedUser) {
    const job = await this.prisma.printJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException("Print job not found");
    resolveBranchScope(user, job.branchId);

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      // The lease predicate makes a late agent harmless after another agent has reclaimed the job.
      const completed = await tx.printJob.updateMany({
        where: { id, branchId: job.branchId, status: "PROCESSING", leaseToken, leaseExpiresAt: { gt: now } },
        data: { status: "PRINTED", printedAt: now, leaseToken: null, leaseExpiresAt: null },
      });
      if (completed.count !== 1) throw new BadRequestException("Print lease is no longer valid");
      await tx.printAttempt.update({
        where: { jobId_leaseToken: { jobId: id, leaseToken } },
        data: { outcome: "PRINTED", completedAt: now },
      });
      const remaining = await tx.printJob.count({
        where: {
          receiptId: job.receiptId,
          id: { not: id },
          status: { notIn: ["PRINTED", "CANCELLED"] },
        },
      });
      if (remaining === 0) {
        await tx.receipt.update({
          where: { id: job.receiptId },
          data: { printed: true, printedAt: now },
        });
      }
    });
    return this.prisma.printJob.findUnique({ where: { id } });
  }

  async failPrintJob(id: string, leaseToken: string, error: string, user: AuthenticatedUser) {
    const job = await this.prisma.printJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException("Print job not found");
    resolveBranchScope(user, job.branchId);

    const now = new Date();
    const dead = job.attemptCount >= job.maxAttempts;
    const nextAttemptAt = new Date(now.getTime() + Math.min(300_000, 15_000 * 2 ** Math.max(0, job.attemptCount - 1)));
    await this.prisma.$transaction(async (tx) => {
      const released = await tx.printJob.updateMany({
        where: { id, branchId: job.branchId, status: "PROCESSING", leaseToken, leaseExpiresAt: { gt: now } },
        data: {
          status: dead ? "DEAD_LETTER" : "PENDING",
          lastError: error.slice(0, 1000),
          nextAttemptAt,
          leaseToken: null,
          leaseExpiresAt: null,
        },
      });
      if (released.count !== 1) throw new BadRequestException("Print lease is no longer valid");
      await tx.printAttempt.update({
        where: { jobId_leaseToken: { jobId: id, leaseToken } },
        data: { outcome: dead ? "DEAD_LETTER" : "FAILED", error: error.slice(0, 1000), completedAt: now },
      });
    });
    return this.prisma.printJob.findUnique({ where: { id } });
  }

  async retryPrintJob(id: string, user: AuthenticatedUser) {
    const job = await this.prisma.printJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException("Print job not found");
    resolveBranchScope(user, job.branchId);

    if (job.status === "PRINTED" || job.status === "CANCELLED") {
      throw new BadRequestException("Completed print job cannot be retried");
    }
    const now = new Date();
    if (
      job.status === "PROCESSING" &&
      job.leaseExpiresAt &&
      job.leaseExpiresAt > now
    ) {
      throw new BadRequestException("Printer is still processing this job");
    }

    await this.prisma.$transaction(async (tx) => {
      const retried = await tx.printJob.updateMany({
        where: {
          id,
          branchId: job.branchId,
          status: job.status,
          ...(job.status === "PROCESSING"
            ? { leaseExpiresAt: { lte: now } }
            : {}),
        },
        data: {
          status: "PENDING",
          attemptCount: 0,
          nextAttemptAt: now,
          leaseToken: null,
          leaseExpiresAt: null,
          lastError: null,
          printedAt: null,
        },
      });
      if (retried.count !== 1) {
        throw new BadRequestException("Print job state changed; refresh and retry");
      }
      await tx.receipt.update({
        where: { id: job.receiptId },
        data: { printed: false, printedAt: null },
      });
      await writeAuditLog(tx, {
        userId: user.id,
        action: "PRINT_JOB_RETRIED",
        entity: "PrintJob",
        entityId: id,
        metadata: {
          branchId: job.branchId,
          receiptId: job.receiptId,
          previousStatus: job.status,
          previousAttemptCount: job.attemptCount,
        },
      });
    });
    return this.prisma.printJob.findUnique({ where: { id } });
  }

  private buildEscPos(
    receipt: Prisma.ReceiptGetPayload<{
      include: {
        branch: true;
        order: { include: { items: true; payments: { include: { method: true; acceptedBy: true } }; closedBy: true } };
      };
    }>,
  ) {
    const content = receipt.content && typeof receipt.content === "object" && !Array.isArray(receipt.content)
      ? (receipt.content as Record<string, unknown>)
      : {};
    const isCancellation = receipt.documentType === "CANCELLATION" || content.documentType === "CANCELLATION";
    const isRefund = content.documentType === "REFUND";
    const isKitchen = receipt.documentType === "KITCHEN" || content.documentType === "KITCHEN";
    const cancellationReason = typeof content.cancellationReason === "string" ? content.cancellationReason : null;
    const branchName = textValue(content.branchName) ?? receipt.branch.name;
    const orderNumber = textValue(content.orderNumber) ?? receipt.order.orderNumber;
    const displayOrderNumber = textValue(content.displayOrderNumber) ?? receipt.order.displayOrderNumber ?? orderNumber;
    const dateTime = formatReceiptDateTime(textValue(content.dateTime), receipt.createdAt);
    const total = textValue(content.total) ?? receipt.total.toFixed(2);
    const snapshotItems = objectArray(content.items);
    const snapshotPayments = objectArray(content.payments);
    const itemCommands = snapshotItems.length > 0
      ? snapshotItems.map((item) => ({
          type: "item",
          name: [textValue(item.name), textValue(item.variant)].filter(Boolean).join(" "),
          quantity: formatReceiptQuantity(textValue(item.quantity) ?? ""),
          total: textValue(item.total) ?? "",
          notes: textValue(item.notes),
          modifiers: item.modifiers,
        }))
      : receipt.order.items.map((item) => ({
          type: "item",
          name: `${item.productName}${item.variantName ? ` ${item.variantName}` : ""}`,
          quantity: formatReceiptQuantity(item.quantity.toFixed(3)),
          total: item.totalPrice.toFixed(2),
        }));
    const paymentCommands = snapshotPayments.length > 0
      ? snapshotPayments.map((payment) => ({
          type: "payment",
          method: textValue(payment.method) ?? "To'lov",
          amount: textValue(payment.amount) ?? "",
        }))
      : receipt.order.payments.map((payment) => ({
          type: "payment",
          method: payment.method.code,
          amount: payment.amount.toFixed(2),
        }));

    return {
      encoding: "UTF-8",
      commands: [
        { type: "align", value: "center" },
        { type: "bold", value: true },
        { type: "text", value: "MAZETTO FOOD" },
        ...(isKitchen ? [{ type: "text", value: "*** OSHXONA BUYURTMASI ***" }, { type: "text", value: `#${displayOrderNumber}` }] : []),
        ...(isCancellation ? [{ type: "text", value: "*** BUYURTMA BEKOR QILINDI ***" }, ...(cancellationReason ? [{ type: "text", value: `Sabab: ${cancellationReason}` }] : [])] : []),
        ...(isRefund ? [{ type: "text", value: "*** TO'LOV QAYTARILDI ***" }, ...(textValue(content.refundReason) ? [{ type: "text", value: `Sabab: ${textValue(content.refundReason)}` }] : [])] : []),
        { type: "bold", value: false },
        { type: "text", value: branchName },
        { type: "line" },
        { type: "align", value: "left" },
        ...(!isKitchen ? [{ type: "text", value: `Chek: ${receipt.receiptNumber}` }] : []),
        { type: "text", value: `Buyurtma: ${displayOrderNumber}` },
        ...(isKitchen && textValue(content.orderType) ? [{ type: "text", value: `Turi: ${formatReceiptOrderType(textValue(content.orderType)!)}` }] : []),
        { type: "line" },
        ...itemCommands,
        { type: "line" },
        ...(!isKitchen ? paymentCommands : []),
        ...(!isKitchen ? [{ type: "total", value: total }] : []),
        ...(isKitchen && textValue(content.orderNotes) ? [{ type: "text", value: `Izoh: ${textValue(content.orderNotes)}` }] : []),
        { type: "text", value: `Vaqt: ${dateTime}` },
        { type: "cut" },
      ],
    };
  }
}

function textValue(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function objectArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item),
  );
}

function formatReceiptOrderType(value: string): string {
  switch (value) {
    case "DELIVERY":
      return "Yetkazib berish";
    case "DINE_IN":
      return "Zal";
    case "TAKEAWAY":
    case "PICKUP":
      return "Olib ketish";
    default:
      return value;
  }
}

function formatReceiptQuantity(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  if (Number.isInteger(numeric)) return String(numeric);
  return value.replace(/0+$/, "").replace(/\.$/, "");
}

function formatReceiptDateTime(value: string | null, fallback: Date): string {
  const parsed = value ? new Date(value) : null;
  const date = parsed && Number.isFinite(parsed.getTime()) ? parsed : fallback;
  return `${new Intl.DateTimeFormat("uz-UZ", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date)} Toshkent vaqti`;
}
