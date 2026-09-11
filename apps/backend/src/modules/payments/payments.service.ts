import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CashTransactionType,
  OrderSource,
  KitchenTicketStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
  RevenueRecordSource,
  TableStatus,
} from "@prisma/client";
import { createHash } from "node:crypto";
import { resolveBranchScope } from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { ensureOrderReceipt } from "../receipts/receipt-writer";
import type { ListPaymentsDto } from "./dto/list-payments.dto";
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

  /**
   * To'lovlar ro'yxati.
   *
   * Branch scope buyurtma orqali qo'llanadi (`Payment` da `branchId` yo'q).
   * `PAYMENT_VIEW` permission'i bilan himoyalangan — `PAYMENT_CREATE`
   * yozish uchun, bu esa ko'rish uchun.
   */
  async listPayments(query: ListPaymentsDto, user: AuthenticatedUser) {
    const branchId = resolveBranchScope(user, query.branchId);
    const paidAt =
      query.from || query.to
        ? {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          }
        : undefined;

    return this.prisma.payment.findMany({
      where: {
        ...(query.orderId ? { orderId: query.orderId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.methodCode ? { methodCode: query.methodCode } : {}),
        ...(paidAt ? { paidAt } : {}),
        ...(branchId ? { order: { branchId } } : {}),
      },
      orderBy: { createdAt: "desc" },
      skip: query.offset,
      take: query.limit,
      select: {
        id: true,
        amount: true,
        status: true,
        methodCode: true,
        reference: true,
        paidAt: true,
        createdAt: true,
        method: { select: { id: true, code: true, name: true } },
        acceptedBy: { select: { id: true, firstName: true, lastName: true } },
        order: {
          select: {
            id: true,
            orderNumber: true,
            displayOrderNumber: true,
            source: true,
            status: true,
            total: true,
            branch: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
  }

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
    transaction?: Prisma.TransactionClient,
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
      const execute = async (tx: Prisma.TransactionClient) => {
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

          await this.assertEmployeeInBranch(tx, employeeId, order.branchId);

          const tenders = this.normalizeTenders(dto.payments);
          const hasCashTender = tenders.some(
            (tender) => tender.paymentMethodCode === "CASH",
          );

          if (hasCashTender && !dto.shiftId) {
            throw new BadRequestException(
              "Cash payments require an open employee shift",
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
                "Cash payments require an open employee shift",
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

            const shouldCompleteOrder =
              paymentStatus === PaymentStatus.PAID &&
              order.source === OrderSource.POS &&
              order.status !== OrderStatus.COMPLETED;

            await tx.order.update({
              where: { id: order.id },
              data: {
                paymentStatus,
                ...(shouldCompleteOrder
                  ? {
                      status: OrderStatus.COMPLETED,
                      closedAt: now,
                      closedById: employeeId,
                    }
                  : {}),
              },
            });

            if (paymentStatus === PaymentStatus.PAID) {
              if (shouldCompleteOrder && order.tableId) {
                await tx.restaurantTable.update({
                  where: { id: order.tableId },
                  data: { status: TableStatus.AVAILABLE },
                });
              }

              if (shouldCompleteOrder) {
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
              }

              await ensureOrderReceipt(tx, order.id);
            }
          }

          await tx.paymentOperation.update({
            where: { id: operation.id },
            data: { status: "COMPLETED", completedAt: now },
          });

          return this.buildOperationResult(tx, operation.id, order.id);
        };
      return await (transaction
        ? execute(transaction)
        : this.prisma.$transaction(execute, {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          }));
    } catch (error) {
      // The owning transaction must roll back before a conflict can be retried.
      if (transaction) throw error;
      // FAQAT idempotency kaliti bo'yicha to'qnashuv shu yo'lga tushadi —
      // boshqa har qanday unique buzilishi o'z holicha ko'tariladi.
      if (this.isUniqueConstraintErrorOn(error, "idempotencyKey")) {
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

  /**
   * P2002 aynan berilgan ustun bo'yicha ko'tarilganmi.
   *
   * MUAMMO (PHASE 6 H4b). `createPayment` ning `catch` bloki HAR QANDAY P2002
   * ni "idempotency kaliti allaqachon ishlatilgan" deb talqin qilardi. Bir xil
   * tranzaksiya ichida `receiptNumber` ham yaratiladi va u ham `@unique` —
   * ya'ni chek raqami to'qnashuvi idempotency to'qnashuvi deb o'qilardi.
   * Natija: tranzaksiya bekor bo'lgani uchun `paymentOperation` qatori ham
   * yo'q edi va kassir "Payment operation could not be resolved" xatosini
   * ko'rardi — sababi bilan hech qanday aloqasi yo'q xabar.
   *
   * Prisma ustun nomini `meta.target` da beradi; u massiv ham, satr ham
   * bo'lishi mumkin, shuning uchun ikkalasi ham qo'llab-quvvatlanadi.
   */
  private isUniqueConstraintErrorOn(error: unknown, column: string): boolean {
    if (!this.isUniqueConstraintError(error)) {
      return false;
    }

    const target = (error as Prisma.PrismaClientKnownRequestError).meta?.target;

    if (Array.isArray(target)) {
      return target.includes(column);
    }

    if (typeof target === "string") {
      return target.includes(column);
    }

    // Ustun nomi aniqlanmasa idempotency yo'liga tushmaymiz: noto'g'ri talqin
    // qilishdan ko'ra xatoni ochiq ko'tarish xavfsizroq.
    return false;
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
