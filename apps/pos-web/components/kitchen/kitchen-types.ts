/*
 * Oshxona ekrani (KDS) uchun umumiy tiplar va ustunlar.
 *
 * Backend `/kitchen/orders` javobi `kitchen.service.ts` dagi
 * `ticketInclude()` bilan bir xil: chipta maydonlari, buyurtma va
 * yuborilgan mahsulotlarning snapshotlari. Stansiya yo'nalishi snapshotda
 * bor, ammo haqiqiy stansiya xaritasi tayyor bo'lmaguncha filtr qo'llanmaydi.
 */

import { ChefHat, Flame, PackageCheck, ShoppingBag } from "lucide-react";

export type KitchenTicketStatus =
  | "NEW"
  | "ACCEPTED"
  | "COOKING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";

export type KitchenAction =
  | "accept"
  | "start"
  | "ready"
  | "complete"
  | "cancel";

export type KitchenTicket = {
  id: string;
  ticketNumber: string;
  status: KitchenTicketStatus;
  priority: number;
  version: number;
  revisionNumber?: number;
  isSupplement?: boolean;
  createdAt: string;
  acceptedAt?: string | null;
  items: {
    id: string;
    productName: string;
    variantName?: string | null;
    quantity: string;
    notes?: string | null;
    modifierSnapshot?: unknown;
    stationRouting?: "KITCHEN" | "BAR" | "RECEIPT" | "NONE";
    printerNameSnapshot?: string | null;
  }[];
  order: {
    id: string;
    orderNumber: string;
    displayOrderNumber?: string | null;
    source: "POS" | "WEB" | "TELEGRAM";
    type: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
    isSupplemental?: boolean;
    supplementNumber?: number | null;
    notes?: string | null;
    kitchenComment?: string | null;
    branch?: { name?: string | null } | null;
    table?: { number?: number | null; name?: string | null } | null;
    items: {
      id: string;
      productName: string;
      variantName?: string | null;
      quantity: string;
      notes?: string | null;
      modifierSnapshot?: unknown;
    }[];
  };
};

export const kitchenStatusLabels: Record<KitchenTicketStatus, string> = {
  NEW: "Yangi",
  ACCEPTED: "Qabul qilindi",
  COOKING: "Tayyorlanmoqda",
  READY: "Tayyor",
  COMPLETED: "Yopilgan",
  CANCELLED: "Bekor qilingan",
};

export const kitchenColumns = [
  {
    status: "NEW",
    title: "Yangi",
    short: "Yangi",
    tone: "new",
    icon: ShoppingBag,
  },
  {
    status: "ACCEPTED",
    title: "Qabul qilindi",
    short: "Qabul",
    tone: "accepted",
    icon: ChefHat,
  },
  {
    status: "COOKING",
    title: "Tayyorlanmoqda",
    short: "Jarayon",
    tone: "cooking",
    icon: Flame,
  },
  {
    status: "READY",
    title: "Tayyor",
    short: "Tayyor",
    tone: "ready",
    icon: PackageCheck,
  },
] as const;

/**
 * Ustundagi asosiy amal.
 *
 * COOKING uchun matn FE'L ("Tayyor bo'ldi") — ustun sarlavhasi
 * "Tayyor" bilan adashmasligi uchun.
 */
export function kitchenPrimaryAction(
  status: KitchenTicketStatus,
): { action: KitchenAction; label: string } | null {
  const actions: Partial<
    Record<KitchenTicketStatus, { action: KitchenAction; label: string }>
  > = {
    NEW: { action: "accept", label: "Qabul qilish" },
    ACCEPTED: { action: "start", label: "Tayyorlashni boshlash" },
    COOKING: { action: "ready", label: "Tayyor bo'ldi" },
    READY: { action: "complete", label: "Topshirish" },
  };

  return actions[status] ?? null;
}
