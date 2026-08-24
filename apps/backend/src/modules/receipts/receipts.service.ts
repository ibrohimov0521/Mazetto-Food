import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { resolveBranchScope } from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ReceiptsService {
  constructor(private readonly prisma: PrismaService) {}

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

  private buildEscPos(
    receipt: Prisma.ReceiptGetPayload<{
      include: {
        branch: true;
        order: { include: { items: true; payments: { include: { method: true; acceptedBy: true } }; closedBy: true } };
      };
    }>,
  ) {
    return {
      encoding: "UTF-8",
      commands: [
        { type: "align", value: "center" },
        { type: "bold", value: true },
        { type: "text", value: "MAZETTO FOOD" },
        { type: "bold", value: false },
        { type: "text", value: receipt.branch.name },
        { type: "line" },
        { type: "align", value: "left" },
        { type: "text", value: `Receipt: ${receipt.receiptNumber}` },
        { type: "text", value: `Order: ${receipt.order.orderNumber}` },
        { type: "line" },
        ...receipt.order.items.map((item) => ({
          type: "item",
          name: `${item.productName}${item.variantName ? ` ${item.variantName}` : ""}`,
          quantity: item.quantity.toFixed(3),
          total: item.totalPrice.toFixed(2),
        })),
        { type: "line" },
        ...receipt.order.payments.map((payment) => ({
          type: "payment",
          method: payment.method.code,
          amount: payment.amount.toFixed(2),
        })),
        { type: "total", value: receipt.total.toFixed(2) },
        { type: "text", value: `Date: ${receipt.createdAt.toISOString()}` },
        { type: "cut" },
      ],
    };
  }
}
