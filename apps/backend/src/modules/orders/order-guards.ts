import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import {
  OrderItemStatus,
  Prisma,
  ShiftStatus,
} from "@prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import type { OrderItemModifierDto } from "./dto/order-item.dto";
import type { ModifierSnapshot } from "./order-rules";

/*
 * Buyurtma GUARDLARI: tranzaksiya ichida bajariladigan tekshiruvlar va
 * qayta hisoblash.
 *
 * NIMA UCHUN ERKIN FUNKSIYA, METOD EMAS. Ularning hammasi `tx` ni
 * PARAMETR sifatida oladi — ya'ni ular servisning holatiga emas,
 * berilgan tranzaksiyaga bog'liq. Metod ko'rinishida turganda bu
 * ko'rinmasdi va `this.prisma` ni tasodifan ishlatib yuborish oson edi:
 * shunda tekshiruv tranzaksiyadan TASHQARIDA bajarilib, u ko'rgan
 * ma'lumot tranzaksiya ko'rgan ma'lumotdan farq qilardi.
 *
 * `tx` ni parametr qilish bu xatoni imkonsiz qiladi.
 */

type TransactionClient = Prisma.TransactionClient;

export async function assertBranchExists(
  tx: TransactionClient | PrismaService,
  branchId: string,
): Promise<void> {
  const branch = await tx.branch.findFirst({
    where: { id: branchId, isActive: true },
  });

  if (!branch) {
    throw new NotFoundException("Branch not found");
  }
}

export async function assertEmployeeInBranch(
  tx: TransactionClient,
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

export async function assertTableInBranch(
  tx: TransactionClient,
  tableId: string,
  branchId: string,
): Promise<void> {
  const table = await tx.restaurantTable.findFirst({
    where: { id: tableId, branchId, isActive: true },
  });

  if (!table) {
    throw new NotFoundException("Table not found");
  }
}

/*
 * Filialga xos usul umumiy usuldan USTUN (`orderBy: branchId desc`
 * `null` ni oxiriga suradi) — filial o'z naqd kassasini alohida
 * sozlagan bo'lsa, o'shanisi ishlatiladi.
 */
export async function assertCashPaymentMethod(
  tx: TransactionClient,
  branchId: string,
) {
  const method = await tx.paymentMethod.findFirst({
    where: {
      code: "CASH",
      isActive: true,
      OR: [{ branchId }, { branchId: null }],
    },
    orderBy: { branchId: "desc" },
    select: { id: true, code: true, name: true },
  });

  if (!method) {
    throw new BadRequestException("Cash payment method is not available");
  }

  return method;
}

/*
 * Ochiq smenasiz POS sotuvi bo'lmaydi: aks holda pul hech qanday
 * smenaga bog'lanmasdan kassaga tushardi va kun oxirida hisob
 * chiqmasdi.
 *
 * `updateMany` ATAYLAB: u smenani QULFLAYDI (qatorga yozuv qo'yadi),
 * ya'ni shu tranzaksiya davomida smena yopilib qololmaydi. Faqat
 * `findFirst` bilan tekshirilsa, tekshiruv va sotuv orasida smena
 * yopilishi mumkin edi — va tushum yopilgan smenaga yozilardi.
 * `count !== 1` aynan shu poygani ushlaydi.
 */
export async function assertOpenCashierShift(
  tx: TransactionClient,
  branchId: string,
  employeeId: string,
) {
  const shift = await tx.shift.findFirst({
    where: {
      branchId,
      employeeId,
      status: ShiftStatus.OPEN,
    },
    orderBy: { openedAt: "desc" },
    select: { id: true },
  });

  if (!shift) {
    throw new BadRequestException(
      "Open employee shift is required before POS sales",
    );
  }

  const touched = await tx.shift.updateMany({
    where: {
      id: shift.id,
      branchId,
      employeeId,
      status: ShiftStatus.OPEN,
    },
    data: { updatedAt: new Date() },
  });

  if (touched.count !== 1) {
    throw new BadRequestException(
      "Open employee shift is required before POS sales",
    );
  }

  return shift;
}

/*
 * Jami summa HAR DOIM qatorlardan qayta hisoblanadi, hech qachon
 * o'zgarish miqdoriga qarab tuzatilmaydi: qo'shish/olib tashlash
 * ketma-ketligida bitta xato butun summani abadiy noto'g'ri qoldirardi.
 *
 * Bekor qilingan qatorlar (`status !== ACTIVE`) hisobga kirmaydi.
 */
export async function recalculateOrderTotals(
  tx: TransactionClient,
  orderId: string,
): Promise<void> {
  const items = await tx.orderItem.findMany({
    where: {
      orderId,
      status: OrderItemStatus.ACTIVE,
    },
    select: { totalPrice: true },
  });
  const subtotal = items.reduce(
    (total, item) => total.add(item.totalPrice),
    new Prisma.Decimal(0),
  );
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      discountTotal: true,
      serviceFeeTotal: true,
      deliveryFeeTotal: true,
    },
  });

  if (!order) {
    throw new NotFoundException("Order not found");
  }

  const total = subtotal
    .sub(order.discountTotal)
    .add(order.serviceFeeTotal)
    .add(order.deliveryFeeTotal);

  await tx.order.update({
    where: { id: orderId },
    data: {
      subtotal,
      total,
    },
  });
}

/*
 * Modifikator SNAPSHOT'i: nomi va narxi buyurtma paytidagi holatda
 * yoziladi. Keyin modifikator narxi o'zgarsa yoki o'chirilsa, eski
 * buyurtma va uning cheki o'zgarmasligi kerak.
 *
 * Miqdor tekshiruvi qat'iy: so'ralgan modifikatorlarning BARCHASI shu
 * mahsulotga biriktirilgan va faol bo'lishi shart. Yetishmagani jimgina
 * tashlansa, mijoz to'lamagan qo'shimchani olardi.
 */
export async function createModifierSnapshot(
  tx: TransactionClient,
  productId: string,
  modifiers: OrderItemModifierDto[],
): Promise<ModifierSnapshot[]> {
  if (modifiers.length === 0) {
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

  if (productModifiers.length !== modifierIds.length) {
    throw new BadRequestException(
      "One or more modifiers are not available for this product",
    );
  }

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
