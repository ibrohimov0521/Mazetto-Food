"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { formatDateTime, orderTypeLabels, type OrderType } from "../../lib/order-display";
import type { BadgeTone } from "../admin-ui/badge";
import { Badge } from "../admin-ui/badge";
import { Card } from "../admin-ui/card";
import { DataTable, type DataTableColumn } from "../admin-ui/data-table";
import { ErrorState } from "../admin-ui/feedback";
import { InfoBox, StatGrid } from "../admin-ui/stat-box";

/*
 * Oshxona monitoringi — admin uchun FAQAT O'QISH.
 *
 * RBAC operational_contracts.kitchen:
 *   "Kitchen status transitionlari backend orqali authoritative bo'lishi kerak."
 *   "Customer PII minimal ko'rsatiladi."
 *
 * Shuning uchun:
 *   - status o'zgartirish tugmalari YO'Q (bu KITCHEN rolining ishi, /kitchen ekranida)
 *   - mijoz telefoni va manzili KO'RSATILMAYDI
 */

type KitchenTicketStatus = "NEW" | "ACCEPTED" | "COOKING" | "READY";

type KitchenTicket = {
  id: string;
  ticketNumber: string;
  status: KitchenTicketStatus;
  priority: number;
  createdAt: string;
  order?: {
    id: string;
    orderNumber: string;
    type: OrderType;
    kitchenComment?: string | null;
    branch?: { id: string; name: string } | null;
    table?: { id: string; name: string; hall?: { name: string } | null } | null;
    items?: { id: string; productName: string; variantName?: string | null; quantity: string }[];
  } | null;
};

const ticketStatusLabels: Record<KitchenTicketStatus, string> = {
  NEW: "Yangi",
  ACCEPTED: "Qabul qilingan",
  COOKING: "Pishirilmoqda",
  READY: "Tayyor",
};

function ticketStatusTone(status: KitchenTicketStatus): BadgeTone {
  switch (status) {
    case "READY":
      return "success";
    case "NEW":
      return "warning";
    default:
      return "info";
  }
}

/** Ticket ochilgandan beri o'tgan vaqt — kechikishni ko'rish uchun. */
function waitingMinutes(createdAt: string): number {
  const created = new Date(createdAt).getTime();

  return Number.isNaN(created) ? 0 : Math.max(0, Math.round((Date.now() - created) / 60000));
}

export function AdminKitchenMonitor() {
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setError("");

    try {
      setTickets(await apiFetch<KitchenTicket[]>("/kitchen/orders"));
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      setError(caught instanceof Error ? caught.message : "Oshxona holatini yuklab bo'lmadi.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    /*
     * Oshxona holati tez o'zgaradi. WebSocket hozircha autentifikatsiyasiz
     * global broadcast qilgani uchun (loyiha tahlilidagi ochiq masala),
     * bu ekranda oddiy polling ishlatiladi — POS oshxona ekranidagi kabi.
     */
    const timer = window.setInterval(() => void load(), 15000);

    return () => window.clearInterval(timer);
  }, [load]);

  const stats = useMemo(() => {
    const counts = { NEW: 0, ACCEPTED: 0, COOKING: 0, READY: 0 };

    for (const ticket of tickets) {
      counts[ticket.status] += 1;
    }

    return counts;
  }, [tickets]);

  const columns: DataTableColumn<KitchenTicket>[] = [
    {
      key: "ticket",
      header: "Ticket",
      primary: true,
      render: (ticket) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-mz-text">{ticket.ticketNumber}</p>
          <p className="truncate text-xs text-mz-text-muted">
            {ticket.order?.orderNumber ?? "—"} · {formatDateTime(ticket.createdAt)}
          </p>
        </div>
      ),
    },
    {
      key: "items",
      header: "Tarkib",
      render: (ticket) => (
        <span className="text-xs text-mz-text">
          {(ticket.order?.items ?? [])
            .map((item) => `${item.quantity}× ${item.productName}`)
            .join(", ") || "—"}
        </span>
      ),
    },
    {
      key: "place",
      header: "Joy",
      hideOnMobile: true,
      render: (ticket) =>
        ticket.order?.table
          ? `${ticket.order.table.hall?.name ?? ""} ${ticket.order.table.name}`.trim()
          : ticket.order
            ? orderTypeLabels[ticket.order.type]
            : "—",
    },
    {
      key: "waiting",
      header: "Kutish",
      align: "right",
      render: (ticket) => {
        const minutes = waitingMinutes(ticket.createdAt);

        return (
          <span
            className={minutes >= 20 ? "font-semibold text-mz-danger" : "text-mz-text-muted"}
          >
            {minutes} daq
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Holat",
      align: "right",
      render: (ticket) => (
        <Badge tone={ticketStatusTone(ticket.status)} withDot>
          {ticketStatusLabels[ticket.status]}
        </Badge>
      ),
    },
  ];

  return (
    <div className="grid gap-5">
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      <StatGrid>
        <InfoBox label="Yangi" tone="warning" value={`${stats.NEW} ta`} />
        <InfoBox label="Qabul qilingan" value={`${stats.ACCEPTED} ta`} />
        <InfoBox label="Pishirilmoqda" value={`${stats.COOKING} ta`} />
        <InfoBox label="Tayyor" tone="success" value={`${stats.READY} ta`} />
      </StatGrid>

      <Card>
        <DataTable
          caption="Faol oshxona ticketlari"
          columns={columns}
          emptyDescription="Ayni paytda tayyorlanayotgan buyurtma yo'q."
          emptyTitle="Faol ticket yo'q"
          getRowKey={(ticket) => ticket.id}
          isLoading={isLoading}
          rows={tickets}
        />
        <p className="border-t border-mz-border px-4 py-2.5 text-xs text-mz-text-muted">
          Bu ekran faqat kuzatish uchun. Ticket holatini oshxona xodimi{" "}
          <code className="rounded bg-mz-surface-sunken px-1">/kitchen</code> ekranida
          o&apos;zgartiradi. Ro&apos;yxat har 15 soniyada yangilanadi.
        </p>
      </Card>
    </div>
  );
}
