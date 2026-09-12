"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { hasPermission } from "../../lib/auth";
import {
  formatDateTime,
  orderTypeLabels,
  type OrderStatus,
  type OrderType,
} from "../../lib/order-display";
import { useAuth } from "../auth/auth-provider";
import type { BadgeTone } from "../admin-ui/badge";
import { Badge } from "../admin-ui/badge";
import { Button } from "../admin-ui/button";
import { Card, CardHeader } from "../admin-ui/card";
import { DataTable, type DataTableColumn } from "../admin-ui/data-table";
import { ErrorState } from "../admin-ui/feedback";
import { FormField, Textarea } from "../admin-ui/form";
import { Modal } from "../admin-ui/modal";
import { InfoBox, StatGrid } from "../admin-ui/stat-box";
import { useToast } from "../admin-ui/toast";
import { statusChangeBlockReason } from "./admin-orders";

/*
 * Oshxona monitoringi.
 *
 * NIMA O'ZGARDI. Ekran butunlay o'qish uchun edi va shu holat
 * "RBAC oshxona statuslari backend orqali authoritative" qoidasi bilan
 * izohlangan edi. Lekin qoida statusni KIM o'zgartirishini emas, QAYERDA
 * (serverda) hal qilinishini aytadi: `KITCHEN_ACCEPT` va
 * `KITCHEN_STATUS_UPDATE` permission'lari mavjud va menejerda bo'lishi
 * mumkin. Ilgari oshxona qotib qolganda (planshet o'chgan, oshpaz
 * band) menejer buni KO'RARDI, lekin qilolmasdi.
 *
 * Endi har bir chipta ustida FAQAT serverda mumkin bo'lgan qadam
 * ko'rsatiladi (`kitchen.service.ts#resolveTransition`):
 *   NEW → qabul qilish      PATCH /kitchen/orders/:id/accept
 *   ACCEPTED → boshlash     PATCH /kitchen/orders/:id/start
 *   COOKING → tayyor        PATCH /kitchen/orders/:id/ready
 *   READY → yakunlash       PATCH /kitchen/orders/:id/complete
 *
 * BEKOR QILISH ataylab `/kitchen/orders/:id/cancel` orqali EMAS:
 * u sabab qabul qilmaydi va tarixga qat'iy inglizcha matn yozadi.
 * Buning o'rniga `PATCH /orders/:orderId/status` ishlatiladi — u
 * sababni yozib qoldiradi va oshxona chiptasini `syncKitchenTickets`
 * orqali o'zi yopadi.
 *
 * Mijoz telefoni va manzili bu ekranda KO'RSATILMAYDI (PII minimal).
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
    displayOrderNumber?: string | null;
    type: OrderType;
    status: OrderStatus;
    kitchenComment?: string | null;
    branch?: { id: string; name: string } | null;
    table?: { id: string; name: string; hall?: { name: string } | null } | null;
    items?: {
      id: string;
      productName: string;
      variantName?: string | null;
      quantity: string;
    }[];
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

/*
 * Chipta holatidan KEYINGI qadam. Server ruxsat bermaydigan qadam
 * (masalan NEW chiptani "tayyor" qilish) umuman ko'rsatilmaydi.
 */
const ticketNextStep: Record<
  KitchenTicketStatus,
  { path: string; label: string; permission: string } | null
> = {
  NEW: {
    path: "accept",
    label: "Qabul qilish",
    permission: "KITCHEN_ACCEPT",
  },
  ACCEPTED: {
    path: "start",
    label: "Boshlash",
    permission: "KITCHEN_STATUS_UPDATE",
  },
  COOKING: {
    path: "ready",
    label: "Tayyor",
    permission: "KITCHEN_STATUS_UPDATE",
  },
  READY: {
    path: "complete",
    label: "Yakunlash",
    permission: "KITCHEN_STATUS_UPDATE",
  },
};

const pollIntervalMs = 15000;

/** Ticket ochilgandan beri o'tgan vaqt — kechikishni ko'rish uchun. */
function waitingMinutes(createdAt: string, nowMs: number): number {
  const created = new Date(createdAt).getTime();

  return Number.isNaN(created)
    ? 0
    : Math.max(0, Math.round((nowMs - created) / 60000));
}

const clockFormatter = new Intl.DateTimeFormat("uz-UZ", {
  timeStyle: "medium",
  timeZone: "Asia/Tashkent",
});

export function AdminKitchenMonitor() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  /*
   * KUTISH VAQTI uchun soat.
   *
   * Ilgari daqiqalar `Date.now()` bilan RENDER paytida hisoblanardi,
   * ya'ni raqam faqat poll kelganda siljirdi va oradagi 15 soniyada
   * ekranda eskirgan qiymat turardi. Endi soat alohida yuradi —
   * jadval so'rovsiz ham to'g'ri vaqt ko'rsatadi.
   */
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [busyTicketId, setBusyTicketId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<KitchenTicket | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelReasonError, setCancelReasonError] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  /*
   * So'rov navbati: poll va qo'lda yangilash bir vaqtda ketishi mumkin,
   * va SEKINROQ javob oxirgi bo'lib kelib yangi ma'lumotni bosib
   * ketardi. (`useApiResource` bu qo'riqchini beradi, lekin uning
   * `isLoading` i har pollda `true` bo'lib, `DataTable` butun taxtani
   * skeletonga almashtirardi — oshxona taxtasi 15 soniyada bir marta
   * ko'rinmay qolardi.)
   */
  const request = useRef(0);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    const version = ++request.current;

    if (options?.silent) {
      setIsRefreshing(true);
    }

    try {
      const next = await apiFetch<KitchenTicket[]>("/kitchen/orders");

      if (version !== request.current) {
        return;
      }

      setTickets(next);
      setError("");
      setLastUpdatedAt(Date.now());
      setNowMs(Date.now());
    } catch (caught) {
      if (caught instanceof SessionExpiredError || version !== request.current) {
        return;
      }

      setError(
        caught instanceof Error
          ? caught.message
          : "Oshxona holatini yuklab bo'lmadi.",
      );
    } finally {
      if (version === request.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();

    /*
     * Oshxona monitori faqat o'qish uchun polling ishlatadi; realtime kanal esa
     * backendda token va branch/customer room'lari bilan himoyalangan.
     */
    const timer = window.setInterval(
      () => void load({ silent: true }),
      pollIntervalMs,
    );

    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 10000);

    return () => window.clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    const counts = { NEW: 0, ACCEPTED: 0, COOKING: 0, READY: 0 };

    for (const ticket of tickets) {
      counts[ticket.status] += 1;
    }

    return counts;
  }, [tickets]);

  async function applyTicketStep(
    ticket: KitchenTicket,
    step: { path: string; label: string },
  ): Promise<void> {
    setBusyTicketId(ticket.id);

    try {
      await apiFetch(`/kitchen/orders/${ticket.id}/${step.path}`, {
        method: "PATCH",
      });
      showToast(`${ticket.ticketNumber}: ${step.label.toLowerCase()}.`, "success");
      await load({ silent: true });
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      showToast(
        caught instanceof Error
          ? caught.message
          : "Chipta holatini o'zgartirib bo'lmadi.",
        "danger",
      );
    } finally {
      setBusyTicketId(null);
    }
  }

  async function cancelOrder(): Promise<void> {
    const orderId = cancelTarget?.order?.id;
    const reason = cancelReason.trim();

    if (!orderId) {
      return;
    }

    if (!reason) {
      setCancelReasonError("Bekor qilish sababini yozing.");
      return;
    }

    setIsCancelling(true);

    try {
      await apiFetch(`/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "CANCELLED", reason }),
      });
      showToast("Buyurtma bekor qilindi.", "success");
      setCancelTarget(null);
      setCancelReason("");
      await load({ silent: true });
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      showToast(
        caught instanceof Error
          ? caught.message
          : "Buyurtmani bekor qilib bo'lmadi.",
        "danger",
      );
    } finally {
      setIsCancelling(false);
    }
  }

  const columns: DataTableColumn<KitchenTicket>[] = [
    {
      key: "ticket",
      header: "Ticket",
      primary: true,
      render: (ticket) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-mz-text">
            {ticket.ticketNumber}
          </p>
          <p className="truncate text-xs text-mz-text-muted">
            {ticket.order?.displayOrderNumber ??
              ticket.order?.orderNumber ??
              "—"}{" "}
            · {formatDateTime(ticket.createdAt)}
          </p>
        </div>
      ),
    },
    {
      key: "items",
      header: "Tarkib",
      render: (ticket) => (
        <span className="text-[13px] text-mz-text">
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
        const minutes = waitingMinutes(ticket.createdAt, nowMs);

        return (
          <span
            className={
              minutes >= 20
                ? "font-semibold text-mz-danger"
                : "text-mz-text-muted"
            }
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

  function rowActions(ticket: KitchenTicket): React.ReactNode {
    const step = ticketNextStep[ticket.status];
    const canStep = step ? hasPermission(user, step.permission) : false;
    const order = ticket.order;
    /*
     * Bekor qilish `PATCH /orders/:id/status` orqali ketadi, ya'ni
     * uning sharti buyurtmalar ekrani bilan BIR XIL: chaqiruvchi shu
     * filialning faol xodimi bo'lishi kerak.
     */
    const canCancel = order
      ? hasPermission(user, "ORDER_SEND_KITCHEN") &&
        !statusChangeBlockReason(user, {
          status: order.status,
          branch: order.branch ?? null,
        })
      : false;

    if (!canStep && !canCancel) {
      return (
        <span className="text-xs text-mz-text-muted">
          Faqat kuzatish (ruxsat yo&apos;q)
        </span>
      );
    }

    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {step && canStep ? (
          <Button
            isLoading={busyTicketId === ticket.id}
            onClick={() => void applyTicketStep(ticket, step)}
            size="sm"
            variant="secondary"
          >
            {step.label}
          </Button>
        ) : null}
        {canCancel ? (
          <Button
            disabled={busyTicketId === ticket.id}
            onClick={() => {
              setCancelReason("");
              setCancelReasonError("");
              setCancelTarget(ticket);
            }}
            size="sm"
            variant="danger"
          >
            Bekor qilish
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}

      <StatGrid>
        <InfoBox
          icon="inbox"
          label="Yangi"
          tone="warning"
          value={`${stats.NEW} ta`}
        />
        <InfoBox
          icon="clipboard"
          label="Qabul qilingan"
          value={`${stats.ACCEPTED} ta`}
        />
        <InfoBox
          icon="flame"
          label="Pishirilmoqda"
          value={`${stats.COOKING} ta`}
        />
        <InfoBox
          icon="check"
          label="Tayyor"
          tone="success"
          value={`${stats.READY} ta`}
        />
      </StatGrid>

      <Card>
        <CardHeader
          actions={
            <Button
              isLoading={isRefreshing}
              onClick={() => void load({ silent: true })}
              size="sm"
              variant="ghost"
            >
              Yangilash
            </Button>
          }
          /*
           * "OXIRGI YANGILANISH" — polling ekranida majburiy: aks holda
           * operator qotib qolgan ro'yxatni jonli deb o'qiydi.
           */
          description={
            lastUpdatedAt
              ? `Oxirgi yangilanish: ${clockFormatter.format(lastUpdatedAt)} · har 15 soniyada o'zi yangilanadi`
              : "Yuklanmoqda…"
          }
          title="Faol oshxona ticketlari"
        />
        <DataTable
          caption="Faol oshxona ticketlari"
          columns={columns}
          emptyDescription="Ayni paytda tayyorlanayotgan buyurtma yo'q."
          emptyTitle="Faol ticket yo'q"
          getRowKey={(ticket) => ticket.id}
          isLoading={isLoading}
          rowActions={rowActions}
          rows={tickets}
        />
      </Card>

      <Modal
        description="Buyurtma bekor qilinadi, oshxona chiptasi yopiladi va bu mijozga ko'rinadi. Amal qaytarilmaydi."
        dismissOnBackdrop={false}
        footer={
          <>
            <Button
              disabled={isCancelling}
              onClick={() => setCancelTarget(null)}
              variant="ghost"
            >
              Ortga
            </Button>
            <Button
              isLoading={isCancelling}
              onClick={() => void cancelOrder()}
              variant="danger"
            >
              Buyurtmani bekor qilish
            </Button>
          </>
        }
        isOpen={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title={`${cancelTarget?.ticketNumber ?? "Chipta"} · bekor qilish`}
      >
        <FormField
          error={cancelReasonError}
          hint="Sabab buyurtma tarixiga yoziladi."
          label="Sabab"
          required
        >
          {(props) => (
            <Textarea
              {...props}
              onChange={(event) => {
                setCancelReason(event.target.value);
                setCancelReasonError("");
              }}
              placeholder="Masalan: mahsulot tugadi"
              value={cancelReason}
            />
          )}
        </FormField>
      </Modal>
    </div>
  );
}
