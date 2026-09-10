"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChefHat,
  ChevronDown,
  ChevronUp,
  Clock3,
  Flame,
  History,
  PackageCheck,
  Search,
  ShoppingBag,
  Truck,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";
import {
  StaffDialog,
  StaffEmpty,
  StaffShell,
  StaffSync,
} from "../../../components/staff/staff-shell";
import styles from "../../../components/staff/staff.module.css";
import { apiFetch } from "../../../lib/api";
import { hasPermission } from "../../../lib/auth";
import { useAuth } from "../../../components/auth/auth-provider";

type KitchenTicketStatus =
  | "NEW"
  | "ACCEPTED"
  | "COOKING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";
type KitchenAction = "accept" | "start" | "ready" | "complete" | "cancel";
type KitchenTicket = {
  id: string;
  ticketNumber: string;
  status: KitchenTicketStatus;
  priority: number;
  createdAt: string;
  order: {
    id: string;
    orderNumber: string;
    displayOrderNumber?: string | null;
    source: "POS" | "WEB" | "TELEGRAM";
    type: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
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
const kitchenStatusLabels: Record<KitchenTicketStatus, string> = {
  NEW: "Yangi",
  ACCEPTED: "Qabul qilindi",
  COOKING: "Tayyorlanmoqda",
  READY: "Tayyor",
  COMPLETED: "Yopilgan",
  CANCELLED: "Bekor qilingan",
};

const columns = [
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
  const [actionError, setActionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyTicketId, setBusyTicketId] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [expandedTicketIds, setExpandedTicketIds] = useState<Set<string>>(
    new Set(),
  );
  const [mobileStatus, setMobileStatus] = useState<string>("NEW");
  const [query, setQuery] = useState("");
  const [cancelTicket, setCancelTicket] = useState<KitchenTicket | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTickets, setHistoryTickets] = useState<KitchenTicket[]>([]);
  const [historyStatus, setHistoryStatus] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const loadedOnceRef = useRef(false);
  const loadVersion = useRef(0);
  const loadRequest = useRef<AbortController | null>(null);
  const actionLock = useRef(false);
  const knownTicketIdsRef = useRef<Set<string>>(new Set());
  const soundEnabled = useRef(true);

  const loadTickets = useCallback(async (force = false) => {
    if ((loadRequest.current || actionLock.current) && !force) return;
    loadRequest.current?.abort();
    const controller = new AbortController();
    loadRequest.current = controller;
    const version = ++loadVersion.current;
    setRefreshing(true);
    try {
      const nextTickets = await apiFetch<KitchenTicket[]>("/kitchen/orders", {
        cache: "no-store",
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(12000),
        ]),
      });
      if (version !== loadVersion.current) return;
      const hasNewTicket =
        loadedOnceRef.current &&
        nextTickets.some((ticket) => !knownTicketIdsRef.current.has(ticket.id));
      setTickets(nextTickets);
      setError(null);
      setLastUpdatedAt(new Date());
      if (hasNewTicket && soundEnabled.current) playKitchenTone();
      knownTicketIdsRef.current = new Set(
        nextTickets.map((ticket) => ticket.id),
      );
      loadedOnceRef.current = true;
    } catch (caught) {
      if (version !== loadVersion.current) return;
      setError(
        caught instanceof Error
          ? caught.message
          : "Oshxona buyurtmalari yuklanmadi",
      );
    } finally {
      if (loadRequest.current === controller) loadRequest.current = null;
      if (version === loadVersion.current) {
        setIsLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError("");
    const params = new URLSearchParams({ limit: "100", offset: "0" });
    if (historyStatus) params.set("status", historyStatus);
    if (historySearch.trim()) params.set("search", historySearch.trim());
    try {
      setHistoryTickets(
        await apiFetch<KitchenTicket[]>(`/kitchen/orders/history?${params.toString()}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(12000),
        }),
      );
    } catch (caught) {
      setHistoryError(caught instanceof Error ? caught.message : "Tarix yuklanmadi.");
    } finally {
      setHistoryLoading(false);
    }
  }, [historySearch, historyStatus]);

  useEffect(() => {
    if (historyOpen) void loadHistory();
  }, [historyOpen, loadHistory]);

  useEffect(() => {
    void loadTickets();
    const refresh = () => {
      if (document.visibilityState === "visible") {
        setNow(Date.now());
        void loadTickets();
      }
    };
    const timer = window.setInterval(refresh, 5000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      loadVersion.current++;
      loadRequest.current?.abort();
      loadRequest.current = null;
    };
  }, [loadTickets]);

  const groupedTickets = useMemo(() => {
    const term = query.trim().toLowerCase();
    return columns.map((column) => ({
      ...column,
      tickets: tickets.filter(
        (ticket) =>
          ticket.status === column.status &&
          (!term ||
            [
              ticket.order.displayOrderNumber,
              ticket.order.orderNumber,
              ticket.order.table?.name,
              ...ticket.order.items.map((item) => item.productName),
            ].some((value) => value?.toLowerCase().includes(term))),
      ),
    }));
  }, [tickets, query]);

  async function runAction(ticket: KitchenTicket, action: KitchenAction) {
    if (actionLock.current) return;
    actionLock.current = true;
    loadVersion.current++;
    loadRequest.current?.abort();
    setBusyTicketId(ticket.id);
    setActionError(null);
    try {
      const updated = await apiFetch<KitchenTicket>(
        `/kitchen/orders/${ticket.id}/${action}`,
        { method: "PATCH", signal: AbortSignal.timeout(12000) },
      );
      setTickets((current) =>
        current.flatMap((entry) =>
          entry.id !== ticket.id
            ? [entry]
            : ["COMPLETED", "CANCELLED"].includes(updated.status)
              ? []
              : [updated],
        ),
      );
      setCancelTicket(null);
      await loadTickets(true);
    } catch (caught) {
      setActionError(
        caught instanceof Error
          ? caught.message
          : "Amal bajarilmadi. Qayta urinib ko'ring.",
      );
      await loadTickets(true);
    } finally {
      actionLock.current = false;
      setBusyTicketId(null);
    }
  }

  function toggleTicket(id: string) {
    setExpandedTicketIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <StaffShell
      title="Oshxona"
      actions={
        <button
          className={styles.shiftLink}
          onClick={() => setHistoryOpen(true)}
          type="button"
        >
          <History size={17} />
          Tarix
        </button>
      }
    >
      <div className={styles.content}>
        <div className={styles.overview}>
          <h2 className={styles.pageHeading}>Buyurtmalar navbati</h2>
          <StaffSync
            updatedAt={lastUpdatedAt}
            error={!!error}
            refreshing={refreshing || !!busyTicketId}
            onRefresh={() => void loadTickets()}
          />
        </div>
        <section className={styles.stats} aria-label="Oshxona xulosasi">
          <div className={styles.stat}>
            <span>Faol buyurtmalar</span>
            <strong>{isLoading ? "..." : tickets.length}</strong>
          </div>
          <div className={styles.stat} data-tone="waiting">
            <span>Tayyorlanmoqda</span>
            <strong>
              {isLoading
                ? "..."
                : tickets.filter((ticket) => ticket.status === "COOKING")
                    .length}
            </strong>
          </div>
          <div className={styles.stat} data-tone="ready">
            <span>Topshirishga tayyor</span>
            <strong>
              {isLoading
                ? "..."
                : tickets.filter((ticket) => ticket.status === "READY").length}
            </strong>
          </div>
        </section>
        <div className={styles.toolbar}>
          <label className={`${styles.search} ${styles.deliverySearch}`}>
            <Search size={18} />
            <input
              aria-label="Buyurtma yoki taom qidirish"
              placeholder="Buyurtma yoki taom qidirish"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button
            className={styles.button}
            aria-pressed={isSoundEnabled}
            onClick={() => {
              soundEnabled.current = !isSoundEnabled;
              setIsSoundEnabled(!isSoundEnabled);
            }}
            type="button"
          >
            {isSoundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}Ovoz{" "}
            {isSoundEnabled ? "yoqilgan" : "o'chirilgan"}
          </button>
        </div>
        {(error || actionError) && (
          <div className={styles.error} role="alert">
            {actionError ?? error}
          </div>
        )}
        <div
          className={`${styles.segments} ${styles.kitchenFilters}`}
          aria-label="Oshxona bosqichi"
        >
          {groupedTickets.map((column) => (
            <button
              className={styles.segment}
              key={column.status}
              aria-pressed={mobileStatus === column.status}
              onClick={() => setMobileStatus(column.status)}
              type="button"
            >
              {column.short}
              <span>{column.tickets.length}</span>
            </button>
          ))}
        </div>
        <div className={styles.board}>
          {groupedTickets.map((column) => (
            <section
              className={styles.column}
              data-hidden={mobileStatus !== column.status}
              key={column.status}
              aria-label={column.title}
            >
              <div className={styles.columnHeading} data-tone={column.tone}>
                <column.icon size={18} />
                <h2>{column.title}</h2>
                <span>{column.tickets.length}</span>
              </div>
              <div className={styles.ticketList}>
                {isLoading ? (
                  <div
                    className={styles.skeleton}
                    aria-label="Buyurtmalar yuklanmoqda"
                  />
                ) : column.tickets.length ? (
                  column.tickets.map((ticket) => (
                    <KitchenTicketCard
                      key={ticket.id}
                      ticket={ticket}
                      now={now}
                      disabled={!!busyTicketId}
                      busy={busyTicketId === ticket.id}
                      expanded={expandedTicketIds.has(ticket.id)}
                      onToggle={() => toggleTicket(ticket.id)}
                      onAction={(action) => {
                        if (action === "cancel") {
                          setActionError(null);
                          setCancelTicket(ticket);
                        } else void runAction(ticket, action);
                      }}
                    />
                  ))
                ) : (
                  <StaffEmpty title="Navbat bo'sh" />
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
      {historyOpen && (
        <StaffDialog title="Smenadagi oshxona tarixi" busy={historyLoading} onClose={() => setHistoryOpen(false)}>
          <div className={styles.historyControls}>
            <label className={styles.search}>
              <Search size={17} />
              <input
                aria-label="Tarixdan qidirish"
                placeholder="Buyurtma yoki taom"
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
              />
            </label>
            <select
              className={styles.historySelect}
              aria-label="Tarix holati"
              value={historyStatus}
              onChange={(event) => setHistoryStatus(event.target.value)}
            >
              <option value="">Barcha holatlar</option>
              {Object.entries(kitchenStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <button className={styles.button} onClick={() => void loadHistory()} disabled={historyLoading} type="button">
              Yangilash
            </button>
          </div>
          {historyError && <div className={styles.error} role="alert">{historyError}</div>}
          <div className={styles.historyList}>
            {historyLoading ? (
              <div className={styles.skeleton} />
            ) : historyTickets.length ? (
              historyTickets.map((ticket) => (
                <article className={styles.historyOrder} key={ticket.id}>
                  <div>
                    <strong>#{ticket.order.displayOrderNumber ?? ticket.order.orderNumber}</strong>
                    <span className={styles.muted}>{ticket.order.items.length} ta mahsulot · {ticket.order.branch?.name ?? "Filial"}</span>
                  </div>
                  <span className={styles.badge} data-tone={ticket.status === "CANCELLED" ? "late" : ticket.status === "READY" || ticket.status === "COMPLETED" ? "ready" : "cooking"}>
                    {kitchenStatusLabels[ticket.status]}
                  </span>
                </article>
              ))
            ) : (
              <StaffEmpty title="Tarix bo'sh">Bu smenada siz qabul qilgan buyurtmalar shu yerda ko'rinadi.</StaffEmpty>
            )}
          </div>
        </StaffDialog>
      )}
      {cancelTicket && (
        <StaffDialog
          title="Buyurtmani bekor qilasizmi?"
          busy={!!busyTicketId}
          onClose={() => setCancelTicket(null)}
        >
          <p>
            <strong>
              #
              {cancelTicket.order.displayOrderNumber ??
                cancelTicket.order.orderNumber}
            </strong>{" "}
            buyurtmasi bekor qilinadi.
          </p>
          {actionError && (
            <p className={styles.error} role="alert">
              {actionError}
            </p>
          )}
          <div className={styles.dialogActions}>
            <button
              className={styles.button}
              disabled={!!busyTicketId}
              onClick={() => setCancelTicket(null)}
              type="button"
            >
              Ortga
            </button>
            <button
              className={styles.danger}
              disabled={!!busyTicketId}
              onClick={() => void runAction(cancelTicket, "cancel")}
              type="button"
            >
              <X size={18} />
              {busyTicketId ? "Saqlanmoqda..." : "Bekor qilish"}
            </button>
          </div>
        </StaffDialog>
      )}
    </StaffShell>
  );
}

function KitchenTicketCard({
  ticket,
  now,
  expanded,
  busy,
  disabled,
  onToggle,
  onAction,
}: {
  ticket: KitchenTicket;
  now: number;
  expanded: boolean;
  busy: boolean;
  disabled: boolean;
  onToggle: () => void;
  onAction: (action: KitchenAction) => void;
}) {
  const elapsed = Math.floor(
    Math.max(0, now - new Date(ticket.createdAt).getTime()) / 60000,
  );
  const { user } = useAuth();
  const canAct = hasPermission(
    user,
    ticket.status === "NEW" ? "KITCHEN_ACCEPT" : "KITCHEN_STATUS_UPDATE",
  );
  const action = canAct ? primaryAction(ticket.status) : null;
  const shownItems = expanded
    ? ticket.order.items
    : ticket.order.items.slice(0, 3);
  const hasMore = ticket.order.items.length > 3;
  const canCancel =
    hasPermission(user, "KITCHEN_STATUS_UPDATE") &&
    ["NEW", "ACCEPTED", "COOKING"].includes(ticket.status);
  const number = ticket.order.displayOrderNumber ?? ticket.order.orderNumber;
  const place = ticket.order.table
    ? (ticket.order.table.name ?? `Stol ${ticket.order.table.number ?? ""}`)
    : ticket.order.type === "DELIVERY"
      ? "Yetkazish"
      : "Olib ketish";
  return (
    <article className={styles.ticket}>
      <div className={styles.ticketHeader}>
        <h3 className={styles.ticketNumber}>#{number}</h3>
        <span className={styles.ticketTime} data-late={elapsed >= 25}>
          <Clock3 size={14} />
          {elapsed} daq
        </span>
      </div>
      <div className={styles.ticketMeta}>
        <span className={styles.badge}>
          {ticket.order.type === "DELIVERY" ? (
            <Truck size={13} />
          ) : (
            <ShoppingBag size={13} />
          )}
          {place}
        </span>
        <span className={styles.badge}>
          {
            { POS: "Kassa", WEB: "Sayt", TELEGRAM: "Telegram" }[
              ticket.order.source
            ]
          }
        </span>
      </div>
      <ul className={styles.itemList}>
        {shownItems.map((item) => (
          <li key={item.id}>
            <span className={styles.itemQuantity}>
              {Number(item.quantity)}x
            </span>
            <div className={styles.itemName}>
              {item.productName}
              {item.variantName && <small>{item.variantName}</small>}
              <Modifiers value={item.modifierSnapshot} />
              {item.notes && <p className={styles.note}>{item.notes}</p>}
            </div>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          className={styles.detailsButton}
          aria-expanded={expanded}
          onClick={onToggle}
          type="button"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {expanded
            ? "Yig'ish"
            : `Yana ${ticket.order.items.length - 3} ta mahsulot`}
        </button>
      )}
      {(ticket.order.kitchenComment || ticket.order.notes) && (
        <p className={styles.note}>
          {ticket.order.kitchenComment ?? ticket.order.notes}
        </p>
      )}
      <div className={styles.ticketActions}>
        {action && (
          <button
            className={styles.primary}
            disabled={disabled}
            onClick={() => onAction(action.action)}
            type="button"
          >
            <Check size={16} />
            {busy ? "Saqlanmoqda..." : action.label}
          </button>
        )}
        {canCancel && (
          <button
            className={styles.iconButton}
            title="Buyurtmani bekor qilish"
            aria-label={`#${number} buyurtmani bekor qilish`}
            disabled={disabled}
            onClick={() => onAction("cancel")}
            type="button"
          >
            <X size={18} />
          </button>
        )}
      </div>
      <p className={styles.muted} style={{ marginTop: 10, fontSize: 11 }}>
        {ticket.order.branch?.name ?? "Filial"}
      </p>
    </article>
  );
}

function primaryAction(
  status: KitchenTicketStatus,
): { action: KitchenAction; label: string } | null {
  const actions: Partial<
    Record<KitchenTicketStatus, { action: KitchenAction; label: string }>
  > = {
    NEW: { action: "accept", label: "Qabul qilish" },
    ACCEPTED: { action: "start", label: "Tayyorlash" },
    COOKING: { action: "ready", label: "Tayyor" },
    READY: { action: "complete", label: "Topshirish" },
  };
  return actions[status] ?? null;
}

function Modifiers({ value }: { value: unknown }) {
  if (!Array.isArray(value)) return null;
  return (
    <>
      {value
        .filter(
          (item): item is { name?: string; quantity?: string } =>
            !!item && typeof item === "object",
        )
        .map((item, index) => (
          <small key={index}>
            + {item.name ?? "Qo'shimcha"}
            {Number(item.quantity) > 1 ? ` x${item.quantity}` : ""}
          </small>
        ))}
    </>
  );
}

function playKitchenTone() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.08;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = () => {
      void context.close();
    };
    oscillator.start();
    oscillator.stop(context.currentTime + 0.18);
  } catch {
    // Sound can remain blocked until the first staff interaction.
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
