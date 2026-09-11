"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Clock3,
  History,
  MapPin,
  Navigation,
  PackageCheck,
  Phone,
  Search,
  Truck,
  X,
} from "lucide-react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { hasPermission } from "../../lib/auth";
import {
  formatMoney,
  orderStatusLabels,
  type OrderStatus,
} from "../../lib/order-display";
import { useAuth } from "../auth/auth-provider";
import { StaffDialog, StaffEmpty, StaffSync } from "../staff/staff-shell";
import styles from "../staff/staff.module.css";

type DeliveryPoint = {
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  lon?: number;
  label?: string;
  address?: string;
};
type CourierStatusHistoryEntry = {
  id: string;
  toStatus: OrderStatus;
  reason?: string | null;
  createdAt: string;
  changedByEmployee?: {
    firstName: string;
    lastName?: string | null;
    employeeCode?: string | null;
  } | null;
  changedByUser?: {
    displayName?: string | null;
    email?: string | null;
  } | null;
};
type CourierOrder = {
  id: string;
  status: OrderStatus;
  deliveryAddress?: string | null;
  deliveryLocation?: DeliveryPoint | null;
  notes?: string | null;
  createdAt: string;
  customer?: { name: string; phone: string } | null;
  branch?: { name: string; address?: string | null } | null;
  /*
   * Filialdan mijozgacha TO'G'RI CHIZIQ masofasi, kilometrda. Serverdan
   * keladi (Haversine). Haqiqiy yo'l undan uzunroq — bu raqam "qaysi
   * buyurtma yaqinroq" degan tartib uchun, aniq masofa uchun emas.
   */
  distanceKm?: number | null;
  order?: {
    orderNumber: string;
    displayOrderNumber?: string | null;
    status: OrderStatus;
    total: string;
    items: {
      id: string;
      productName: string;
      quantity: string;
      totalPrice: string;
    }[];
    statusHistory?: CourierStatusHistoryEntry[];
  } | null;
};
type DeliveryAction = "SERVED" | "COMPLETED" | "CANCELLED";
type CourierShift = {
  id: string;
  shiftNumber: number;
  currentCash?: string;
  status: "OPEN" | "CLOSED";
  openedAt: string;
};
function historyActor(entry: CourierStatusHistoryEntry): string {
  const employee = entry.changedByEmployee;
  if (employee) {
    return [employee.firstName, employee.lastName].filter(Boolean).join(" ");
  }
  return entry.changedByUser?.displayName || entry.changedByUser?.email || "Tizim";
}

const readyForDelivery = (order: CourierOrder) =>
  ["READY", "SERVED"].includes(order.order?.status ?? order.status);
const courierHistoryStatuses = ["SERVED", "COMPLETED", "CANCELLED"] as const;

export function CourierOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<CourierOrder[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyOrders, setHistoryOrders] = useState<CourierOrder[]>([]);
  const [historyStatus, setHistoryStatus] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [courierShift, setCourierShift] = useState<CourierShift | null>(null);
  const [transferAmount, setTransferAmount] = useState("");
  const [shiftBusy, setShiftBusy] = useState(false);
  const [shiftError, setShiftError] = useState("");
  const [confirmation, setConfirmation] = useState<{
    order: CourierOrder;
    status: DeliveryAction;
  } | null>(null);
  const request = useRef<AbortController | null>(null);
  const version = useRef(0);
  const actionLock = useRef(false);
  const canUpdate = hasPermission(user, "COURIER_DELIVERY_UPDATE");

  const loadCourierShift = useCallback(async () => {
    try {
      setCourierShift(
        await apiFetch<CourierShift | null>("/cash-register/courier-shift", {
          cache: "no-store",
          signal: AbortSignal.timeout(12000),
        }),
      );
      setShiftError("");
    } catch (caught) {
      setShiftError(
        caught instanceof Error ? caught.message : "Xodim kassasi yuklanmadi",
      );
    }
  }, []);

  const load = useCallback(async (force = false) => {
    if (!force && (request.current || actionLock.current)) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const current = ++version.current;
    setRefreshing(true);
    try {
      const data = await apiFetch<CourierOrder[]>(
        "/courier/orders?limit=100&offset=0",
        {
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(12000),
          ]),
        },
      );
      if (current !== version.current) return;
      setOrders(data);
      setUpdatedAt(new Date());
      setError("");
    } catch (caught) {
      if (current !== version.current || caught instanceof SessionExpiredError)
        return;
      setError(
        caught instanceof Error ? caught.message : "Buyurtmalar yuklanmadi.",
      );
    } finally {
      if (request.current === controller) request.current = null;
      if (current === version.current) {
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
      setHistoryOrders(
        await apiFetch<CourierOrder[]>(
          `/courier/orders/history?${params.toString()}`,
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
    void load();
    void loadCourierShift();
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = window.setInterval(refresh, 12000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      version.current++;
      request.current?.abort();
      request.current = null;
    };
  }, [load, loadCourierShift]);

  const readyCount = orders.filter(readyForDelivery).length;
  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return orders.filter((order) => {
      if (filter === "ready" && !readyForDelivery(order)) return false;
      if (filter === "waiting" && readyForDelivery(order)) return false;
      return (
        !term ||
        [
          order.deliveryAddress,
          order.customer?.name,
          order.customer?.phone,
          order.order?.displayOrderNumber,
          order.order?.orderNumber,
        ].some((value) => value?.toLocaleLowerCase().includes(term))
      );
    });
  }, [orders, filter, query]);

  const historyVisible = useMemo(() => {
    const term = historySearch.trim().toLocaleLowerCase();
    return historyOrders.filter((order) => {
      const status = order.order?.status ?? order.status;
      if (historyStatus && status !== historyStatus) return false;
      return (
        !term ||
        [
          order.deliveryAddress,
          order.customer?.name,
          order.customer?.phone,
          order.order?.displayOrderNumber,
          order.order?.orderNumber,
        ].some((value) => value?.toLocaleLowerCase().includes(term))
      );
    });
  }, [historyOrders, historySearch, historyStatus]);

  async function updateStatus() {
    if (!confirmation || actionLock.current || !canUpdate) return;
    actionLock.current = true;
    version.current++;
    request.current?.abort();
    const { order, status } = confirmation;
    setBusyOrderId(order.id);
    setError("");
    try {
      await apiFetch(`/courier/orders/${order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          ...(status === "COMPLETED"
            ? { shiftId: courierShift?.id, paymentMethodCode: "CASH" }
            : {}),
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (status !== "SERVED") {
        setOrders((current) => current.filter((item) => item.id !== order.id));
      }
      setConfirmation(null);
      await load(true);
      await loadCourierShift();
    } catch (caught) {
      await load(true);
      setError(
        caught instanceof Error
          ? caught.message
          : "Holat o'zgarmadi. Qayta urinib ko'ring.",
      );
    } finally {
      actionLock.current = false;
      setBusyOrderId(null);
    }
  }

  async function openCourierShift() {
    if (shiftBusy) return;
    setShiftBusy(true);
    setShiftError("");
    try {
      const opened = await apiFetch<CourierShift>(
        "/cash-register/courier-shift/open",
        {
          method: "POST",
          body: JSON.stringify({ openingBalance: 0 }),
          signal: AbortSignal.timeout(15000),
        },
      );
      setCourierShift(opened);
    } catch (caught) {
      setShiftError(
        caught instanceof Error ? caught.message : "Xodim smenasi ochilmadi",
      );
    } finally {
      setShiftBusy(false);
    }
  }

  async function transferCash() {
    const amount = Number(transferAmount);
    if (!courierShift || !Number.isFinite(amount) || amount <= 0 || shiftBusy)
      return;
    setShiftBusy(true);
    setShiftError("");
    try {
      await apiFetch("/cash-register/courier-shift/transfers", {
        method: "POST",
        body: JSON.stringify({ amount, reason: "Kassirga topshirish" }),
        signal: AbortSignal.timeout(15000),
      });
      setTransferAmount("");
      await loadCourierShift();
    } catch (caught) {
      setShiftError(
        caught instanceof Error ? caught.message : "Naqd topshirilmadi",
      );
    } finally {
      setShiftBusy(false);
    }
  }

  return (
    <div className={`${styles.content} ${styles.narrowContent}`}>
      <div className={styles.overview}>
        <h2 className={styles.pageHeading}>Yetkazib berishlar</h2>
        <div className={styles.inlineActions}>
          <button
            className={styles.button}
            onClick={() => setHistoryOpen(true)}
            type="button"
          >
            <History size={17} />
            Tarix
          </button>
          <StaffSync
            updatedAt={updatedAt}
            error={!!error}
            refreshing={refreshing || !!busyOrderId}
            onRefresh={() => void load()}
          />
        </div>
      </div>
      <section className={styles.shiftSummary} aria-label="Xodim kassasi">
        <div className={styles.toolbar}>
          <div>
            <h2>Umumiy xodim kassasi</h2>
            <p className={styles.muted}>
              {courierShift
                ? "Smena #" +
                  courierShift.shiftNumber +
                  " - Qo'ldagi naqd: " +
                  formatMoney(courierShift.currentCash ?? 0)
                : "Yetkazilgan naqdlar shu smenada hisoblanadi."}
            </p>
          </div>
          {courierShift ? (
            <div className={styles.inlineActions}>
              <input
                className={styles.input}
                inputMode="decimal"
                min="0"
                placeholder="Summa"
                aria-label="Kassirga topshiriladigan summa"
                value={transferAmount}
                onChange={(event) => setTransferAmount(event.target.value)}
              />
              <button
                className={styles.primary}
                disabled={shiftBusy || !transferAmount}
                onClick={() => void transferCash()}
                type="button"
              >
                Kassirga topshirish
              </button>
            </div>
          ) : (
            <button
              className={styles.primary}
              disabled={shiftBusy}
              onClick={() => void openCourierShift()}
              type="button"
            >
              Smenani ochish
            </button>
          )}
        </div>
        {shiftError && (
          <p className={styles.error} role="alert">
            {shiftError}
          </p>
        )}
      </section>
      <section className={styles.stats} aria-label="Yetkazishlar xulosasi">
        <div className={styles.stat}>
          <span>Faol buyurtmalar</span>
          <strong>{isLoading ? "..." : orders.length}</strong>
        </div>
        <div className={styles.stat} data-tone="ready">
          <span>Olib ketishga tayyor</span>
          <strong>{isLoading ? "..." : readyCount}</strong>
        </div>
        <div className={styles.stat} data-tone="waiting">
          <span>Buyurtmalar summasi</span>
          <strong>
            {isLoading
              ? "..."
              : formatMoney(
                  orders.reduce(
                    (sum, order) => sum + Number(order.order?.total ?? 0),
                    0,
                  ),
                )}
          </strong>
        </div>
      </section>
      <div className={styles.toolbar}>
        <div className={styles.segments} aria-label="Yetkazish holati">
          {[
            ["all", "Barchasi", orders.length],
            ["ready", "Tayyor", readyCount],
            ["waiting", "Oshxonada", orders.length - readyCount],
          ].map(([id, label, count]) => (
            <button
              key={id}
              className={styles.segment}
              aria-pressed={filter === id}
              onClick={() => setFilter(String(id))}
              type="button"
            >
              {label}
              <span>{count}</span>
            </button>
          ))}
        </div>
        <label className={`${styles.search} ${styles.deliverySearch}`}>
          <Search size={18} />
          <input
            aria-label="Buyurtma, mijoz yoki manzil qidirish"
            placeholder="Buyurtma, mijoz yoki manzil"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      {isLoading ? (
        <div
          className={styles.deliveryGrid}
          aria-label="Buyurtmalar yuklanmoqda"
        >
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
        </div>
      ) : visible.length ? (
        <section
          className={styles.deliveryGrid}
          aria-label="Yetkazish buyurtmalari"
        >
          {visible.map((order) => (
            <CourierOrderCard
              key={order.id}
              order={order}
              busy={!!busyOrderId}
              canUpdate={canUpdate}
              onStatus={(status) => {
                setError("");
                setConfirmation({ order, status });
              }}
            />
          ))}
        </section>
      ) : (
        <StaffEmpty
          title={
            orders.length ? "Mos buyurtma topilmadi" : "Hozircha yetkazish yo'q"
          }
        >
          {orders.length
            ? "Boshqa manzil yoki buyurtma raqamini tekshiring."
            : "Yangi buyurtmalar shu yerda ko'rinadi."}
        </StaffEmpty>
      )}
      {historyOpen && (
        <StaffDialog
          title="Smenadagi yetkazish tarixi"
          busy={historyLoading}
          onClose={() => setHistoryOpen(false)}
        >
          <div className={styles.historyControls}>
            <label className={styles.search}>
              <Search size={17} />
              <input
                aria-label="Tarixdan qidirish"
                placeholder="Buyurtma, mijoz yoki manzil"
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
              />
            </label>
            <select
              className={styles.historySelect}
              aria-label="Yetkazish holati"
              value={historyStatus}
              onChange={(event) => setHistoryStatus(event.target.value)}
            >
              <option value="">Barcha holatlar</option>
              {courierHistoryStatuses.map((status) => (
                <option key={status} value={status}>
                  {status === "SERVED"
                    ? "Kuryer yo'lda"
                    : orderStatusLabels[status]}
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
            ) : historyVisible.length ? (
              historyVisible.map((order) => {
                const status = order.order?.status ?? order.status;
                return (
                  <article className={styles.historyOrder} key={order.id}>
                    <div>
                      <strong>
                        #
                        {order.order?.displayOrderNumber ??
                          order.order?.orderNumber}
                      </strong>
                      <span className={styles.muted}>
                        {order.customer?.name ?? "Mijoz"} ·{" "}
                        {formatMoney(order.order?.total)}
                      </span>
                      {order.order?.statusHistory?.length ? (
                        <details className={styles.deliveryDetails}>
                          <summary><Clock3 size={14} /> Statuslar tarixi</summary>
                          <ul className={styles.itemList}>
                            {order.order.statusHistory.map((entry) => (
                              <li key={entry.id}>
                                <span>{orderStatusLabels[entry.toStatus] ?? entry.toStatus}</span>
                                <span className={styles.muted}>
                                  {historyActor(entry)} · {new Date(entry.createdAt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" })}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                    </div>
                    <span
                      className={styles.badge}
                      data-tone={
                        status === "CANCELLED"
                          ? "late"
                          : status === "COMPLETED"
                            ? "ready"
                            : "waiting"
                      }
                    >
                      {status === "SERVED"
                        ? "Kuryer yo'lda"
                        : orderStatusLabels[status]}
                    </span>
                  </article>
                );
              })
            ) : (
              <StaffEmpty title="Tarix bo'sh">
                Siz olib ketgan buyurtmalar shu yerda saqlanadi.
              </StaffEmpty>
            )}
          </div>
        </StaffDialog>
      )}
      {confirmation && (
        <StaffDialog
          title={
            confirmation.status === "COMPLETED"
              ? "Buyurtma yetkazildimi?"
              : confirmation.status === "SERVED"
                ? "Buyurtmani olib yo'lga chiqdingizmi?"
                : "Buyurtmani bekor qilasizmi?"
          }
          busy={!!busyOrderId}
          onClose={() => {
            setConfirmation(null);
            setError("");
          }}
        >
          <p>
            <strong>
              #
              {confirmation.order.order?.displayOrderNumber ??
                confirmation.order.order?.orderNumber}
            </strong>{" "}
            · {confirmation.order.customer?.name}
          </p>
          <p className={styles.muted}>
            {confirmation.status === "COMPLETED"
              ? "Buyurtma mijozga topshirilganini tasdiqlang."
              : confirmation.status === "SERVED"
                ? "Buyurtmani olganingizni tasdiqlang. Mijozga kuryer yo'lda ekanligi ko'rinadi."
                : "Buyurtma bekor qilinadi va faol ro'yxatdan olinadi."}
          </p>
          {error && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}
          <div className={styles.dialogActions}>
            <button
              className={styles.button}
              disabled={!!busyOrderId}
              onClick={() => setConfirmation(null)}
              type="button"
            >
              Ortga
            </button>
            <button
              className={
                confirmation.status === "CANCELLED"
                  ? styles.danger
                  : styles.primary
              }
              disabled={!!busyOrderId}
              onClick={() => void updateStatus()}
              type="button"
            >
              <Check size={18} />
              {busyOrderId ? "Saqlanmoqda..." : "Tasdiqlash"}
            </button>
          </div>
        </StaffDialog>
      )}
    </div>
  );
}

function CourierOrderCard({
  order,
  busy,
  canUpdate,
  onStatus,
}: {
  order: CourierOrder;
  busy: boolean;
  canUpdate: boolean;
  onStatus: (status: DeliveryAction) => void;
}) {
  const point = resolvePoint(order.deliveryLocation);
  const status = order.order?.status ?? order.status;
  const isReady = readyForDelivery(order);
  const title =
    order.order?.displayOrderNumber ?? order.order?.orderNumber ?? "Buyurtma";
  const destination = point
    ? encodeURIComponent(`${point.lat},${point.lng}`)
    : null;
  return (
    <article className={styles.deliveryCard}>
      <div className={styles.deliveryTop}>
        <div>
          <h3 className={styles.ticketNumber}>#{title}</h3>
          <p className={styles.muted}>
            {new Date(order.createdAt).toLocaleString("uz-UZ", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Tashkent",
            })}{" "}
            · {order.branch?.name ?? "Filial"}
          </p>
        </div>
        <span
          className={styles.badge}
          data-tone={isReady ? "ready" : "waiting"}
        >
          {status === "SERVED" ? (
            <Truck size={14} />
          ) : isReady ? (
            <PackageCheck size={14} />
          ) : (
            <Clock3 size={14} />
          )}
          {status === "SERVED" ? "Kuryer yo'lda" : orderStatusLabels[status]}
        </span>
      </div>
      <div className={styles.deliveryBody}>
        <div className={styles.addressRow}>
          <MapPin className={styles.addressIcon} size={22} />
          <div>
            <h3>
              {order.deliveryAddress ||
                point?.label ||
                point?.address ||
                "Manzil kiritilmagan"}
            </h3>
            <span className={styles.muted}>
              Yetkazish manzili
              {typeof order.distanceKm === "number"
                ? ` · ~${order.distanceKm} km`
                : ""}
            </span>
          </div>
        </div>
        <div className={styles.customerRow}>
          <div>
            <strong>{order.customer?.name ?? "Mijoz"}</strong>
            <span className={styles.muted}>
              {order.customer?.phone || "Telefon kiritilmagan"}
            </span>
          </div>
          {order.customer?.phone && (
            <a
              href={`tel:${order.customer.phone}`}
              className={styles.button}
              aria-label={`${order.customer.name}: qo'ng'iroq qilish`}
            >
              <Phone size={18} />
              <span className={styles.phoneText}>Qo'ng'iroq</span>
            </a>
          )}
        </div>
        {order.notes && <p className={styles.note}>{order.notes}</p>}
        {destination ? (
          <div className={styles.routeLinks}>
            <a
              className={styles.secondary}
              href={`https://www.google.com/maps/dir/?api=1&destination=${destination}`}
              target="_blank"
              rel="noreferrer"
            >
              <Navigation size={17} />
              Google Maps
            </a>
            <a
              className={styles.button}
              href={`https://yandex.com/maps/?rtext=~${destination}&rtt=auto`}
              target="_blank"
              rel="noreferrer"
            >
              <MapPin size={17} />
              Yandex Maps
            </a>
          </div>
        ) : (
          <p className={styles.note}>
            Lokatsiya belgilanmagan. Manzilni mijozdan aniqlashtiring.
          </p>
        )}
        <details className={styles.deliveryDetails}>
          <summary>
            <ChevronDown size={16} />
            {order.order?.items?.reduce(
              (sum, item) => sum + Number(item.quantity),
              0,
            ) ?? 0}{" "}
            ta mahsulot<strong>{formatMoney(order.order?.total)}</strong>
          </summary>
          <ul className={styles.itemList}>
            {order.order?.items?.map((item) => (
              <li key={item.id}>
                <span className={styles.itemQuantity}>
                  {Number(item.quantity)}x
                </span>
                <span className={styles.itemName}>{item.productName}</span>
              </li>
            ))}
          </ul>
        </details>
        {canUpdate && (
          <div className={styles.deliveryFooter}>
            <button
              className={styles.primary}
              disabled={busy || !isReady}
              onClick={() =>
                onStatus(status === "SERVED" ? "COMPLETED" : "SERVED")
              }
              type="button"
            >
              {status === "SERVED" ? <Check size={18} /> : <Truck size={18} />}
              {status === "SERVED"
                ? "Yetkazildi"
                : isReady
                  ? "Yo'lga chiqdim"
                  : "Oshxonada tayyorlanmoqda"}
            </button>
            <button
              className={styles.iconButton}
              disabled={busy}
              aria-label={`#${title} buyurtmani bekor qilish`}
              title="Buyurtmani bekor qilish"
              onClick={() => onStatus("CANCELLED")}
              type="button"
            >
              <X size={18} />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function resolvePoint(
  location: DeliveryPoint | null | undefined,
): { lat: number; lng: number; label?: string; address?: string } | null {
  if (!location || typeof location !== "object") return null;
  const rawLat = location.lat ?? location.latitude;
  const rawLng = location.lng ?? location.lon ?? location.longitude;
  if (
    rawLat == null ||
    rawLng == null ||
    String(rawLat).trim() === "" ||
    String(rawLng).trim() === ""
  )
    return null;
  const lat = Number(rawLat),
    lng = Number(rawLng);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    return null;
  return {
    lat,
    lng,
    ...(location.label ? { label: location.label } : {}),
    ...(location.address ? { address: location.address } : {}),
  };
}
