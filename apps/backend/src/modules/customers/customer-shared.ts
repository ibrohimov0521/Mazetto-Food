import { ForbiddenException } from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import { randomInt } from "node:crypto";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { deliveryDistanceKm } from "./delivery-distance";

/*
 * Mijoz modulining UMUMIY yordamchilari: holat xaritalari, so'rov
 * shakllari, sana oralig'i va kichik tekshiruvlar.
 *
 * NIMA UCHUN AJRATILDI. `customers.service.ts` 1210 qator edi va
 * uchta mustaqil domenni (autentifikatsiya, mijoz katalogi, kuryer)
 * bitta klassda saqlardi. Ularni ajratish uchun avval SHU yordamchilar
 * chiqarilishi kerak edi — aks holda har uchala yangi servis bir-birini
 * chaqirib, halqa bog'liqlik yaratardi.
 *
 * BU YERGA FAQAT SOF FUNKSIYA TUSHADI.
 */

/*
 * `SERVED` mijozga `READY` deb ko'rsatiladi.
 *
 * Ichkarida `SERVED` "oshxona berdi" degani, mijoz uchun esa "tayyor" —
 * u hali qo'liga olmagan. Xom holatni ko'rsatish "berildi" degan
 * noto'g'ri taassurot berardi.
 */
export function toCustomerOrderStatus(
  status: OrderStatus,
  type?: string,
): string {
  if (status === OrderStatus.SERVED && type === "DELIVERY") {
    return "READY";
  }

  return status;
}

export function withDerivedCustomerOrderStatus<
  T extends { order?: { status: OrderStatus } | null },
>(customerOrder: T): T & { status: string } {
  const type =
    "type" in customerOrder && typeof customerOrder.type === "string"
      ? customerOrder.type
      : undefined;

  return {
    ...customerOrder,
    status: toCustomerOrderStatus(
      customerOrder.order?.status ?? OrderStatus.NEW,
      type,
    ),
  };
}

/*
 * Kuryer ro'yxatiga filialdan mijozgacha masofa qo'shadi.
 *
 * ATAYLAB SARALAMAYMIZ. Masofa `deliveryLocation` JSON ustunidan
 * hisoblanadi, ya'ni SQL uni bilmaydi va saralash faqat joriy SAHIFA
 * ichida bo'lardi — "eng yaqin buyurtma" ro'yxat boshida turgandek
 * ko'rinib, aslida keyingi sahifada qolib ketardi. Noto'g'ri tartib
 * to'g'ri tartibdek ko'rinadi, bu tartibsizlikdan yomonroq.
 */
export function withDeliveryDistance<
  T extends {
    deliveryLocation?: unknown;
    branch?: {
      latitude: Prisma.Decimal | null;
      longitude: Prisma.Decimal | null;
    } | null;
  },
>(customerOrder: T): T & { distanceKm: number | null } {
  return {
    ...customerOrder,
    distanceKm: customerOrder.branch
      ? deliveryDistanceKm(customerOrder.branch, customerOrder.deliveryLocation)
      : null,
  };
}

/*
 * Qidiruv buyurtma raqami, mijoz nomi/telefoni, manzil VA taom nomi
 * bo'yicha ishlaydi — operator "lavash" deb qidirganda ham natija
 * chiqishi kerak.
 */
export function buildOrderSearchWhere(search: string): Prisma.OrderWhereInput {
  return {
    OR: [
      { orderNumber: { contains: search, mode: "insensitive" } },
      { displayOrderNumber: { contains: search, mode: "insensitive" } },
      { customerName: { contains: search, mode: "insensitive" } },
      { customerPhone: { contains: search, mode: "insensitive" } },
      { deliveryAddress: { contains: search, mode: "insensitive" } },
      {
        items: {
          some: { productName: { contains: search, mode: "insensitive" } },
        },
      },
    ],
  };
}

/*
 * Noma'lum holat `undefined` beradi, xato emas: bu QUERY filtri va
 * noto'g'ri qiymat "filtrsiz" degani bo'lishi kerak, so'rovni
 * qulatmasligi.
 */
export function toOrderStatus(status?: string): OrderStatus | undefined {
  return Object.values(OrderStatus).includes(status as OrderStatus)
    ? (status as OrderStatus)
    : undefined;
}

export function requireEmployee(user: AuthenticatedUser): string {
  if (!user.employeeId) {
    throw new ForbiddenException(
      "Authenticated user is not linked to an employee",
    );
  }

  return user.employeeId;
}

/*
 * Toshkent bo'yicha "bugun" (UTC+5).
 *
 * `toISOString()` UTC beradi, ya'ni Toshkentda soat 05:00 gacha
 * "bugun" oldingi kunni ko'rsatardi — kassa hisobi va kuryer
 * statistikasi yarim tunda nolga tushib ketardi.
 *
 * Ofset qat'iy: O'zbekistonda yozgi vaqt yo'q.
 */
export function todayTashkentRange(): { start: Date; end: Date } {
  const offsetMs = 5 * 60 * 60 * 1000;
  const shifted = new Date(Date.now() + offsetMs);
  const startUtcMs =
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    ) - offsetMs;

  return {
    start: new Date(startUtcMs),
    end: new Date(startUtcMs + 24 * 60 * 60 * 1000),
  };
}

export function productInclude() {
  return {
    category: { select: { id: true, code: true, name: true } },
    variants: {
      where: { isAvailable: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    },
    modifiers: {
      where: { modifier: { isActive: true } },
      orderBy: { sortOrder: "asc" },
      include: { modifier: true },
    },
  } satisfies Prisma.ProductInclude;
}

/*
 * To'lovlar ATAYLAB ixtiyoriy: ro'yxat ekranlarida ular kerak emas va
 * har buyurtma uchun qo'shimcha JOIN qilardi. Faqat bitta buyurtma
 * ochilganda so'raladi.
 */
export function customerOrderInclude(options?: { includePayments?: boolean }) {
  return {
    branch: { select: { id: true, name: true, address: true } },
    order: {
      select: {
        id: true,
        orderNumber: true,
        displayOrderNumber: true,
        status: true,
        total: true,
        statusHistory: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            fromStatus: true,
            toStatus: true,
            reason: true,
            createdAt: true,
            changedByEmployee: {
              select: { id: true, firstName: true, lastName: true },
            },
            changedByUser: {
              select: { id: true, displayName: true },
            },
          },
        },
        items: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            productName: true,
            variantName: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            modifierSnapshot: true,
            notes: true,
          },
        },
        ...(options?.includePayments
          ? {
              payments: {
                orderBy: { createdAt: "asc" },
                select: {
                  id: true,
                  amount: true,
                  status: true,
                  methodCode: true,
                  method: { select: { code: true, name: true } },
                },
              },
            }
          : {}),
      },
    },
  } satisfies Prisma.CustomerOrderInclude;
}

/*
 * Mijoz buyurtma raqami. `orders.service.ts` dagi POS variantidagi kabi
 * sana UTC dan olinadi — identifikator sifatida ishlatilgani uchun
 * xatti-harakat saqlangan.
 */
export function createOrderNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const time = now.toISOString().slice(11, 19).replaceAll(":", "");

  return `WEB-${date}-${time}-${randomInt(1000, 10000)}`;
}
