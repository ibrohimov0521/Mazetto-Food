"use client";

/*
 * KDS qurilma sozlamalari va shoshilinchlik bosqichlari.
 *
 * Zichlik (normal / TV) HAR QURILMA uchun `localStorage` da saqlanadi:
 * devordagi katta ekran "TV" da, pass ustidagi planshet "normal" da
 * qolishi kerak. Maxfiy rejimda `localStorage` o'qish ham xato tashlashi
 * mumkin — shuning uchun hammasi try/catch ichida.
 */

import type { KitchenTicket, KitchenTicketStatus } from "./kitchen-types";

export type KitchenDensity = "normal" | "tv";

const densityStorageKey = "mazetto.kds.density";

export function readKitchenDensity(): KitchenDensity {
  try {
    return window.localStorage.getItem(densityStorageKey) === "tv"
      ? "tv"
      : "normal";
  } catch {
    return "normal";
  }
}

export function writeKitchenDensity(density: KitchenDensity): void {
  try {
    window.localStorage.setItem(densityStorageKey, density);
  } catch {
    // Sozlama saqlanmasa ham ekran ishlashi kerak.
  }
}

export type KitchenUrgency = "fresh" | "warn" | "late" | "critical";

/*
 * Bosqich bo'yicha chegaralar (daqiqa).
 *
 * Qabul qilinmagan YANGI chipta 3 daqiqada allaqachon muammo, pishayotgan
 * chipta esa 12 daqiqada hali normal — shuning uchun chegara har ustun
 * uchun alohida. `warn` = amber (yaqinlashdi), `late`/`critical` = qizil.
 */
const urgencyThresholds: Record<
  KitchenTicketStatus,
  { warn: number; late: number; critical: number }
> = {
  NEW: { warn: 2, late: 5, critical: 10 },
  ACCEPTED: { warn: 5, late: 10, critical: 16 },
  COOKING: { warn: 12, late: 20, critical: 30 },
  READY: { warn: 5, late: 10, critical: 16 },
  COMPLETED: { warn: 9999, late: 9999, critical: 9999 },
  CANCELLED: { warn: 9999, late: 9999, critical: 9999 },
};

export function kitchenElapsedMinutes(ticket: KitchenTicket, now: number): number {
  const created = new Date(ticket.createdAt).getTime();

  return Number.isFinite(created)
    ? Math.floor(Math.max(0, now - created) / 60000)
    : 0;
}

export function kitchenUrgency(
  status: KitchenTicketStatus,
  minutes: number,
): KitchenUrgency {
  const limits = urgencyThresholds[status] ?? urgencyThresholds.COOKING;

  if (minutes >= limits.critical) return "critical";
  if (minutes >= limits.late) return "late";
  if (minutes >= limits.warn) return "warn";

  return "fresh";
}

export const kitchenUrgencyLabels: Record<KitchenUrgency, string> = {
  fresh: "Muddatida",
  warn: "Muddat yaqinlashdi",
  late: "Kechikdi",
  critical: "Jiddiy kechikdi",
};

/**
 * Ustun ichidagi tartib: avval ustuvor chiptalar, keyin ENG QARIGANI
 * yuqorida (backend `priority desc, createdAt asc` bilan bir xil).
 */
export function sortKitchenTickets(tickets: KitchenTicket[]): KitchenTicket[] {
  return [...tickets].sort((left, right) => {
    const priority = (right.priority ?? 0) - (left.priority ?? 0);
    if (priority !== 0) return priority;

    return (
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    );
  });
}
