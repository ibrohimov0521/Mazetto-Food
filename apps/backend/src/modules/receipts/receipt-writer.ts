import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

export type OrderForReceipt = Prisma.OrderGetPayload<{
  include: {
    branch: true;
    items: true;
    payments: { include: { method: true } };
    receipts: true;
  };
}>;

export type ReceiptPrintRoute = "RECEIPT" | "CANCELLATION";
const RECEIPT_NUMBER_ATTEMPTS = 5;
// Explicit opt-in remains supported: MAZETTO_DURABLE_PRINT_JOBS === "true". Only an explicit false disables durable jobs.
const durablePrintJobsEnabled = () => process.env.MAZETTO_DURABLE_PRINT_JOBS !== "false";

function jsonObject(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function receiptPrintRoute(content: Prisma.JsonValue | null | undefined): ReceiptPrintRoute {
  return jsonObject(content).documentType === "CANCELLATION" ? "CANCELLATION" : "RECEIPT";
}

export function createReceiptNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `RCPT-${date}-${Math.floor(Math.random() * 900000 + 100000)}`;
}

export async function allocateReceiptNumber(tx: TransactionClient): Promise<string> {
  for (let attempt = 0; attempt < RECEIPT_NUMBER_ATTEMPTS; attempt += 1) {
    const candidate = createReceiptNumber();
    const existing = await tx.receipt.findUnique({ where: { receiptNumber: candidate }, select: { id: true } });
    if (!existing) return candidate;
  }
  throw new BadRequestException("Unable to allocate a receipt number");
}

function routeMatches(
  printer: { type: string; metadata: Prisma.JsonValue | null },
  route: ReceiptPrintRoute,
): boolean {
  const metadata = jsonObject(printer.metadata);
  const roles = Array.isArray(metadata.printRoles)
    ? metadata.printRoles.filter((role): role is string => typeof role === "string")
    : [];
  if (roles.length > 0) return roles.includes(route);
  return route === "RECEIPT" && (printer.type === "THERMAL" || printer.type === "RECEIPT");
}

/** Creates one durable job per active printer configured for this document route. */
export async function queuePrintJobsForReceipt(
  tx: TransactionClient,
  receipt: { id: string; branchId: string; content: Prisma.JsonValue | null },
): Promise<void> {
  if (!durablePrintJobsEnabled()) return;
  const route = receiptPrintRoute(receipt.content);
  const printers = await tx.printer.findMany({
    where: { branchId: receipt.branchId, isActive: true, status: "ONLINE" },
    select: { id: true, type: true, metadata: true },
  });
  const targets = printers.filter((printer) => routeMatches(printer, route));
  if (targets.length === 0) {
    await tx.printJob.create({ data: { receiptId: receipt.id, branchId: receipt.branchId, payload: receipt.content ?? {}, printerId: null } });
    return;
  }
  await tx.printJob.createMany({
    data: targets.map((printer) => ({
      receiptId: receipt.id,
      branchId: receipt.branchId,
      printerId: printer.id,
      payload: receipt.content ?? {},
    })),
  });
}

export async function writeReceiptRow(
  tx: TransactionClient,
  order: OrderForReceipt,
  options: { documentType?: ReceiptPrintRoute; cancellationReason?: string | null } = {},
): Promise<void> {
  const documentType = options.documentType ?? "RECEIPT";
  const receiptNumber = await allocateReceiptNumber(tx);
  const receipt = await tx.receipt.create({
    data: {
      orderId: order.id,
      branchId: order.branchId,
      receiptNumber,
      total: order.total,
      content: {
        title: "MAZETTO FOOD",
        documentType,
        statusLabel: documentType === "CANCELLATION" ? "BUYURTMA BEKOR QILINDI" : "SOTUV CHEKI",
        cancellationReason: options.cancellationReason ?? null,
        branchName: order.branch.name,
        orderNumber: order.orderNumber,
        items: order.items.map((item) => ({
          name: item.productName,
          variant: item.variantName,
          quantity: item.quantity.toFixed(3),
          total: item.totalPrice.toFixed(2),
        })),
        payments: order.payments.map((payment) => ({ method: payment.method.code, amount: payment.amount.toFixed(2) })),
        total: order.total.toFixed(2),
        dateTime: new Date().toISOString(),
      },
    },
  });
  await queuePrintJobsForReceipt(tx, receipt);
}

export async function ensureOrderReceipt(tx: TransactionClient, orderId: string): Promise<void> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { branch: true, items: true, payments: { include: { method: true } }, receipts: true },
  });
  if (!order || (order.receipts ?? []).length > 0) return;
  await writeReceiptRow(tx, order);
}

export async function ensureCancellationReceipt(
  tx: TransactionClient,
  orderId: string,
  reason?: string | null,
): Promise<void> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { branch: true, items: true, payments: { include: { method: true } }, receipts: true },
  });
  if (!order || !order.branch || !Array.isArray(order.items) || !Array.isArray(order.payments)) return;
  const alreadyCreated = (order.receipts ?? []).some((receipt) => receiptPrintRoute(receipt.content) === "CANCELLATION");
  if (alreadyCreated) return;
  await writeReceiptRow(tx, order, {
    documentType: "CANCELLATION",
    cancellationReason: reason || "Buyurtma bekor qilindi",
  });
}