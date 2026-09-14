"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing,
  History,
  Monitor,
  Search,
  Tv,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { KitchenTicketCard } from "../../../components/kitchen/kitchen-ticket-card";
import {
  readKitchenDensity,
  sortKitchenTickets,
  writeKitchenDensity,
  type KitchenDensity,
} from "../../../components/kitchen/kitchen-prefs";
import {
  kitchenColumns,
  kitchenStatusLabels,
  type KitchenAction,
  type KitchenTicket,
} from "../../../components/kitchen/kitchen-types";
import { useKitchenChime } from "../../../components/kitchen/use-kitchen-chime";
import {
  StaffDialog,
  StaffEmpty,
  StaffShell,
  StaffSync,
} from "../../../components/staff/staff-shell";
import styles from "../../../components/staff/staff.module.css";
import { apiFetch } from "../../../lib/api";

export default function KitchenPage() {
  return (
    <PermissionGuard permission="KITCHEN_VIEW">
      <KitchenDisplay />
    </PermissionGuard>
  );
}

function KitchenDisplay() {
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [density, setDensity] = useState<KitchenDensity>("normal");
  const [error, setError] = useState<string | null>(null);
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyTicketIds, setBusyTicketIds] = useState<Set<string>>(new Set());
  const [compactTicketIds, setCompactTicketIds] = useState<Set<string>>(
    new Set(),
  );
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(
    new Set(),
  );
  const [mobileStatus, setMobileStatus] = useState<string>("NEW");
  const [query, setQuery] = useState("");
  const [cancelTicket, setCancelTicket] = useState<KitchenTicket | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTickets, setHistoryTickets] = useState<KitchenTicket[]>([]);
  const [historyStatus, setHistoryStatus] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const loadVersion = useRef(0);
  const loadRequest = useRef<AbortController | null>(null);
  const pendingActions = useRef(0);
  const actionKeys = useRef(new Map<string, string>());

  const loadTickets = useCallback(async (force = false) => {
    if ((loadRequest.current || pendingActions.current > 0) && !force) return;
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
      setTickets(nextTickets);
      setError(null);
      setLastUpdatedAt(new Date());
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
        await apiFetch<KitchenTicket[]>(
          `/kitchen/orders/history?${params.toString()}`,
          {
            cache: "no-store",
            signal: AbortSignal.timeout(12000),
          },
        ),
      );
    } catch (caught) {
      setHistoryError(
        caught instanceof Error ? caught.message : "Tarix yuklanmadi.",
      );
    } finally {
      setHistoryLoading(false);
    }
  }, [historySearch, historyStatus]);

  useEffect(() => {
    if (historyOpen) void loadHistory();
  }, [historyOpen, loadHistory]);

  useEffect(() => {
    setDensity(readKitchenDensity());
  }, []);

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

  /*
   * Yopilgan chiptalar tasdiqlar ro'yxatidan chiqariladi — aks holda
   * to'plam smena davomida cheksiz o'sadi.
   */
  useEffect(() => {
    setAcknowledgedIds((current) => {
      if (!current.size) return current;
      const live = new Set(
        tickets.filter((ticket) => ticket.status === "NEW").map((t) => t.id),
      );
      const next = new Set<string>();
      current.forEach((id) => {
        if (live.has(id)) next.add(id);
      });
      return next.size === current.size ? current : next;
    });
  }, [tickets]);

  useEffect(() => {
    setCompactTicketIds((current) => {
      if (!current.size) return current;
      const activeIds = new Set(tickets.map((ticket) => ticket.id));
      const next = new Set([...current].filter((id) => activeIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [tickets]);

  function toggleCompactTicket(id: string) {
    setCompactTicketIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const newTickets = useMemo(
    () => tickets.filter((ticket) => ticket.status === "NEW"),
    [tickets],
  );
  const unacknowledgedCount = useMemo(
    () => newTickets.filter((ticket) => !acknowledgedIds.has(ticket.id)).length,
    [acknowledgedIds, newTickets],
  );
  const chime = useKitchenChime({
    soundOn: isSoundEnabled,
    alerting: unacknowledgedCount > 0,
  });

  /* Filial qatori faqat ko'rish doirasi bir nechta filialni qamrasa kerak. */
  const showBranch = useMemo(
    () =>
      new Set(tickets.map((ticket) => ticket.order.branch?.name ?? "")).size >
      1,
    [tickets],
  );

  const groupedTickets = useMemo(() => {
    const term = query.trim().toLowerCase();
    return kitchenColumns.map((column) => ({
      ...column,
      tickets: sortKitchenTickets(
        tickets.filter(
          (ticket) =>
            ticket.status === column.status &&
            (!term ||
              [
                ticket.order.displayOrderNumber,
                ticket.order.orderNumber,
                ticket.order.table?.name,
                ...ticket.items.map((item) => item.productName),
              ].some((value) => value?.toLowerCase().includes(term))),
        ),
      ),
    }));
  }, [tickets, query]);

  async function runAction(ticket: KitchenTicket, action: KitchenAction) {
    if (busyTicketIds.has(ticket.id)) return;
    const reason = cancelReason.trim();
    if (action === "cancel" && !reason) {
      setActionErrors((current) => ({
        ...current,
        [ticket.id]: "Bekor qilish sababini yozing.",
      }));
      return;
    }
    const fingerprint = `${ticket.id}:${ticket.version}:${action}`;
    const idempotencyKey =
      actionKeys.current.get(fingerprint) ?? crypto.randomUUID();
    actionKeys.current.set(fingerprint, idempotencyKey);
    pendingActions.current += 1;
    loadVersion.current++;
    loadRequest.current?.abort();
    setBusyTicketIds((current) => new Set(current).add(ticket.id));
    setActionErrors((current) => {
      if (!(ticket.id in current)) return current;
      const next = { ...current };
      delete next[ticket.id];
      return next;
    });
    try {
      const updated = await apiFetch<KitchenTicket>(
        `/kitchen/orders/${ticket.id}/${action}`,
        {
          method: "PATCH",
          headers: { "Idempotency-Key": idempotencyKey },
          signal: AbortSignal.timeout(12000),
          body: JSON.stringify({
            expectedVersion: ticket.version,
            ...(action === "cancel"
              ? { reason, reasonCode: "KITCHEN_OPERATOR_CANCELLED" }
              : {}),
          }),
        },
      );
      actionKeys.current.delete(fingerprint);
      setTickets((current) =>
        current.flatMap((entry) =>
          entry.id !== ticket.id
            ? [entry]
            : ["COMPLETED", "CANCELLED"].includes(updated.status)
              ? []
              : [updated],
        ),
      );
      setCancelTicket((current) =>
        current?.id === ticket.id ? null : current,
      );
      if (action === "cancel") setCancelReason("");
    } catch (caught) {
      setActionErrors((current) => ({
        ...current,
        [ticket.id]:
          caught instanceof Error
            ? caught.message
            : "Amal bajarilmadi. Qayta urinib ko'ring.",
      }));
    } finally {
      pendingActions.current -= 1;
      setBusyTicketIds((current) => {
        const next = new Set(current);
        next.delete(ticket.id);
        return next;
      });
      await loadTickets(true);
    }
  }

  function toggleSound() {
    const next = !isSoundEnabled;
    setIsSoundEnabled(next);
    /* Tugmani bosish — haqiqiy harakat, shu yerda ovozni ochib olamiz. */
    if (next) chime.unlock();
  }

  function toggleDensity() {
    const next: KitchenDensity = density === "tv" ? "normal" : "tv";
    setDensity(next);
    writeKitchenDensity(next);
  }

  function acknowledgeNew() {
    setAcknowledgedIds(new Set(newTickets.map((ticket) => ticket.id)));
    chime.unlock();
  }

  const needsSoundUnlock = isSoundEnabled && chime.supported && !chime.unlocked;
  const soundLabel = needsSoundUnlock
    ? "Ovozni yoqish"
    : `Ovoz ${isSoundEnabled ? "yoqilgan" : "o'chirilgan"}`;

  return (
    <StaffShell
      title="Oshxona"
      actions={
        <button
          className={styles.shiftLink}
          aria-label="Oshxona tarixi"
          title="Oshxona tarixi"
          onClick={() => setHistoryOpen(true)}
          type="button"
        >
          <History size={17} />
          <span>Tarix</span>
        </button>
      }
    >
      <div className={`${styles.content} ${styles.kitchenContent}`}>
        <div className={styles.overview}>
          <h2 className={styles.pageHeading}>
            Buyurtmalar navbati · {isLoading ? "..." : tickets.length}
          </h2>
          <StaffSync
            updatedAt={lastUpdatedAt}
            error={!!error}
            refreshing={refreshing || busyTicketIds.size > 0}
            onRefresh={() => void loadTickets()}
          />
        </div>
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
          <div className={styles.toolbarGroup}>
            <button
              className={styles.button}
              aria-label="TV rejimi"
              title={
                density === "tv" ? "Oddiy rejimga o'tish" : "TV rejimiga o'tish"
              }
              aria-pressed={density === "tv"}
              onClick={toggleDensity}
              type="button"
            >
              {density === "tv" ? (
                <Tv size={18} aria-hidden="true" />
              ) : (
                <Monitor size={18} aria-hidden="true" />
              )}
              <span className={styles.kitchenToolLabel}>
                {density === "tv" ? "TV rejimi" : "Oddiy rejim"}
              </span>
            </button>
            <button
              className={styles.button}
              aria-label={soundLabel}
              title={soundLabel}
              aria-pressed={isSoundEnabled && !needsSoundUnlock}
              onClick={() => {
                if (needsSoundUnlock) chime.unlock();
                else toggleSound();
              }}
              type="button"
            >
              {needsSoundUnlock ? (
                <BellRing size={18} aria-hidden="true" />
              ) : isSoundEnabled ? (
                <Volume2 size={18} aria-hidden="true" />
              ) : (
                <VolumeX size={18} aria-hidden="true" />
              )}
              <span className={styles.kitchenToolLabel}>{soundLabel}</span>
            </button>
          </div>
        </div>
        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}
        <p className={styles.srOnly} aria-live="polite">
          {unacknowledgedCount > 0
            ? `${unacknowledgedCount} ta yangi buyurtma navbatda`
            : ""}
        </p>
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
        <div className={styles.board} data-density={density}>
          {groupedTickets.map((column) => (
            <section
              className={styles.column}
              data-hidden={mobileStatus !== column.status}
              data-alert={column.status === "NEW" && unacknowledgedCount > 0}
              key={column.status}
              aria-label={column.title}
            >
              <div className={styles.columnHeading} data-tone={column.tone}>
                <column.icon size={20} aria-hidden="true" />
                <h2>{column.title}</h2>
                {column.status === "NEW" && unacknowledgedCount > 0 && (
                  <button
                    className={styles.columnAck}
                    aria-label={`${unacknowledgedCount} ta yangi buyurtmani tasdiqlash`}
                    title="Yangi buyurtmalarni ko'rildi deb belgilash"
                    onClick={acknowledgeNew}
                    type="button"
                  >
                    <BellRing size={18} aria-hidden="true" />
                  </button>
                )}
                <span>{column.tickets.length}</span>
              </div>
              <div
                className={styles.ticketList}
                data-count={column.tickets.length}
              >
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
                      busy={busyTicketIds.has(ticket.id)}
                      error={actionErrors[ticket.id]}
                      showBranch={showBranch}
                      isCompact={compactTicketIds.has(ticket.id)}
                      onToggleCompact={() => toggleCompactTicket(ticket.id)}
                      onAction={(action) => {
                        if (action === "cancel") {
                          setCancelReason("");
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
        <StaffDialog
          title="Smenadagi oshxona tarixi"
          busy={historyLoading}
          onClose={() => setHistoryOpen(false)}
        >
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
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button
              className={styles.button}
              onClick={() => void loadHistory()}
              disabled={historyLoading}
              type="button"
            >
              Yangilash
            </button>
          </div>
          {historyError && (
            <div className={styles.error} role="alert">
              {historyError}
            </div>
          )}
          <div className={styles.historyList}>
            {historyLoading ? (
              <div className={styles.skeleton} />
            ) : historyTickets.length ? (
              historyTickets.map((ticket) => (
                <article className={styles.historyOrder} key={ticket.id}>
                  <div>
                    <strong>
                      #
                      {ticket.order.displayOrderNumber ??
                        ticket.order.orderNumber}
                    </strong>
                    <span className={styles.muted}>
                      {ticket.order.items.length} ta mahsulot ·{" "}
                      {ticket.order.branch?.name ?? "Filial"}
                    </span>
                  </div>
                  <span
                    className={styles.badge}
                    data-tone={
                      ticket.status === "CANCELLED"
                        ? "late"
                        : ticket.status === "READY" ||
                            ticket.status === "COMPLETED"
                          ? "ready"
                          : "cooking"
                    }
                  >
                    {kitchenStatusLabels[ticket.status]}
                  </span>
                </article>
              ))
            ) : (
              <StaffEmpty title="Tarix bo'sh">
                Bu smenada siz qabul qilgan buyurtmalar shu yerda ko'rinadi.
              </StaffEmpty>
            )}
          </div>
        </StaffDialog>
      )}
      {cancelTicket && (
        <StaffDialog
          title="Buyurtmani bekor qilasizmi?"
          busy={busyTicketIds.has(cancelTicket.id)}
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
          <label>
            <span className={styles.fieldLabel}>Sabab</span>
            <textarea
              className={styles.input}
              maxLength={500}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Masalan: mahsulot qolmagan"
              rows={3}
              value={cancelReason}
            />
          </label>
          {actionErrors[cancelTicket.id] && (
            <p className={styles.error} role="alert">
              {actionErrors[cancelTicket.id]}
            </p>
          )}
          <div className={styles.dialogActions}>
            <button
              className={styles.button}
              disabled={busyTicketIds.has(cancelTicket.id)}
              onClick={() => setCancelTicket(null)}
              type="button"
            >
              Ortga
            </button>
            <button
              className={styles.danger}
              disabled={busyTicketIds.has(cancelTicket.id)}
              onClick={() => void runAction(cancelTicket, "cancel")}
              type="button"
            >
              <X size={18} />
              {busyTicketIds.has(cancelTicket.id)
                ? "Saqlanmoqda..."
                : "Bekor qilish"}
            </button>
          </div>
        </StaffDialog>
      )}
    </StaffShell>
  );
}
