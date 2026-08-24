import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CashTransactionType,
  KitchenTicketStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
  RevenueRecordSource,
  TableStatus,
} from "@prisma/client";
import { createHash } from "node:crypto";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  CreatePaymentDto,
  PaymentTenderDto,
  ProcessOrderPaymentDto,
} from "./dto/create-payment.dto";

type NormalizedPaymentTender = {
  paymentMethodId?: string;
  paymentMethodCode?: string;
  amount: Prisma.Decimal;
  transactionId?: string;
};

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createPayment(dto: CreatePaymentDto, user: AuthenticatedUser) {
    const tender: PaymentTenderDto = {
      amount: dto.amount,
    };

    if (dto.paymentMethodId) {
      tender.paymentMethodId = dto.paymentMethodId;
    }

    if (dto.paymentMethodCode) {
      tender.paymentMethodCode = dto.paymentMethodCode;
    }

    const transactionId = dto.transactionId ?? dto.reference;

    if (transactionId) {
      tender.transactionId = transactionId;
    }

    const processDto: ProcessOrderPaymentDto = {
      orderId: dto.orderId,
      idempotencyKey: dto.idempotencyKey,
      payments: [tender],
    };

    if (dto.shiftId) {
      processDto.shiftId = dto.shiftId;
    }

    return this.processOrderPayment(
      processDto,
      user,
      dto.employeeId,
      dto.status,
      dto.reference,
    );
  }

  async processOrderPayment(
    dto: ProcessOrderPaymentDto,
    user: AuthenticatedUser,
    overrideEmployeeId?: string,
    requestedStatus?: PaymentStatus,
    reference?: string,
  ) {
    const employeeId = overrideEmployeeId ?? user.employeeId;

    if (!employeeId) {
      throw new ForbiddenException(
        "Authenticated user is not linked to an employee",
      );
    }

    const status = requestedStatus ?? PaymentStatus.SUCCESS;

    if (status !== PaymentStatus.SUCCESS) {
      throw new BadRequestException(
        "Normal payment processing only supports successful payments",
      );
    }

    const requestHash = this.createRequestHash(
      dto,
      status,
      reference,
      employeeId,
    );

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const existingOperation = await tx.paymentOperation.findUnique({
            where: { idempotencyKey: dto.idempotencyKey },
          });

          if (existingOperation) {
            return this.resolveExistingOperation(
              tx,
              existingOperation,
              requestHash,
            );
          }

          const operation = await tx.paymentOperation.create({
            data: {
              orderId: dto.orderId,
              idempotencyKey: dto.idempotencyKey,
              requestHash,
              status: "PROCESSING",
              createdById: user.id,
              employeeId,
            },
          });

          await tx.$executeRaw`SELECT id FROM "orders" WHERE id = ${dto.orderId} FOR UPDATE`;
          const order = await tx.order.findUnique({
            where: { id: dto.orderId },
            include: { payments: true, receipts: true },
          });

          if (!order) {
            throw new NotFoundException("Order not found");
          }

          if (order.status === OrderStatus.CANCELLED) {
            throw new BadRequestException("Cancelled orders cannot be paid");
          }

          if (order.status === OrderStatus.COMPLETED) {
            throw new BadRequestException(
              "Completed orders cannot receive new payments",
            );
          }

          await this.assertEmployeeInBranch(tx, employeeId, order.branchId);

          const tenders = this.normalizeTenders(dto.payments);
          const hasCashTender = tenders.some(
            (tender) => tender.paymentMethodCode === "CASH",
          );

          if (hasCashTender && !dto.shiftId) {
            throw new BadRequestException(
              "Cash payments require an open cashier shift",
            );
          }

          if (dto.shiftId) {
            await this.assertOpenShift(
              tx,
              dto.shiftId,
              order.branchId,
              employeeId,
            );
          }

          const existingPaidTotal = this.sumSuccessfulPayments(order.payments);
          const outstanding = order.total.sub(existingPaidTotal);
          const requestTotal = tenders.reduce(
            (total, tender) => total.add(tender.amount),
            new Prisma.Decimal(0),
          );

          if (outstanding.lessThanOrEqualTo(0)) {
            throw new BadRequestException("Order has no outstanding balance");
          }

          if (requestTotal.lessThanOrEqualTo(0)) {
            throw new BadRequestException(
              "Payment amount must be greater than zero",
            );
          }

          if (requestTotal.greaterThan(outstanding)) {
            throw new BadRequestException(
              "Payment amount exceeds outstanding balance",
            );
          }

          if (tenders.length > 1 && !requestTotal.equals(outstanding)) {
            throw new BadRequestException(
              "Mixed payment total must exactly match outstanding balance",
            );
          }

          const now = new Date();
          const createdPayments: {
            payment: Prisma.PaymentGetPayload<Record<string, never>>;
            method: Prisma.PaymentMethodGetPayload<Record<string, never>>;
          }[] = [];

          for (const [index, tender] of tenders.entries()) {
            const method = await this.resolvePaymentMethod(
              tx,
              order.branchId,
              tender,
            );

            if (method.code === "CASH" && !dto.shiftId) {
              throw new BadRequestException(
                "Cash payments require an open cashier shift",
              );
            }

            const payment = await tx.payment.create({
              data: {
                orderId: order.id,
                paymentMethodId: method.id,
                paymentOperationId: operation.id,
                operationTenderIndex: index,
                acceptedById: employeeId,
                createdById: user.id,
                amount: tender.amount,
                status,
                methodCode: method.code,
                transactionId: tender.transactionId ?? null,
                reference: reference ?? tender.transactionId ?? null,
                paidAt: this.isSuccessfulPayment(status) ? now : null,
              },
            });
            createdPayments.push({ payment, method });
          }

          if (this.isSuccessfulPayment(status)) {
            for (const { payment, method } of createdPayments) {
              await tx.revenueRecord.create({
                data: {
                  branchId: order.branchId,
                  orderId: order.id,
                  paymentId: payment.id,
                  shiftId: dto.shiftId ?? null,
                  employeeId,
                  source: RevenueRecordSource.ORDER,
                  amount: payment.amount,
                  description: `Payment ${method.code}`,
                },
              });

              if (method.code === "CASH" && dto.shiftId) {
                await tx.cashTransaction.create({
                  data: {
                    branchId: order.branchId,
                    shiftId: dto.shiftId,
                    employeeId,
                    orderId: order.id,
                    paymentId: payment.id,
                    type: CashTransactionType.SALE,
                    amount: payment.amount,
                    reason: "Cash payment",
                    createdById: user.id,
                  },
                });
              }
            }

            const paidTotal = existingPaidTotal.add(requestTotal);
            const paymentStatus = paidTotal.greaterThanOrEqualTo(order.total)
              ? PaymentStatus.PAID
              : PaymentStatus.PENDING;

            await tx.order.update({
              where: { id: order.id },
              data: {
                paymentStatus,
                ...(paymentStatus === PaymentStatus.PAID
                  ? {
                      status: OrderStatus.COMPLETED,
                      closedAt: now,
                      closedById: employeeId,
                    }
                  : {}),
              },
            });

            if (paymentStatus === PaymentStatus.PAID) {
              if (order.tableId) {
                await tx.restaurantTable.update({
                  where: { id: order.tableId },
                  data: { status: TableStatus.AVAILABLE },
                });
              }

              await tx.orderStatusHistory.create({
                data: {
                  orderId: order.id,
                  fromStatus: order.status,
                  toStatus: OrderStatus.COMPLETED,
                  changedByUserId: user.id,
                  changedByEmployeeId: employeeId,
                  reason: "Order completed after payment",
                },
              });

              await tx.kitchenTicket.updateMany({
                where: {
                  orderId: order.id,
                  status: {
                    in: [
                      KitchenTicketStatus.NEW,
                      KitchenTicketStatus.ACCEPTED,
                      KitchenTicketStatus.COOKING,
                      KitchenTicketStatus.READY,
                    ],
                  },
                },
                data: {
                  status: KitchenTicketStatus.COMPLETED,
                  completedAt: now,
                },
              });

              await this.createReceipt(tx, order.id);
            }
          }

          await tx.paymentOperation.update({
            where: { id: operation.id },
            data: { status: "COMPLETED", completedAt: now },
          });

          return this.buildOperationResult(tx, operation.id, order.id);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        return this.resolveExistingOperationByKey(
          dto.idempotencyKey,
          requestHash,
        );
      }

      throw error;
    }
  }

  private sumSuccessfulPayments(
    payments: { amount: Prisma.Decimal; status: PaymentStatus }[],
  ) {
    return payments.reduce(
      (total, payment) =>
        this.isSuccessfulPayment(payment.status)
          ? total.add(payment.amount)
          : total,
      new Prisma.Decimal(0),
    );
  }

  private requirePaymentMethodCode(code: string | undefined): string {
    if (!code) {
      throw new BadRequestException(
        "paymentMethodId or paymentMethodCode is required",
      );
    }

    return code.toUpperCase();
  }

  private async resolvePaymentMethod(
    tx: Prisma.TransactionClient,
    branchId: string,
    tender: PaymentTenderDto | NormalizedPaymentTender,
  ) {
    const method = tender.paymentMethodId
      ? await tx.paymentMethod.findFirst({
          where: {
            id: tender.paymentMethodId,
            isActive: true,
            OR: [{ branchId }, { branchId: null }],
          },
          orderBy: { branchId: "desc" },
        })
      : await tx.paymentMethod.findFirst({
          where: {
            code: this.requirePaymentMethodCode(tender.paymentMethodCode),
            isActive: true,
            OR: [{ branchId }, { branchId: null }],
          },
          orderBy: { branchId: "desc" },
        });

    if (!method) {
      throw new NotFoundException("Active payment method not found");
    }

    return method;
  }

  private isSuccessfulPayment(status: PaymentStatus): boolean {
    return status === PaymentStatus.SUCCESS || status === PaymentStatus.PAID;
  }

  private normalizeTenders(
    payments: PaymentTenderDto[],
  ): NormalizedPaymentTender[] {
    return payments.map((payment) => {
      const amount = new Prisma.Decimal(payment.amount);

      if (amount.lessThanOrEqualTo(0)) {
        throw new BadRequestException(
          "Payment amount must be greater than zero",
        );
      }

      const normalized: NormalizedPaymentTender = { amount };

      if (payment.paymentMethodId) {
        normalized.paymentMethodId = payment.paymentMethodId;
      }

      if (payment.paymentMethodCode) {
        normalized.paymentMethodCode = payment.paymentMethodCode.toUpperCase();
      }

      if (payment.transactionId) {
        normalized.transactionId = payment.transactionId;
      }

      return normalized;
    });
  }

  private createRequestHash(
    dto: ProcessOrderPaymentDto,
    status: PaymentStatus,
    reference: string | undefined,
    employeeId: string,
  ): string {
    const normalized = {
      orderId: dto.orderId,
      shiftId: dto.shiftId ?? null,
      status,
      reference: reference ?? null,
      employeeId,
      payments: this.normalizeTenders(dto.payments).map((payment) => ({
        paymentMethodId: payment.paymentMethodId ?? null,
        paymentMethodCode: payment.paymentMethodCode ?? null,
        amount: payment.amount.toFixed(2),
        transactionId: payment.transactionId ?? null,
      })),
    };

    return createHash("sha256")
      .update(JSON.stringify(normalized))
      .digest("hex");
  }

  private async resolveExistingOperation(
    tx: Prisma.TransactionClient,
    operation: {
      id: string;
      orderId: string;
      requestHash: string;
      status: string;
    },
    requestHash: string,
  ) {
    if (operation.requestHash !== requestHash) {
      throw new BadRequestException(
        "Idempotency key was already used with a different payload",
      );
    }

    if (operation.status !== "COMPLETED") {
      throw new BadRequestException("Payment operation is already in progress");
    }

    return this.buildOperationResult(tx, operation.id, operation.orderId);
  }

  private async resolveExistingOperationByKey(
    idempotencyKey: string,
    requestHash: string,
  ) {
    const operation = await this.prisma.paymentOperation.findUnique({
      where: { idempotencyKey },
    });

    if (!operation) {
      throw new BadRequestException("Payment operation could not be resolved");
    }

    if (operation.requestHash !== requestHash) {
      throw new BadRequestException(
        "Idempotency key was already used with a different payload",
      );
    }

    if (operation.status !== "COMPLETED") {
      throw new BadRequestException("Payment operation is already in progress");
    }

    return this.prisma.$transaction((tx) =>
      this.buildOperationResult(tx, operation.id, operation.orderId),
    );
  }

  private async buildOperationResult(
    tx: Prisma.TransactionClient,
    operationId: string,
    orderId: string,
  ) {
    return {
      operation: await tx.paymentOperation.findUnique({
        where: { id: operationId },
        select: {
          id: true,
          idempotencyKey: true,
          status: true,
          completedAt: true,
        },
      }),
      payments: await tx.payment.findMany({
        where: { paymentOperationId: operationId },
        include: {
          method: true,
          order: true,
          acceptedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { operationTenderIndex: "asc" },
      }),
      order: await tx.order.findUnique({
        where: { id: orderId },
        include: {
          table: true,
          payments: { include: { method: true } },
          receipts: true,
        },
      }),
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }

  private async createReceipt(
    tx: Prisma.TransactionClient,
    orderId: string,
  ): Promise<void> {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        branch: true,
        items: true,
        payments: { include: { method: true } },
        receipts: true,
      },
    });

    if (!order || order.receipts.length > 0) {
      return;
    }

    await tx.receipt.create({
      data: {
        orderId: order.id,
        branchId: order.branchId,
        receiptNumber: this.createReceiptNumber(),
        total: order.total,
        content: {
          title: "MAZETTO FOOD",
          branchName: order.branch.name,
          orderNumber: order.orderNumber,
          items: order.items.map((item) => ({
            name: item.productName,
            variant: item.variantName,
            quantity: item.quantity.toFixed(3),
            total: item.totalPrice.toFixed(2),
          })),
          payments: order.payments.map((payment) => ({
            method: payment.method.code,
            amount: payment.amount.toFixed(2),
          })),
          total: order.total.toFixed(2),
          dateTime: new Date().toISOString(),
        },
      },
    });
  }

  private createReceiptNumber(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replaceAll("-", "");
    return `RCPT-${date}-${Math.floor(Math.random() * 900000 + 100000)}`;
  }

  private async assertEmployeeInBranch(
    tx: Prisma.TransactionClient,
    employeeId: string,
    branchId: string,
  ): Promise<void> {
    const employee = await tx.employee.findFirst({
      where: { id: employeeId, branchId, status: "ACTIVE" },
    });

    if (!employee) {
      throw new ForbiddenException("Employee is not active in this branch");
    }
  }

  private async assertOpenShift(
    tx: Prisma.TransactionClient,
    shiftId: string,
    branchId: string,
    employeeId: string,
  ): Promise<void> {
    const shift = await tx.shift.findFirst({
      where: {
        id: shiftId,
        branchId,
        employeeId,
        status: "OPEN",
      },
    });

    if (!shift) {
      throw new BadRequestException(
        "Open shift not found for this employee and branch",
      );
    }
  }
}
