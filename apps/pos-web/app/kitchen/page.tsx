"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { PermissionGuard } from "../../components/auth/permission-guard";
import { RoleGuard } from "../../components/auth/role-guard";
import { apiFetch } from "../../lib/api";
import { getApiBaseUrl } from "../../lib/auth";

type KitchenTicketStatus = "NEW" | "ACCEPTED" | "COOKING" | "READY" | "COMPLETED" | "CANCELLED";
type ModifierSnapshot = {
  name?: string;
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
    type: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
    notes?: string | null;
    kitchenComment?: string | null;
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
  description: string;
  statuses: KitchenTicketStatus[];
  actionLabel?: string;
  action?: "accept" | "start" | "ready" | "complete";
};

const columns: Column[] = [
  {
    title: "New orders",
    description: "Needs kitchen attention",
    statuses: ["NEW", "ACCEPTED"],
    actionLabel: "Start cooking",
    action: "start",
  },
  {
    title: "Cooking",
    description: "Currently preparing",
    statuses: ["COOKING"],
    actionLabel: "Mark ready",
    action: "ready",
  },
  {
    title: "Ready",
    description: "Waiting for pickup or service",
    statuses: ["READY"],
    actionLabel: "Complete",
    action: "complete",
  },
];

export default function KitchenPage() {
  return (
    <RoleGuard roles={["KITCHEN", "SUPER_ADMIN"]}>
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
  const [busyTicketId, setBusyTicketId] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    try {
      const nextTickets = await apiFetch<KitchenTicket[]>("/kitchen/orders");
      setTickets(nextTickets);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Kitchen orders could not load");
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const socket = io(getSocketBaseUrl(), {
      transports: ["websocket"],
    });

    const refresh = () => {
      void loadTickets();
    };
    const refreshWithSound = () => {
      if (isSoundEnabled) {
        playKitchenTone();
      }
      void loadTickets();
    };

    socket.on("order.created", refresh);
    socket.on("order.confirmed", refresh);
    socket.on("order.sent_to_kitchen", refreshWithSound);
    socket.on("order.status_changed", refresh);

    return () => {
      socket.disconnect();
    };
  }, [isSoundEnabled, loadTickets]);

  const groupedTickets = useMemo(
    () =>
      columns.map((column) => ({
        ...column,
        tickets: tickets.filter((ticket) => column.statuses.includes(ticket.status)),
      })),
    [tickets],
  );

  async function runAction(ticket: KitchenTicket, action: NonNullable<Column["action"]>) {
    setBusyTicketId(ticket.id);
    try {
      await apiFetch(`/kitchen/orders/${ticket.id}/${action}`, { method: "PATCH" });
      await loadTickets();
    } finally {
      setBusyTicketId(null);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-5 text-white sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-300">MAZETTO FOOD KDS</p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Kitchen display</h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-400">
            Live kitchen queue for incoming, cooking, and ready orders.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {error ? (
            <span className="rounded-full border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200">
              {error}
            </span>
          ) : (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200">
              Live updates on
            </span>
          )}
          <button
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              isSoundEnabled
                ? "bg-emerald-400 text-neutral-950"
                : "border border-white/15 bg-white/5 text-neutral-200"
            }`}
            onClick={() => setIsSoundEnabled((current) => !current)}
            type="button"
          >
            Sound {isSoundEnabled ? "on" : "off"}
          </button>
        </div>
      </header>

      <section className="mt-6 grid gap-5 xl:grid-cols-3">
        {groupedTickets.map((column) => (
          <div className="min-h-[70vh] rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl" key={column.title}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">{column.title}</h2>
                <p className="mt-1 text-sm text-neutral-400">{column.description}</p>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-neutral-200">
                {column.tickets.length}
              </span>
            </div>

            <div className="grid gap-4">
              {column.tickets.length ? (
                column.tickets.map((ticket) => (
                  <KitchenTicketCard
                    action={column.action}
                    actionLabel={column.actionLabel}
                    isBusy={busyTicketId === ticket.id}
                    key={ticket.id}
                    now={now}
                    onAction={runAction}
                    ticket={ticket}
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 px-4 py-10 text-center text-sm font-semibold text-neutral-500">
                  No tickets
                </div>
              )}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

function KitchenTicketCard({
  action,
  actionLabel,
  isBusy,
  now,
  onAction,
  ticket,
}: {
  action?: Column["action"] | undefined;
  actionLabel?: string | undefined;
  isBusy: boolean;
  now: number;
  onAction: (ticket: KitchenTicket, action: NonNullable<Column["action"]>) => Promise<void>;
  ticket: KitchenTicket;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-neutral-900 p-4 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-300">#{ticket.ticketNumber}</p>
          <h3 className="mt-1 text-2xl font-semibold">{tableLabel(ticket)}</h3>
          <p className="mt-1 text-sm text-neutral-400">{ticket.order.type.replace("_", " ")}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusPill(ticket.status)}`}>
          {ticket.status}
        </span>
      </div>

      <div className="mt-4 rounded-2xl bg-black/30 px-4 py-3">
        <p className="text-sm text-neutral-400">Timer</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">{formatElapsed(now - new Date(ticket.createdAt).getTime())}</p>
      </div>

      <div className="mt-4 grid gap-3">
        {ticket.order.items.map((item) => (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3" key={item.id}>
            <div className="flex gap-3">
              <span className="text-lg font-bold text-emerald-300">{formatQuantity(item.quantity)}x</span>
              <div>
                <p className="text-lg font-semibold">
                  {item.productName}
                  {item.variantName ? <span className="text-neutral-400"> {item.variantName}</span> : null}
                </p>
                <Modifiers value={item.modifierSnapshot} />
                {item.notes ? <p className="mt-2 text-sm font-semibold text-yellow-200">{item.notes}</p> : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      {ticket.order.kitchenComment || ticket.order.notes ? (
        <p className="mt-4 rounded-2xl bg-yellow-300/10 px-4 py-3 text-sm font-semibold text-yellow-100">
          {ticket.order.kitchenComment ?? ticket.order.notes}
        </p>
      ) : null}

      {ticket.status === "NEW" ? (
        <button
          className="mt-4 w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-4 text-base font-bold text-white transition hover:bg-white/15"
          disabled={isBusy}
          onClick={() => void onAction(ticket, "accept")}
          type="button"
        >
          Accept ticket
        </button>
      ) : null}

      {action ? (
        <button
          className="mt-3 w-full rounded-2xl bg-emerald-400 px-4 py-4 text-base font-bold text-neutral-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isBusy}
          onClick={() => void onAction(ticket, action)}
          type="button"
        >
          {isBusy ? "Updating..." : actionLabel}
        </button>
      ) : null}
    </article>
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
    <ul className="mt-2 grid gap-1 text-sm font-medium text-neutral-300">
      {modifiers.map((modifier, index) => (
        <li key={`${modifier.name ?? "modifier"}-${index}`}>- {modifier.name ?? "Modifier"}</li>
      ))}
    </ul>
  );
}

function tableLabel(ticket: KitchenTicket): string {
  if (ticket.order.table) {
    return ticket.order.table.name ?? `Table ${ticket.order.table.number ?? ""}`.trim();
  }

  return ticket.order.type === "DELIVERY" ? "Delivery" : "Pickup";
}

function statusPill(status: KitchenTicketStatus): string {
  const classes: Record<KitchenTicketStatus, string> = {
    NEW: "bg-red-400 text-neutral-950",
    ACCEPTED: "bg-yellow-300 text-neutral-950",
    COOKING: "bg-blue-300 text-neutral-950",
    READY: "bg-emerald-300 text-neutral-950",
    COMPLETED: "bg-neutral-700 text-neutral-200",
    CANCELLED: "bg-red-900 text-red-100",
  };

  return classes[status];
}

function formatQuantity(value: string): string {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(2);
}

function formatElapsed(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function getSocketBaseUrl(): string {
  return getApiBaseUrl().replace(/\/api\/v1\/?$/, "");
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
    // Browsers can block sound until the kitchen user interacts with the page.
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
