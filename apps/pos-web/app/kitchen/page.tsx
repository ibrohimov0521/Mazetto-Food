"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PermissionGuard } from "../../components/auth/permission-guard";
import { RoleGuard } from "../../components/auth/role-guard";
import { apiFetch } from "../../lib/api";

type KitchenTicketStatus = "NEW" | "ACCEPTED" | "COOKING" | "READY" | "COMPLETED" | "CANCELLED";
type OrderSource = "POS" | "WEB" | "TELEGRAM";
type OrderType = "DINE_IN" | "TAKEAWAY" | "DELIVERY";
type KitchenAction = "accept" | "start" | "ready" | "complete" | "cancel";
type ModifierSnapshot = {
  name?: string;
  quantity?: string;
};
type KitchenOrderItem = {
  id: string;
  productName: string;
  variantName?: string | null;
  quantity: string;
  notes?: string | null;
  modifierSnapshot?: unknown;
};
type KitchenTicket = {
  id: string;
  ticketNumber: string;
  status: KitchenTicketStatus;
  priority: number;
  createdAt: string;
  acceptedAt?: string | null;
  order: {
    id: string;
    orderNumber: string;
    source: OrderSource;
    type: OrderType;
    notes?: string | null;
    kitchenComment?: string | null;
    branch?: {
      name?: string | null;
    } | null;
    table?: {
      number?: number | null;
      name?: string | null;
      hall?: { name: string } | null;
    } | null;
    items: KitchenOrderItem[];
  };
};

type Column = {
  title: string;
  helper: string;
  statuses: KitchenTicketStatus[];
  tone: "new" | "accepted" | "cooking" | "ready";
};

const pollIntervalMs = 5000;
const columns: Column[] = [
  {
    title: "Yangi",
    helper: "Qabul qilish kutilmoqda",
    statuses: ["NEW"],
    tone: "new",
  },
  {
    title: "Tasdiqlandi",
    helper: "Tayyorlashni boshlash kerak",
    statuses: ["ACCEPTED"],
    tone: "accepted",
  },
  {
    title: "Tayyorlanmoqda",
    helper: "Oshxonada jarayonda",
    statuses: ["COOKING"],
    tone: "cooking",
  },
  {
    title: "Tayyor",
    helper: "Topshirish yoki olib ketish kutilmoqda",
    statuses: ["READY"],
    tone: "ready",
  },
];

export default function KitchenPage() {
  return (
    <RoleGuard roles={["KITCHEN", "SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="KITCHEN_VIEW">
        <KitchenDisplay />
      </PermissionGuard>
    </RoleGuard>
  );
}

function KitchenDisplay() {
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyTicketId, setBusyTicketId] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const loadedOnceRef = useRef(false);
  const knownTicketIdsRef = useRef<Set<string>>(new Set());

  const loadTickets = useCallback(async () => {
    try {
      const nextTickets = await apiFetch<KitchenTicket[]>("/kitchen/orders");
      const nextTicketIds = new Set(nextTickets.map((ticket) => ticket.id));
      const hasNewTicket = loadedOnceRef.current && nextTickets.some((ticket) => !knownTicketIdsRef.current.has(ticket.id));

      setTickets(nextTickets);
      setError(null);
      setLastUpdatedAt(new Date());

      if (hasNewTicket && isSoundEnabled) {
        playKitchenTone();
      }

      knownTicketIdsRef.current = nextTicketIds;
      loadedOnceRef.current = true;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Oshxona buyurtmalari yuklanmadi");
    } finally {
      setIsLoading(false);
    }
  }, [isSoundEnabled]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadTickets();
    }, pollIntervalMs);

    return () => window.clearInterval(timer);
  }, [loadTickets]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void loadTickets();
      }
    };

    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => document.removeEventListener("visibilitychange", refreshWhenVisible);
  }, [loadTickets]);

  const groupedTickets = useMemo(
    () =>
      columns.map((column) => ({
        ...column,
        tickets: tickets.filter((ticket) => column.statuses.includes(ticket.status)),
      })),
    [tickets],
  );
  const totals = useMemo(() => summarizeTickets(tickets), [tickets]);

  async function runAction(ticket: KitchenTicket, action: KitchenAction) {
    if (busyTicketId) {
      return;
    }

    setBusyTicketId(ticket.id);
    setError(null);

    try {
      await apiFetch(`/kitchen/orders/${ticket.id}/${action}`, { method: "PATCH" });
      await loadTickets();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Amal bajarilmadi. Holatni yangilab qayta urinib ko'ring.");
      await loadTickets();
    } finally {
      setBusyTicketId(null);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#071f1d] text-[#fff7e8]">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#071f1d]/95 px-4 py-4 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-[1900px] flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#ffc83d]">MAZETTO FOOD</p>
            <h1 className="mt-1 text-3xl font-black tracking-normal text-white md:text-5xl">Oshxona paneli</h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold text-white/65">
              Faol buyurtmalar, tayyorlash va topshirish holatlari bitta ekranda.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[620px]">
            <Metric label="Faol" value={totals.active} tone="neutral" />
            <Metric label="Tayyorlanmoqda" value={totals.cooking} tone="warning" />
            <Metric label="Tayyor" value={totals.ready} tone="success" />
          </div>
        </div>
      </header>

      <section className="mx-auto flex max-w-[1900px] flex-col gap-4 px-4 py-4 md:px-6">
        <div className="flex flex-col gap-3 rounded-[28px] border border-white/10 bg-white/[0.06] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
            <span className={`rounded-full px-4 py-2 ${error ? "bg-red-500/20 text-red-100" : "bg-emerald-400/15 text-emerald-100"}`}>
              {error ? "Ulanishda xatolik" : "Avtomatik yangilanadi"}
            </span>
            <span className="rounded-full bg-white/10 px-4 py-2 text-white/70">
              Har {pollIntervalMs / 1000} soniyada
            </span>
            {lastUpdatedAt ? (
              <span className="rounded-full bg-white/10 px-4 py-2 text-white/70">
                Yangilandi: {lastUpdatedAt.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}
              </span>
            ) : null}
          </div>

          <button
            className={`min-h-11 rounded-full px-5 text-sm font-black transition active:scale-95 ${
              isSoundEnabled
                ? "bg-[#ffc83d] text-[#1b1300] shadow-[0_10px_28px_rgba(255,200,61,0.25)]"
                : "border border-white/15 bg-white/5 text-white/75"
            }`}
            onClick={() => setIsSoundEnabled((current) => !current)}
            type="button"
          >
            Ovoz {isSoundEnabled ? "yoqilgan" : "o'chirilgan"}
          </button>
        </div>

        {error ? (
          <div className="rounded-[24px] border border-red-400/25 bg-red-500/12 px-5 py-4 text-sm font-bold text-red-50">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
          {groupedTickets.map((column) => (
            <KitchenColumn
              column={column}
              isLoading={isLoading}
              key={column.title}
              now={now}
              onAction={runAction}
              busyTicketId={busyTicketId}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "neutral" | "warning" | "success" }) {
  const toneClass = {
    neutral: "bg-white/10 text-white",
    warning: "bg-[#ffc83d]/18 text-[#ffe39a]",
    success: "bg-emerald-400/16 text-emerald-100",
  }[tone];

  return (
    <div className={`rounded-[22px] px-4 py-3 ${toneClass}`}>
      <p className="text-xs font-extrabold uppercase tracking-[0.14em] opacity-70">{label}</p>
      <p className="mt-1 text-3xl font-black tabular-nums">{value}</p>
    </div>
  );
}

function KitchenColumn({
  busyTicketId,
  column,
  isLoading,
  now,
  onAction,
}: {
  busyTicketId: string | null;
  column: Column & { tickets: KitchenTicket[] };
  isLoading: boolean;
  now: number;
  onAction: (ticket: KitchenTicket, action: KitchenAction) => Promise<void>;
}) {
  return (
    <section className="min-h-[420px] rounded-[30px] border border-white/10 bg-[#0c302d] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-2xl font-black text-white">{column.title}</h2>
          <p className="mt-1 text-sm font-semibold text-white/55">{column.helper}</p>
        </div>
        <span className={`grid h-12 min-w-12 place-items-center rounded-2xl px-3 text-xl font-black ${columnCountClass(column.tone)}`}>
          {column.tickets.length}
        </span>
      </div>

      <div className="grid gap-3">
        {isLoading ? (
          <LoadingTickets />
        ) : column.tickets.length ? (
          column.tickets.map((ticket) => (
            <KitchenTicketCard
              isBusy={busyTicketId === ticket.id}
              key={ticket.id}
              now={now}
              onAction={onAction}
              ticket={ticket}
            />
          ))
        ) : (
          <div className="rounded-[24px] border border-dashed border-white/15 bg-black/15 px-4 py-12 text-center">
            <p className="text-base font-black text-white/60">Faol buyurtma yo'q</p>
            <p className="mt-1 text-sm font-semibold text-white/40">Yangi buyurtma tushsa shu yerda ko'rinadi.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function KitchenTicketCard({
  isBusy,
  now,
  onAction,
  ticket,
}: {
  isBusy: boolean;
  now: number;
  onAction: (ticket: KitchenTicket, action: KitchenAction) => Promise<void>;
  ticket: KitchenTicket;
}) {
  const elapsedMinutes = Math.floor(Math.max(0, now - new Date(ticket.createdAt).getTime()) / 60000);
  const primaryAction = primaryActionForStatus(ticket.status);
  const canCancel = ticket.status === "NEW" || ticket.status === "ACCEPTED" || ticket.status === "COOKING";
  const itemsCount = ticket.order.items.reduce((total, item) => total + Number(item.quantity), 0);

  return (
    <article className="rounded-[28px] border border-white/10 bg-[#fff7e8] p-4 text-[#132724] shadow-[0_20px_50px_rgba(0,0,0,0.24)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#082522] px-3 py-1 text-xs font-black text-[#ffc83d]">
              #{ticket.order.orderNumber}
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${sourceClass(ticket.order.source)}`}>
              {sourceLabel(ticket.order.source)}
            </span>
          </div>
          <h3 className="mt-3 text-3xl font-black tracking-tight text-[#102724]">{placeLabel(ticket)}</h3>
          <p className="mt-1 text-sm font-extrabold text-[#42605c]">
            {ticket.order.branch?.name ?? "Filial"} · {orderTypeLabel(ticket.order.type)}
          </p>
        </div>

        <div className={`shrink-0 rounded-2xl px-3 py-2 text-center ${urgencyClass(elapsedMinutes)}`}>
          <p className="text-3xl font-black tabular-nums">{elapsedMinutes}</p>
          <p className="text-[11px] font-black uppercase tracking-[0.12em]">daq</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Chip>{statusLabel(ticket.status)}</Chip>
        <Chip>{formatQuantity(String(itemsCount))} ta mahsulot</Chip>
        <Chip>{new Date(ticket.createdAt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}</Chip>
      </div>

      <div className="mt-4 grid gap-2">
        {ticket.order.items.map((item) => (
          <div className="rounded-[20px] border border-[#d9cda8] bg-white/70 p-3" key={item.id}>
            <div className="flex items-start gap-3">
              <span className="grid h-11 min-w-11 place-items-center rounded-2xl bg-[#ffc83d] px-2 text-lg font-black text-[#221600]">
                {formatQuantity(item.quantity)}x
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-black leading-snug text-[#142a27]">
                  {item.productName}
                  {item.variantName ? <span className="text-[#5d746f]"> · {item.variantName}</span> : null}
                </p>
                <Modifiers value={item.modifierSnapshot} />
                {item.notes ? <p className="mt-2 rounded-2xl bg-[#fff1bc] px-3 py-2 text-sm font-bold text-[#5a4300]">{item.notes}</p> : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      {ticket.order.kitchenComment || ticket.order.notes ? (
        <p className="mt-3 rounded-[20px] bg-[#102724] px-4 py-3 text-sm font-bold text-[#fff7e8]">
          Izoh: {ticket.order.kitchenComment ?? ticket.order.notes}
        </p>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {primaryAction ? (
          <button
            className="min-h-14 rounded-[20px] bg-[#ffc83d] px-4 text-base font-black text-[#211600] shadow-[0_14px_34px_rgba(255,200,61,0.28)] transition hover:bg-[#ffda69] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isBusy}
            onClick={() => void onAction(ticket, primaryAction.action)}
            type="button"
          >
            {isBusy ? "Yangilanmoqda..." : primaryAction.label}
          </button>
        ) : null}

        {canCancel ? (
          <button
            className="min-h-14 rounded-[20px] border border-red-200 bg-red-50 px-4 text-base font-black text-red-700 transition hover:bg-red-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isBusy}
            onClick={() => void onAction(ticket, "cancel")}
            type="button"
          >
            Bekor qilish
          </button>
        ) : null}
      </div>
    </article>
  );
}

function LoadingTickets() {
  return (
    <>
      {[0, 1, 2].map((index) => (
        <div className="animate-pulse rounded-[28px] bg-[#fff7e8] p-4" key={index}>
          <div className="h-5 w-32 rounded-full bg-[#d9cda8]" />
          <div className="mt-4 h-9 w-44 rounded-full bg-[#d9cda8]" />
          <div className="mt-5 grid gap-2">
            <div className="h-16 rounded-[20px] bg-[#eadfbd]" />
            <div className="h-16 rounded-[20px] bg-[#eadfbd]" />
          </div>
        </div>
      ))}
    </>
  );
}

function Modifiers({ value }: { value: unknown }) {
  const modifiers = Array.isArray(value)
    ? (value.filter((modifier): modifier is ModifierSnapshot => Boolean(modifier && typeof modifier === "object")) as ModifierSnapshot[])
    : [];

  if (!modifiers.length) {
    return null;
  }

  return (
    <ul className="mt-2 grid gap-1 text-sm font-bold text-[#42605c]">
      {modifiers.map((modifier, index) => (
        <li key={`${modifier.name ?? "modifier"}-${index}`}>
          + {modifier.name ?? "Qo'shimcha"}
          {modifier.quantity && Number(modifier.quantity) > 1 ? ` x${formatQuantity(modifier.quantity)}` : ""}
        </li>
      ))}
    </ul>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-[#e9e1c8] px-3 py-1 text-xs font-black text-[#42605c]">{children}</span>;
}

function summarizeTickets(tickets: KitchenTicket[]) {
  return {
    active: tickets.length,
    cooking: tickets.filter((ticket) => ticket.status === "COOKING").length,
    ready: tickets.filter((ticket) => ticket.status === "READY").length,
  };
}

function primaryActionForStatus(status: KitchenTicketStatus): { action: KitchenAction; label: string } | null {
  const actions: Partial<Record<KitchenTicketStatus, { action: KitchenAction; label: string }>> = {
    NEW: { action: "accept", label: "Qabul qilish" },
    ACCEPTED: { action: "start", label: "Tayyorlash" },
    COOKING: { action: "ready", label: "Tayyor" },
    READY: { action: "complete", label: "Yopish" },
  };

  return actions[status] ?? null;
}

function placeLabel(ticket: KitchenTicket): string {
  if (ticket.order.table) {
    return ticket.order.table.name ?? `Stol ${ticket.order.table.number ?? ""}`.trim();
  }

  return ticket.order.type === "DELIVERY" ? "Yetkazib berish" : "Olib ketish";
}

function orderTypeLabel(type: OrderType): string {
  const labels: Record<OrderType, string> = {
    DELIVERY: "Yetkazib berish",
    DINE_IN: "Zalda",
    TAKEAWAY: "Olib ketish",
  };

  return labels[type];
}

function sourceLabel(source: OrderSource): string {
  const labels: Record<OrderSource, string> = {
    POS: "POS",
    TELEGRAM: "Telegram",
    WEB: "Web",
  };

  return labels[source];
}

function statusLabel(status: KitchenTicketStatus): string {
  const labels: Record<KitchenTicketStatus, string> = {
    NEW: "Yangi",
    ACCEPTED: "Qabul qilingan",
    COOKING: "Tayyorlanmoqda",
    READY: "Tayyor",
    COMPLETED: "Yopilgan",
    CANCELLED: "Bekor qilingan",
  };

  return labels[status];
}

function columnCountClass(tone: Column["tone"]): string {
  const classes: Record<Column["tone"], string> = {
    new: "bg-red-300 text-red-950",
    accepted: "bg-[#ffc83d] text-[#241600]",
    cooking: "bg-sky-300 text-sky-950",
    ready: "bg-emerald-300 text-emerald-950",
  };

  return classes[tone];
}

function sourceClass(source: OrderSource): string {
  const classes: Record<OrderSource, string> = {
    POS: "bg-slate-200 text-slate-800",
    TELEGRAM: "bg-sky-100 text-sky-800",
    WEB: "bg-emerald-100 text-emerald-800",
  };

  return classes[source];
}

function urgencyClass(minutes: number): string {
  if (minutes >= 25) {
    return "bg-red-600 text-white";
  }

  if (minutes >= 15) {
    return "bg-[#ffc83d] text-[#1f1500]";
  }

  return "bg-emerald-100 text-emerald-800";
}

function formatQuantity(value: string): string {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return value;
  }

  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(2);
}

function playKitchenTone(): void {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  try {
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.08;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.18);
  } catch {
    // Browser sound may stay blocked until staff interacts with the page.
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
