import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CustomerOrderAttemptStatus,
  CustomerOrderType,
  OrderItemStatus,
  OrderSource,
  OrderStatus,
  OrderType,
  Prisma,
} from "@prisma/client";
import { createHash, randomInt } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { BranchesService } from "../branches/branches.service";
import { KitchenService } from "../kitchen/kitchen.service";
import { OrdersService } from "../orders/orders.service";
import { customerVisibleProductCodes } from "./customer-catalog-visibility";
import type {
  CustomerCheckoutQuoteDto,
  CreateOnlineOrderDto,
  OnlineOrderItemDto,
  OnlineOrderModifierDto,
} from "./dto/customer.dto";
import { OnlineOrderTypeDto, OnlinePaymentMethodDto } from "./dto/customer.dto";

type TransactionClient = Prisma.TransactionClient;
type ModifierSnapshot = {
  id: string;
  code: string;
  name: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
};
type CustomerOrderAttemptRecord = {
  id: string;
  status: CustomerOrderAttemptStatus;
  requestHash: string;
  customerOrderId: string | null;
  createdAt: Date;
  expiresAt: Date;
};
type CustomerOrderAttemptReservation = CustomerOrderAttemptRecord & {
  created: boolean;
};

const CUSTOMER_ORDER_ATTEMPT_TTL_MS = 24 * 60 * 60 * 1000;
const CUSTOMER_ORDER_ATTEMPT_WAIT_MS = 15000;
const CUSTOMER_ORDER_STALE_PENDING_MS = 2 * 60 * 1000;
const operationalCustomerPaymentMethods = [OnlinePaymentMethodDto.CASH] as const;

@Injectable()
export class CustomerOrderEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchesService: BranchesService,
    private readonly kitchenService: KitchenService,
    private readonly ordersService: OrdersService,
  ) {}

  async createOnlineOrder(
    customerId: string,
    dto: CreateOnlineOrderDto,
    options?: { source?: OrderSource; orderNumberPrefix?: string },
  ) {
    let kitchenTicket: Awaited<
      ReturnType<KitchenService["createTicketForOrder"]>
    > | null = null;
    const requestHash = this.hashCheckoutRequest(dto);
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    this.assertCustomerPaymentMethodSupported(dto.paymentMethod);

    const attempt = dto.idempotencyKey
      ? await this.reserveCustomerOrderAttempt(
          customerId,
          dto.idempotencyKey,
          requestHash,
        )
      : null;

    if (attempt?.customerOrderId) {
      return this.getCustomerOrderResult(this.prisma, attempt.customerOrderId);
    }

    try {
      await this.branchesService.assertCustomerBranchAcceptsOrder(
        dto.branchId,
        dto.type,
      );

      if (dto.type === OnlineOrderTypeDto.DELIVERY && !dto.address) {
        throw new BadRequestException("Delivery address is required");
      }

      const result = await this.prisma.$transaction(
        async (tx) => {
          const order = await tx.order.create({
            data: {
              branchId: dto.branchId,
              orderNumber: this.createOrderNumber(
                options?.orderNumberPrefix ?? "WEB",
              ),
              source: options?.source ?? OrderSource.WEB,
              type:
                dto.type === OnlineOrderTypeDto.DELIVERY
                  ? OrderType.DELIVERY
                  : OrderType.TAKEAWAY,
              status: OrderStatus.NEW,
              customerName: dto.name ?? customer.name,
              customerPhone: customer.phone,
              deliveryAddress: dto.address ?? null,
              notes: dto.notes ?? null,
              kitchenComment:
                dto.type === OnlineOrderTypeDto.DELIVERY
                  ? `Delivery: ${dto.address}`
                  : "Pickup order",
            },
          });

          let subtotal = new Prisma.Decimal(0);
          for (const item of dto.items) {
            const snapshot = await this.createItemSnapshot(
              tx,
              dto.branchId,
              item,
            );
            subtotal = subtotal.add(snapshot.totalPrice);
            await tx.orderItem.create({
              data: {
                orderId: order.id,
                productId: item.productId,
                variantId: item.variantId ?? null,
                productName: snapshot.productName,
                variantName: snapshot.variantName ?? null,
                quantity: snapshot.quantity,
                unitPrice: snapshot.unitPrice,
                totalPrice: snapshot.totalPrice,
                modifierSnapshot: snapshot.modifiers,
                notes: item.notes ?? null,
              },
            });
          }

          const pricing = this.composeCustomerOrderPricing(dto.type, subtotal);
          await this.recalculateOrderTotals(tx, order.id, pricing.deliveryFee);
          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              toStatus: OrderStatus.NEW,
              reason:
                options?.source === OrderSource.TELEGRAM
                  ? "Telegram order created"
                  : "Online order created",
            },
          });

          const confirmed = await this.ordersService.confirmOrderForPreparation(
            tx,
            {
              orderId: order.id,
              reason:
                options?.source === OrderSource.TELEGRAM
                  ? "Telegram order accepted for preparation"
                  : "Online order accepted for preparation",
            },
          );

          const customerOrder = await tx.customerOrder.create({
            data: {
              customerId,
              branchId: dto.branchId,
              orderId: order.id,
              type:
                dto.type === OnlineOrderTypeDto.DELIVERY
                  ? CustomerOrderType.DELIVERY
                  : CustomerOrderType.PICKUP,
              paymentMethod: dto.paymentMethod,
              deliveryAddress: dto.address ?? null,
              notes: dto.notes ?? null,
            },
          });

          if (attempt) {
            await tx.customerOrderAttempt.update({
              where: { id: attempt.id },
              data: {
                status: CustomerOrderAttemptStatus.COMPLETED,
                customerOrderId: customerOrder.id,
                completedAt: new Date(),
              },
            });
          }

          kitchenTicket = confirmed.kitchenTicket;
          const operationalOrder = await tx.order.findUnique({
            where: { id: order.id },
            include: { items: true, kitchenTickets: true },
          });

          return {
            customerOrder: this.withDerivedCustomerOrderStatus({
              ...customerOrder,
              order: operationalOrder,
            }),
            order: operationalOrder,
          };
        },
        { timeout: 15000 },
      );

      this.kitchenService.emitOrderCreated(result.order);
      this.kitchenService.emitOrderConfirmed(result.order);

      if (kitchenTicket) {
        this.kitchenService.emitOrderSentToKitchen(kitchenTicket);
      }

      return result;
    } catch (error) {
      if (attempt?.created) {
        await this.releaseCustomerOrderAttempt(attempt.id);
      }

      throw error;
    }
  }

  async quoteCheckout(customerId: string, dto: CustomerCheckoutQuoteDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    await this.branchesService.assertCustomerBranchAcceptsOrder(
      dto.branchId,
      dto.type,
    );

    const pricing = await this.prisma.$transaction(async (tx) =>
      this.composeCustomerOrderPricing(
        dto.type,
        (
          await this.calculateCustomerOrderPricing(
            tx,
            dto.branchId,
            dto.items,
          )
        ).subtotal,
      ),
    );

    return {
      subtotal: pricing.subtotal.toFixed(2),
      deliveryFee: pricing.deliveryFee.toFixed(2),
      total: pricing.total.toFixed(2),
      paymentMethods: this.customerPaymentMethods(),
    };
  }

  private async reserveCustomerOrderAttempt(
    customerId: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<CustomerOrderAttemptReservation> {
    const expiresAt = new Date(Date.now() + CUSTOMER_ORDER_ATTEMPT_TTL_MS);

    try {
      const attempt = await this.prisma.customerOrderAttempt.create({
        data: {
          customerId,
          idempotencyKey,
          requestHash,
          expiresAt,
        },
        select: this.customerOrderAttemptSelect(),
      });

      return { ...attempt, created: true };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
        throw error;
      }

      if (error.code !== "P2002") {
        throw error;
      }
    }

    const existing = await this.waitForCustomerOrderAttempt(
      customerId,
      idempotencyKey,
      requestHash,
    );

    if (!existing) {
      return this.reserveCustomerOrderAttempt(
        customerId,
        idempotencyKey,
        requestHash,
      );
    }

    return { ...existing, created: false };
  }

  private async waitForCustomerOrderAttempt(
    customerId: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<CustomerOrderAttemptRecord | null> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < CUSTOMER_ORDER_ATTEMPT_WAIT_MS) {
      const existing = await this.prisma.customerOrderAttempt.findUnique({
        where: {
          customerId_idempotencyKey: {
            customerId,
            idempotencyKey,
          },
        },
        select: this.customerOrderAttemptSelect(),
      });

      if (!existing) {
        break;
      }

      if (existing.requestHash !== requestHash) {
        throw new ConflictException(
          "Idempotency key was already used with a different checkout request",
        );
      }

      if (existing.customerOrderId) {
        if (existing.status !== CustomerOrderAttemptStatus.COMPLETED) {
          await this.prisma.customerOrderAttempt.update({
            where: { id: existing.id },
            data: {
              status: CustomerOrderAttemptStatus.COMPLETED,
              completedAt: new Date(),
            },
          });
        }

        return existing;
      }

      if (this.isStalePendingAttempt(existing)) {
        await this.prisma.customerOrderAttempt.delete({
          where: { id: existing.id },
        });
        return null;
      }

      if (existing.expiresAt.getTime() <= Date.now()) {
        throw new ConflictException(
          "Previous checkout attempt expired. Please submit again with a new idempotency key.",
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    const stale = await this.prisma.customerOrderAttempt.findUnique({
      where: {
        customerId_idempotencyKey: {
          customerId,
          idempotencyKey,
        },
      },
      select: this.customerOrderAttemptSelect(),
    });

    if (
      stale &&
      stale.requestHash === requestHash &&
      this.isStalePendingAttempt(stale)
    ) {
      await this.prisma.customerOrderAttempt.delete({
        where: { id: stale.id },
      });
      return null;
    }

    throw new ConflictException(
      "Checkout is already being processed. Please wait and try again.",
    );
  }

  private isStalePendingAttempt(attempt: CustomerOrderAttemptRecord): boolean {
    return (
      attempt.status === CustomerOrderAttemptStatus.PENDING &&
      !attempt.customerOrderId &&
      Date.now() - attempt.createdAt.getTime() >= CUSTOMER_ORDER_STALE_PENDING_MS
    );
  }

  private async releaseCustomerOrderAttempt(attemptId: string): Promise<void> {
    await this.prisma.customerOrderAttempt
      .delete({ where: { id: attemptId } })
      .catch(() => undefined);
  }

  private customerOrderAttemptSelect() {
    return {
      id: true,
      status: true,
      requestHash: true,
      customerOrderId: true,
      createdAt: true,
      expiresAt: true,
    } satisfies Prisma.CustomerOrderAttemptSelect;
  }

  private async getCustomerOrderResult(
    client: PrismaService | TransactionClient,
    customerOrderId: string,
  ) {
    const customerOrder = await client.customerOrder.findUniqueOrThrow({
      where: { id: customerOrderId },
      include: {
        order: { include: { items: true, kitchenTickets: true } },
      },
    });

    return {
      customerOrder: this.withDerivedCustomerOrderStatus(customerOrder),
      order: customerOrder.order,
    };
  }

  private hashCheckoutRequest(dto: CreateOnlineOrderDto): string {
    const payload = {
      branchId: dto.branchId,
      name: dto.name?.trim() ?? null,
      phone: dto.phone?.trim() ?? null,
      type: dto.type,
      address: dto.address?.trim() ?? null,
      paymentMethod: dto.paymentMethod,
      notes: dto.notes?.trim() ?? null,
      items: dto.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        notes: item.notes?.trim() ?? null,
        modifiers: (item.modifiers ?? []).map((modifier) => ({
          modifierId: modifier.modifierId,
          quantity: modifier.quantity ?? 1,
        })),
      })),
    };

    return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  }

  private async createItemSnapshot(
    tx: TransactionClient,
    branchId: string,
    dto: OnlineOrderItemDto,
  ) {
    const product = await tx.product.findFirst({
      where: {
        id: dto.productId,
        isAvailable: true,
        code: { in: [...customerVisibleProductCodes] },
        OR: [{ branchId }, { branchId: null }],
        ...this.branchesService.getUnavailableProductWhere(branchId),
      },
      include: { variants: true },
    });

    if (!product) {
      throw new NotFoundException("Product not found or unavailable");
    }

    const variant = dto.variantId
      ? product.variants.find(
          (candidate) =>
            candidate.id === dto.variantId && candidate.isAvailable,
        )
      : product.variants.find(
          (candidate) => candidate.isDefault && candidate.isAvailable,
        );

    if (dto.variantId && !variant) {
      throw new NotFoundException("Product variant not found or unavailable");
    }

    const quantity = new Prisma.Decimal(dto.quantity);
    const unitPrice = variant?.sellingPrice ?? product.sellingPrice;
    const modifiers = await this.createModifierSnapshot(
      tx,
      product.id,
      dto.modifiers ?? [],
    );

    return {
      productName: product.name,
      variantName: variant?.name,
      quantity,
      unitPrice,
      totalPrice: unitPrice.add(this.modifierTotal(modifiers)).mul(quantity),
      modifiers,
    };
  }

  private async createModifierSnapshot(
    tx: TransactionClient,
    productId: string,
    modifiers: OnlineOrderModifierDto[],
  ): Promise<ModifierSnapshot[]> {
    if (!modifiers.length) {
      return [];
    }

    const modifierIds = [
      ...new Set(modifiers.map((modifier) => modifier.modifierId)),
    ];
    const productModifiers = await tx.productModifier.findMany({
      where: {
        productId,
        modifierId: { in: modifierIds },
        modifier: { isActive: true },
      },
      include: { modifier: true },
    });

    return modifiers.map((selected) => {
      const productModifier = productModifiers.find(
        (candidate) => candidate.modifierId === selected.modifierId,
      );

      if (!productModifier) {
        throw new BadRequestException(
          "Modifier is not available for this product",
        );
      }

      const quantity = new Prisma.Decimal(selected.quantity ?? 1);
      const totalPrice = productModifier.modifier.price.mul(quantity);

      return {
        id: productModifier.modifier.id,
        code: productModifier.modifier.code,
        name: productModifier.modifier.name,
        quantity: quantity.toFixed(3),
        unitPrice: productModifier.modifier.price.toFixed(2),
        totalPrice: totalPrice.toFixed(2),
      };
    });
  }

  private modifierTotal(modifiers: ModifierSnapshot[]) {
    return modifiers.reduce(
      (total, modifier) => total.add(new Prisma.Decimal(modifier.totalPrice)),
      new Prisma.Decimal(0),
    );
  }

  private async calculateCustomerOrderPricing(
    tx: TransactionClient,
    branchId: string,
    items: OnlineOrderItemDto[],
  ) {
    const snapshots = await Promise.all(
      items.map((item) => this.createItemSnapshot(tx, branchId, item)),
    );
    const subtotal = snapshots.reduce(
      (total, item) => total.add(item.totalPrice),
      new Prisma.Decimal(0),
    );

    return {
      subtotal,
    };
  }

  private composeCustomerOrderPricing(
    type: OnlineOrderTypeDto,
    subtotal: Prisma.Decimal,
  ) {
    const deliveryFee = this.resolveDeliveryFee(type);

    return {
      deliveryFee,
      subtotal,
      total: subtotal.add(deliveryFee),
    };
  }

  private resolveDeliveryFee(type: OnlineOrderTypeDto): Prisma.Decimal {
    if (type === OnlineOrderTypeDto.PICKUP) {
      return new Prisma.Decimal(0);
    }

    return new Prisma.Decimal(0);
  }

  private async recalculateOrderTotals(
    tx: TransactionClient,
    orderId: string,
    deliveryFee: Prisma.Decimal,
  ): Promise<void> {
    const items = await tx.orderItem.findMany({
      where: { orderId, status: OrderItemStatus.ACTIVE },
      select: { totalPrice: true },
    });
    const subtotal = items.reduce(
      (total, item) => total.add(item.totalPrice),
      new Prisma.Decimal(0),
    );

    await tx.order.update({
      where: { id: orderId },
      data: {
        deliveryFeeTotal: deliveryFee,
        subtotal,
        total: subtotal.add(deliveryFee),
      },
    });
  }

  private assertCustomerPaymentMethodSupported(
    paymentMethod: OnlinePaymentMethodDto,
  ): void {
    if (!operationalCustomerPaymentMethods.includes(paymentMethod as never)) {
      throw new BadRequestException(
        "Payment method is not available for customer orders",
      );
    }
  }

  private customerPaymentMethods() {
    return operationalCustomerPaymentMethods.map((method) => ({
      code: method,
      label: method === OnlinePaymentMethodDto.CASH ? "Naqd" : method,
      status: "AVAILABLE",
    }));
  }

  private withDerivedCustomerOrderStatus<
    T extends { order?: { status: OrderStatus } | null },
  >(customerOrder: T): T & { status: string } {
    return {
      ...customerOrder,
      status: this.toCustomerOrderStatus(
        customerOrder.order?.status ?? OrderStatus.NEW,
      ),
    };
  }

  private toCustomerOrderStatus(status: OrderStatus): string {
    if (status === OrderStatus.SERVED) {
      return "READY";
    }

    return status;
  }

  private createOrderNumber(prefix: string): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replaceAll("-", "");
    const time = now.toISOString().slice(11, 19).replaceAll(":", "");

    return `${prefix}-${date}-${time}-${randomInt(1000, 10000)}`;
  }
}
