"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
} from "lucide-react";
import { PermissionGuard } from "../../../../components/auth/permission-guard";
import { useAuth } from "../../../../components/auth/auth-provider";
import { KitchenWorkspaceNavigation } from "../../../../components/staff/staff-panel-navigation";
import {
  StaffDialog,
  StaffEmpty,
  StaffShell,
} from "../../../../components/staff/staff-shell";
import styles from "../../../../components/staff/staff.module.css";
import {
  kitchenStatusLabels,
  type KitchenTicket,
} from "../../../../components/kitchen/kitchen-types";
import { apiFetch } from "../../../../lib/api";

const pageSize = 100;

export default function KitchenHistoryPage() {
  return (
    <PermissionGuard permission="KITCHEN_VIEW">
      <KitchenHistoryWorkspace />
    </PermissionGuard>
  );
}

function KitchenHistoryWorkspace() {
  const { user } = useAuth();
  const today = useMemo(tashkentToday, []);
  const requestVersion = useRef(0);
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [sort, setSort] = useState("newest");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<KitchenTicket | null>(
    null,
  );

  const loadHistory = useCallback(async () => {
    if (!user) return;
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String(offset),
      sort,
      from,
      to,
    });
    if (status) params.set("status", status);
    if (search.trim()) params.set("search", search.trim());
    try {
      const rows = await apiFetch<KitchenTicket[]>(
        `/kitchen/orders/history?${params.toString()}`,
        { cache: "no-store", signal: AbortSignal.timeout(15000) },
      );
      if (version !== requestVersion.current) return;
      setTickets(rows);
      setHasMore(rows.length === pageSize);
    } catch (caught) {
      if (version !== requestVersion.current) return;
      setError(caught instanceof Error ? caught.message : "Tarix yuklanmadi.");
      setTickets([]);
      setHasMore(false);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [from, offset, search, sort, status, user]);

  useEffect(() => {
    void loadHistory();
    return () => {
      requestVersion.current++;
    };
  }, [loadHistory]);

  function updateFilter(update: () => void) {
    setOffset(0);
    update();
  }

  return (
    <StaffShell title="Oshxona" actions={<KitchenWorkspaceNavigation />}>
      <main className={styles.content}>
        <div className={styles.overview}>
          <div>
            <h1 className={styles.pageHeading}>Oshxona tarixi</h1>
            <p className={styles.muted}>
              Buyurtmalar tarkibi va oshxona holatlari · 31 kungacha
            </p>
          </div>
          <button
            className={styles.button}
            onClick={() => void loadHistory()}
            disabled={loading}
            type="button"
          >
            <RefreshCw size={17} aria-hidden="true" />
            Yangilash
          </button>
        </div>
        <div
          className={`${styles.historyControls} ${styles.kitchenHistoryControls}`}
        >
          <label className={styles.search}>
            <Search size={17} aria-hidden="true" />
            <input
              aria-label="Buyurtma yoki taom qidirish"
              placeholder="Buyurtma yoki taom"
              value={search}
              onChange={(event) =>
                updateFilter(() => setSearch(event.target.value))
              }
            />
          </label>
          <select
            className={styles.historySelect}
            aria-label="Oshxona holati"
            value={status}
            onChange={(event) =>
              updateFilter(() => setStatus(event.target.value))
            }
          >
            <option value="">Barcha holatlar</option>
            {Object.entries(kitchenStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <label className={styles.historyDateField}>
            <span>Dan</span>
            <input
              aria-label="Boshlanish sanasi"
              type="date"
              value={from}
              max={to}
              onChange={(event) =>
                updateFilter(() => setFrom(event.target.value))
              }
            />
          </label>
          <label className={styles.historyDateField}>
            <span>Gacha</span>
            <input
              aria-label="Tugash sanasi"
              type="date"
              value={to}
              min={from}
              onChange={(event) =>
                updateFilter(() => setTo(event.target.value))
              }
            />
          </label>
          <select
            className={styles.historySelect}
            aria-label="Saralash tartibi"
            value={sort}
            onChange={(event) =>
              updateFilter(() => setSort(event.target.value))
            }
          >
            <option value="newest">Yangi avval</option>
            <option value="oldest">Eski avval</option>
          </select>
        </div>
        {error ? (
          <div className={styles.error} role="alert">
            {error}
          </div>
        ) : null}
        {loading ? (
          <div className={styles.historyList} aria-label="Tarix yuklanmoqda">
            <div className={styles.skeleton} />
          </div>
        ) : tickets.length ? (
          <div className={styles.historyList}>
            {tickets.map((ticket) => (
              <button
                className={styles.historyOrder}
                key={ticket.id}
                onClick={() => setSelectedTicket(ticket)}
                type="button"
              >
                <span>
                  <strong>
                    #{ticket.order.displayOrderNumber ?? ticket.order.orderNumber}
                  </strong>
                  <span className={styles.muted}>
                    {ticket.items.length} ta oshxona mahsuloti ·{" "}
                    {formatDate(ticket.createdAt)}
                  </span>
                </span>
                <span className={styles.muted}>
                  {ticket.order.branch?.name ?? "Filial"}
                </span>
                <span
                  className={styles.badge}
                  data-tone={statusTone(ticket.status)}
                >
                  {kitchenStatusLabels[ticket.status]}
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : (
          <StaffEmpty title="Buyurtmalar topilmadi">
            Tanlangan sana yoki qidiruv bo'yicha oshxona tarixi yo'q.
          </StaffEmpty>
        )}
        <div className={styles.historyPager}>
          <span className={styles.muted}>
            {tickets.length
              ? `${offset + 1}–${offset + tickets.length}`
              : "0 ta"} buyurtma
          </span>
          <div>
            <button
              aria-label="Oldingi sahifa"
              className={styles.iconButton}
              disabled={loading || offset === 0}
              onClick={() =>
                setOffset((current) => Math.max(0, current - pageSize))
              }
              type="button"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button
              aria-label="Keyingi sahifa"
              className={styles.iconButton}
              disabled={loading || !hasMore}
              onClick={() => setOffset((current) => current + pageSize)}
              type="button"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </main>
      {selectedTicket ? (
        <StaffDialog
          title={`Buyurtma #${selectedTicket.order.displayOrderNumber ?? selectedTicket.order.orderNumber}`}
          onClose={() => setSelectedTicket(null)}
        >
          <div className={styles.kitchenHistoryDetail}>
            <p className={styles.muted}>
              {formatDate(selectedTicket.createdAt)} ·{" "}
              {typeLabel(selectedTicket.order.type)} ·{" "}
              {selectedTicket.order.branch?.name ?? "Filial"}
            </p>
            <p>
              <span className={styles.muted}>Holat:</span>{" "}
              {kitchenStatusLabels[selectedTicket.status]}
            </p>
            {selectedTicket.order.table ? (
              <p>
                <span className={styles.muted}>Stol:</span>{" "}
                {selectedTicket.order.table.name ??
                  `Stol ${selectedTicket.order.table.number ?? ""}`}
              </p>
            ) : null}
            <h3>Buyurtma tarkibi</h3>
            <ul className={styles.itemList}>
              {selectedTicket.items.map((item) => (
                <li key={item.id}>
                  <span className={styles.itemQuantity}>
                    {Number(item.quantity)}x
                  </span>
                  <span className={styles.itemName}>
                    {item.productName}
                    {item.variantName ? <small>{item.variantName}</small> : null}
                    {modifierNames(item.modifierSnapshot) ? (
                      <small className={styles.modifierSummary}>
                        + {modifierNames(item.modifierSnapshot)}
                      </small>
                    ) : null}
                    {item.notes ? (
                      <small className={styles.note}>{item.notes}</small>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            {selectedTicket.order.kitchenComment || selectedTicket.order.notes ? (
              <p className={styles.note}>
                {selectedTicket.order.kitchenComment ??
                  selectedTicket.order.notes}
              </p>
            ) : null}
            <h3>Holat tarixi</h3>
            <ol className={styles.kitchenStatusHistory}>
              {(selectedTicket.order.statusHistory ?? []).map((entry, index) => (
                <li key={`${entry.toStatus}-${index}`}>
                  <span>{orderStatusLabel(entry.toStatus)}</span>
                  {entry.createdAt ? (
                    <time>{formatDate(entry.createdAt)}</time>
                  ) : null}
                  {entry.reason ? <small>{entry.reason}</small> : null}
                </li>
              ))}
            </ol>
          </div>
        </StaffDialog>
      ) : null}
    </StaffShell>
  );
}

function tashkentToday() {
  const shifted = new Date(Date.now() + 5 * 60 * 60 * 1000);
  return [
    String(shifted.getUTCFullYear()).padStart(4, "0"),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("uz-UZ", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tashkent",
  }).format(new Date(value));
}

function statusTone(status: KitchenTicket["status"]) {
  if (status === "CANCELLED") return "late";
  if (status === "READY" || status === "COMPLETED") return "ready";
  return "cooking";
}

function typeLabel(type: KitchenTicket["order"]["type"]) {
  if (type === "DINE_IN") return "Zal";
  if (type === "TAKEAWAY") return "Olib ketish";
  return "Yetkazib berish";
}

function orderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    NEW: "Yangi",
    ACCEPTED: "Qabul qilindi",
    PREPARING: "Tayyorlanmoqda",
    READY: "Tayyor",
    SERVED: "Topshirildi",
    COMPLETED: "Yakunlandi",
    CANCELLED: "Bekor qilindi",
  };
  return labels[status] ?? status;
}

function modifierNames(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .filter(
      (item): item is { name?: string; quantity?: string | number } =>
        !!item && typeof item === "object",
    )
    .map(
      (item) =>
        `${item.name ?? "Qo'shimcha"}${Number(item.quantity) > 1 ? ` x${item.quantity}` : ""}`,
    )
    .join(", ");
}
