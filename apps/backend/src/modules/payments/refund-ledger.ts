import { BadRequestException } from "@nestjs/common";
import {
  CashTransactionType,
  PaymentStatus,
  Prisma,
  RevenueRecordSource,
} from "@prisma/client";
import { writeAuditLog } from "../audit/audit-write";
import { ensureRefundReceipt } from "../receipts/receipt-writer";

type TransactionClient = Prisma.TransactionClient;

export type RefundablePayment = {
  id: string;
  orderId: string;
  amount: Prisma.Decimal;
  status: PaymentStatus;
  method: { code: string };
  refunds: { amount: Prisma.Decimal }[];
};

export type CashRefundAllocation = {
  payment: RefundablePayment;
  amount: Prisma.Decimal;
};

export function planCashRefunds(
  payments: RefundablePayment[],
  requestedAmount: Prisma.Decimal,
): CashRefundAllocation[] {
  if (requestedAmount.lessThanOrEqualTo(0)) return [];

  let remaining = requestedAmount;
  const allocations: CashRefundAllocation[] = [];
  for (const payment of payments) {
    const isSuccessful =
      payment.status === PaymentStatus.SUCCESS ||
      payment.status === PaymentStatus.PAID ||
      payment.status === PaymentStatus.PARTIALLY_REFUNDED;
    if (payment.method.code !== "CASH" || !isSuccessful) {
      continue;
    }

    const refunded = payment.refunds.reduce(
      (total, refund) => total.add(refund.amount),
      new Prisma.Decimal(0),
    );
    const available = Prisma.Decimal.max(payment.amount.sub(refunded), 0);
    if (available.isZero()) continue;

    const amount = Prisma.Decimal.min(available, remaining);
    allocations.push({ payment, amount });
    remaining = remaining.sub(amount);
    if (remaining.isZero()) break;
  }

  if (remaining.greaterThan(0)) {
    throw new BadRequestException(
      `Naqd to'lovlardan qaytarish uchun yetarli qoldiq yo'q. Yetishmayotgan summa: ${remaining.toFixed(2)} so'm.`,
    );
  }
  return allocations;
}

export async function recordCashRefund(
  tx: TransactionClient,
  input: {
    payment: RefundablePayment;
    orderItemId?: string | null;
    branchId: string;
    shiftId: string;
    employeeId: string;
    createdById: string;
    tenantId: string | null;
    amount: Prisma.Decimal;
    reason: string;
    idempotencyKey: string;
  },
) {
  const { payment, amount } = input;
  const refundedBefore = payment.refunds.reduce(
    (total, refund) => total.add(refund.amount),
    new Prisma.Decimal(0),
  );
  const refundedAfter = refundedBefore.add(amount);
  if (
    amount.lessThanOrEqualTo(0) ||
    refundedAfter.greaterThan(payment.amount)
  ) {
    throw new BadRequestException(
      "Qaytariladigan summa to'lov qoldig'idan oshib ketdi.",
    );
  }

  const fullRefund = refundedAfter.equals(payment.amount);
  const refundedAt = new Date();
  const refund = await tx.paymentRefund.create({
    data: {
      paymentId: payment.id,
      orderItemId: input.orderItemId ?? null,
      branchId: input.branchId,
      shiftId: input.shiftId,
      employeeId: input.employeeId,
      createdById: input.createdById,
      amount,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
    },
  });

  await tx.payment.update({
    where: { id: payment.id },
    data: {
      status: fullRefund
        ? PaymentStatus.REFUNDED
        : PaymentStatus.PARTIALLY_REFUNDED,
      refundedAt: fullRefund ? refundedAt : null,
    },
  });
  await tx.revenueRecord.create({
    data: {
      branchId: input.branchId,
      orderId: payment.orderId,
      paymentId: payment.id,
      shiftId: input.shiftId,
      employeeId: input.employeeId,
      source: RevenueRecordSource.ADJUSTMENT,
      amount: amount.negated(),
      description: `Cash refund: ${input.reason}`,
    },
  });
  await tx.cashTransaction.create({
    data: {
      branchId: input.branchId,
      shiftId: input.shiftId,
      employeeId: input.employeeId,
      orderId: payment.orderId,
      paymentId: payment.id,
      type: CashTransactionType.REFUND,
      amount,
      reason: input.reason,
      createdById: input.createdById,
    },
  });
  await ensureRefundReceipt(tx, payment.id, input.reason, amount, refund.id);
  await writeAuditLog(tx, {
    tenantId: input.tenantId,
    userId: input.createdById,
    action: "PAYMENT_REFUNDED",
    entity: "PaymentRefund",
    entityId: refund.id,
    metadata: {
      branchId: input.branchId,
      orderId: payment.orderId,
      paymentId: payment.id,
      orderItemId: input.orderItemId ?? null,
      shiftId: input.shiftId,
      amount: amount.toFixed(2),
      reason: input.reason,
    },
  });

  return refund;
}
