import { Injectable } from "@nestjs/common";
import { CustomerOrderType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  branchSupportsType,
  customerCallbackPrefix,
  type BranchForCheckout,
} from "./telegram-customer-presentation";

/*
 * Telegram checkout SESSIYASI va filial tanlash.
 *
 * NIMA UCHUN AJRATILDI. Bu metodlar faqat bazaga qaraydi — na Telegram
 * API'ga, na xabar chizishga bog'liq. Ular buyurtma servisi ichida
 * turganda checkout oqimini alohida chiqarish qiyin edi: oqim ham
 * sessiyani, ham ekranni chaqiradi va ikkalasi bitta klassda yashardi.
 *
 * Bog'liqlik yo'nalishi bir tomonlama: buyurtma -> sessiya -> baza.
 */

export type CheckoutStep = "ORDER_TYPE" | "ADDRESS" | "NOTE" | "SUMMARY";

/*
 * Sessiya bir soatdan keyin o'ladi.
 *
 * Nima uchun cheklangan: yarim to'ldirilgan checkout abadiy saqlansa,
 * mijoz bir hafta o'tib qaytganda eski manzil va eski filial bilan
 * davom etardi — filial esa yopilgan bo'lishi mumkin.
 */
const TELEGRAM_CHECKOUT_SESSION_TTL_MS = 60 * 60 * 1000;

/** Filial ro'yxati va bitta filialni o'qishda BIR XIL maydonlar. */
const branchSelect = {
  id: true,
  name: true,
  address: true,
  latitude: true,
  longitude: true,
  acceptsOrders: true,
  deliveryEnabled: true,
  pickupEnabled: true,
  isTemporarilyClosed: true,
} as const;

@Injectable()
export class TelegramCheckoutSessionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Muddati o'tmagan sessiya yoki `null`. */
  getActiveCheckoutSession(customerId: string, chatId: string) {
    return this.prisma.telegramCheckoutSession.findFirst({
      where: {
        customerId,
        chatId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  upsertCheckoutSession(
    customerId: string,
    chatId: string,
    data: {
      step?: CheckoutStep;
      branchId?: string | null;
      orderType?: CustomerOrderType | null;
      address?: string | null;
      note?: string | null;
    },
  ) {
    const expiresAt = new Date(Date.now() + TELEGRAM_CHECKOUT_SESSION_TTL_MS);

    return this.prisma.telegramCheckoutSession.upsert({
      where: { customerId_chatId: { customerId, chatId } },
      create: {
        customerId,
        chatId,
        step: data.step ?? "ORDER_TYPE",
        branchId: data.branchId ?? null,
        orderType: data.orderType ?? null,
        address: data.address ?? null,
        note: data.note ?? null,
        expiresAt,
      },
      /*
       * `"step" in data` — `data.step` emas: `null` bilan ATAYLAB tozalash
       * va "bu maydonga tegmang" holatini ajratish uchun. `data.step`
       * tekshiruvi `null` ni ham "berilmagan" deb hisoblardi.
       */
      update: {
        ...("step" in data ? { step: data.step } : {}),
        ...("branchId" in data ? { branchId: data.branchId } : {}),
        ...("orderType" in data ? { orderType: data.orderType } : {}),
        ...("address" in data ? { address: data.address } : {}),
        ...("note" in data ? { note: data.note } : {}),
        expiresAt,
      },
    });
  }

  /*
   * O'chirish xatosi YUTILADI: sessiya allaqachon o'chgan bo'lishi mumkin
   * (muddati o'tgan yoki boshqa oqim tozalagan), va bu buyurtma
   * yakunlanishini to'xtatmasligi kerak.
   */
  clearCheckoutSession(customerId: string, chatId: string): Promise<unknown> {
    return this.prisma.telegramCheckoutSession
      .delete({ where: { customerId_chatId: { customerId, chatId } } })
      .catch(() => undefined);
  }

  /** Buyurtma qabul qiladigan faol filiallar. */
  async availableBranches(): Promise<BranchForCheckout[]> {
    return this.prisma.branch.findMany({
      where: {
        isActive: true,
        acceptsOrders: true,
        isTemporarilyClosed: false,
        OR: [{ pickupEnabled: true }, { deliveryEnabled: true }],
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: branchSelect,
    });
  }

  /*
   * ATAYLAB filtrsiz: sessiyada saqlangan filial oradan vaqt o'tib
   * yopilgan bo'lishi mumkin, va chaqiruvchi buni BILISHI kerak —
   * "topilmadi" bilan "yopilgan" bir xil emas.
   */
  findBranchForCheckout(branchId: string): Promise<BranchForCheckout | null> {
    return this.prisma.branch.findUnique({
      where: { id: branchId },
      select: branchSelect,
    });
  }

  async defaultBranchForType(
    orderType: CustomerOrderType,
  ): Promise<BranchForCheckout | null> {
    const branches = await this.availableBranches();

    return (
      branches.find((branch) => branchSupportsType(branch, orderType)) ?? null
    );
  }

  /*
   * Faqat filial QO'LLAB-QUVVATLAYDIGAN turlar ko'rsatiladi. Ikkalasi ham
   * yopiq bo'lsa bo'sh massiv qaytadi va chaqiruvchi buni "bu filialdan
   * hozir buyurtma qabul qilinmaydi" deb ko'rsatadi.
   */
  orderTypeButtons(branch: BranchForCheckout) {
    const buttons: Array<Array<{ text: string; callback_data: string }>> = [];

    if (branchSupportsType(branch, CustomerOrderType.PICKUP)) {
      buttons.push([
        {
          text: "🚶 Olib ketish",
          callback_data: `${customerCallbackPrefix}:type:${CustomerOrderType.PICKUP}`,
        },
      ]);
    }

    if (branchSupportsType(branch, CustomerOrderType.DELIVERY)) {
      buttons.push([
        {
          text: "🚚 Yetkazib berish",
          callback_data: `${customerCallbackPrefix}:type:${CustomerOrderType.DELIVERY}`,
        },
      ]);
    }

    return buttons;
  }
}
