"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Printer, RefreshCw, Search } from "lucide-react";
import { useAuth } from "../../../../components/auth/auth-provider";
import { CashierWorkspaceNavigation } from "../../../../components/staff/staff-panel-navigation";
import {
  StaffDialog,
  StaffEmpty,
  StaffShell,
} from "../../../../components/staff/staff-shell";
import styles from "../../../../components/staff/staff.module.css";
import { apiFetch } from "../../../../lib/api";
import { hasPermission } from "../../../../lib/auth";
import { formatMoney, orderStatusLabels } from "../../../../lib/order-display";

type ShiftRow = {
  id: string;
  shiftNumber: number;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closedAt?: string | null;
  openingBalance: string;
  closingBalance?: string | null;
  expectedCash?: string | null;
  cashDifference?: string | null;
  orderCount?: number;
  branch?: { id: string; name: string };
  employee?: { firstName: string; lastName?: string | null };
};

type OrderRow = {
  id: string;
  version: number;
  shiftId?: string | null;
  orderNumber: string;
  displayOrderNumber?: string | null;
  status: string;
  paymentStatus: string;
  total: string;
  type?: string | null;
  customerName?: string | null;
  notes?: string | null;
  createdAt: string;
  table?: { name?: string | null; number?: number | null } | null;
  items: {
    id: string;
    productName: string;
    variantName?: string | null;
    quantity: string;
    totalPrice: string;
    status?: string;
    cancellationReason?: string | null;
  }[];
  receipts?: {
    id: string;
    documentType?: string;
    receiptNumber: string;
  }[];
  payments?: {
    id: string;
    amount: string;
    status: string;
    method?: { name: string; code: string } | null;
    refunds?: {
      id: string;
      orderItemId?: string | null;
      amount: string;
      reason: string;
      createdAt: string;
    }[];
  }[];
  statusHistory?: {
    id: string;
    toStatus: string;
    reason?: string | null;
    createdAt: string;
  }[];
};

const pageSize = 100;

export default function CashierHistoryPage() {
  const router = useRouter();
  const { isReady, user } = useAuth();
  const canViewOwn = hasPermission(user, "SHIFT_VIEW_OWN");
  const canViewBranch = hasPermission(user, "SHIFT_VIEW_BRANCH");
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [shiftId, setShiftId] = useState("");
  const [requestedShiftId, setRequestedShiftId] = useState("");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("newest");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingShifts, setLoadingShifts] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [error, setError] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [reprintingId, setReprintingId] = useState("");
  const [message, setMessage] = useState("");
  const [cancelTarget, setCancelTarget] = useState<{
    itemId: string;
    productName: string;
    amount: string;
    idempotencyKey: string;
  } | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancellingItemId, setCancellingItemId] = useState("");
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setRequestedShiftId(
      new URLSearchParams(window.location.search).get("shiftId") ?? "",
    );
  }, []);

  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!canViewOwn && !canViewBranch) {
      router.replace("/access-denied");
      return;
    }

    let active = true;
    setLoadingShifts(true);
    setError("");
    const endpoint = canViewBranch
      ? "/shifts?limit=100&offset=0"
      : "/cash-register/shifts?limit=100&offset=0";
    apiFetch<ShiftRow[]>(endpoint, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    })
      .then(async (listedShifts) => {
        if (!active) return;
        let nextShifts = listedShifts;
        if (
          requestedShiftId &&
          !listedShifts.some((shift) => shift.id === requestedShiftId)
        ) {
          try {
            const requestedShift = await apiFetch<ShiftRow>(
              `/cash-register/shifts/${encodeURIComponent(requestedShiftId)}`,
              { cache: "no-store", signal: AbortSignal.timeout(12000) },
            );
            nextShifts = [requestedShift, ...listedShifts];
          } catch {
            // Keep the available shift list if the requested shift is outside the actor's scope.
          }
        }
        if (!active) return;
        setShifts(nextShifts);
        setShiftId((current) =>
          requestedShiftId &&
          nextShifts.some((shift) => shift.id === requestedShiftId)
            ? requestedShiftId
            : current && nextShifts.some((shift) => shift.id === current)
              ? current
              : (nextShifts.find((shift) => shift.status === "OPEN")?.id ??
                nextShifts[0]?.id ??
                ""),
        );
      })
      .catch((caught) => {
        if (active)
          setError(
            caught instanceof Error ? caught.message : "Smenalar yuklanmadi.",
          );
      })
      .finally(() => {
        if (active) setLoadingShifts(false);
      });

    return () => {
      active = false;
    };
  }, [canViewBranch, canViewOwn, isReady, requestedShiftId, router, user]);

  const loadOrders = useCallback(
    async (nextOffset = 0, append = false) => {
      if (!shiftId) {
        setOrders([]);
        setHasMore(false);
        return;
      }
      setLoadingOrders(true);
      setError("");
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(nextOffset),
      });
      if (status) params.set("status", status);
      if (appliedSearch.trim()) params.set("search", appliedSearch.trim());
      try {
        const page = await apiFetch<OrderRow[]>(
          `/cash-register/shift/${encodeURIComponent(shiftId)}/orders?${params}`,
          { cache: "no-store", signal: AbortSignal.timeout(15000) },
        );
        setOrders((current) =>
          append
            ? [
                ...current,
                ...page.filter(
                  (row) => !current.some((item) => item.id === row.id),
                ),
              ]
            : page,
        );
        setOffset(nextOffset);
        setHasMore(page.length === pageSize);
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Buyurtmalar yuklanmadi.",
        );
      } finally {
        setLoadingOrders(false);
      }
    },
    [appliedSearch, shiftId, status],
  );

  useEffect(() => {
    void loadOrders(0, false);
  }, [loadOrders]);

  const sortedOrders = useMemo(() => {
    const result = [...orders];
    result.sort((a, b) => {
      if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
      if (sort === "amount-high") return Number(b.total) - Number(a.total);
      if (sort === "amount-low") return Number(a.total) - Number(b.total);
      return b.createdAt.localeCompare(a.createdAt);
    });
    return result;
  }, [orders, sort]);

  const shift = shifts.find((row) => row.id === shiftId);
  const orderDetail = orders.find((row) => row.id === selectedOrderId) ?? null;
  const completedOrders = sortedOrders.filter((row) =>
    ["SERVED", "COMPLETED"].includes(row.status),
  );
  const cancelledOrders = sortedOrders.filter(
    (row) => row.status === "CANCELLED",
  );
  const inProgressOrders = sortedOrders.filter(
    (row) => !["SERVED", "COMPLETED", "CANCELLED"].includes(row.status),
  );
  const showPrint = hasPermission(user, "RECEIPT_PRINT");
  const canCancelItems =
    hasPermission(user, "ORDER_UPDATE") &&
    hasPermission(user, "PAYMENT_REFUND") &&
    shift?.status === "OPEN" &&
    orderDetail?.shiftId === shift.id &&
    orderDetail.status !== "CANCELLED";

  async function reprint(receiptId: string) {
    setReprintingId(receiptId);
    setMessage("");
    setError("");
    try {
      await apiFetch(`/receipts/${encodeURIComponent(receiptId)}/reprint`, {
        method: "POST",
        signal: AbortSignal.timeout(12000),
      });
      setMessage("Chek qayta chop etish navbatiga qo'shildi.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Chek chop etilmadi.",
      );
    } finally {
      setReprintingId("");
    }
  }

  async function cancelItem() {
    if (!orderDetail || !cancelTarget || !cancelReason.trim()) return;
    const itemId = cancelTarget.itemId;
    setCancellingItemId(itemId);
    setMessage("");
    setError("");
    try {
      await apiFetch(
        `/orders/${encodeURIComponent(orderDetail.id)}/items/${encodeURIComponent(itemId)}/actions/cancel`,
        {
          method: "POST",
          headers: { "Idempotency-Key": cancelTarget.idempotencyKey },
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            expectedVersion: orderDetail.version,
            reasonCode: "CASHIER_ITEM_CANCELLED",
            reason: cancelReason.trim(),
          }),
        },
      );
      setCancelTarget(null);
      setCancelReason("");
      setMessage(
        "Mahsulot bekor qilindi; zarur naqd qaytarish smenaga yozildi.",
      );
      await loadOrders(offset, false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Mahsulotni bekor qilib bo'lmadi.",
      );
    } finally {
      setCancellingItemId("");
    }
  }

  if (!isReady || !user || (!canViewOwn && !canViewBranch)) {
    return <main className="min-h-screen bg-white" />;
  }

  return (
    <StaffShell
      title="Kassa"
      actions={<CashierWorkspaceNavigation user={user} />}
    >
      <div className={styles.content}>
        <div className={styles.overview}>
          <div>
            <h2 className={styles.pageHeading}>Smena va buyurtmalar tarixi</h2>
            {shift ? (
              <p className={styles.muted}>
                {shift.branch?.name ? `${shift.branch.name} · ` : ""}
                Smena #{shift.shiftNumber} ·{" "}
                {shift.status === "OPEN" ? "Ochiq" : "Yopilgan"}
              </p>
            ) : null}
          </div>
          <button
            aria-label="Tarixni yangilash"
            className={styles.iconButton}
            disabled={loadingShifts || loadingOrders}
            onClick={() => {
              window.location.reload();
            }}
            title="Yangilash"
            type="button"
          >
            <RefreshCw size={17} />
          </button>
        </div>

        <div className={styles.historyControls}>
          <label className={styles.field}>
            <span>Smena</span>
            <select
              className={styles.input}
              value={shiftId}
              onChange={(event) => setShiftId(event.target.value)}
              disabled={loadingShifts || shifts.length === 0}
            >
              {shifts.length === 0 ? (
                <option value="">Smena topilmadi</option>
              ) : null}
              {shifts.map((row) => (
                <option key={row.id} value={row.id}>
                  #{row.shiftNumber} · {formatDate(row.openedAt)} ·{" "}
                  {row.status === "OPEN" ? "Ochiq" : "Yopilgan"}
                  {canViewBranch && row.employee
                    ? ` · ${row.employee.firstName} ${row.employee.lastName ?? ""}`
                    : ""}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.search}>
            <Search size={17} />
            <input
              aria-label="Buyurtma qidirish"
              placeholder="Raqam, mijoz yoki mahsulot"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") setAppliedSearch(search);
              }}
            />
          </label>
          <select
            aria-label="Buyurtma holati"
            className={styles.historySelect}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Barcha holatlar</option>
            {Object.entries(orderStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Tartiblash"
            className={styles.historySelect}
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="newest">Yangi avval</option>
            <option value="oldest">Eski avval</option>
            <option value="amount-high">Summa: ko'pdan kamga</option>
            <option value="amount-low">Summa: kamdan ko'pga</option>
          </select>
          <button
            className={styles.button}
            disabled={loadingOrders}
            onClick={() => setAppliedSearch(search)}
            type="button"
          >
            Izlash
          </button>
        </div>

        {shift ? (
          <section className={styles.stats} aria-label="Smena xulosasi">
            <div className={styles.stat}>
              <span>Buyurtmalar</span>
              <strong>{shift.orderCount ?? sortedOrders.length}</strong>
            </div>
            <div className={styles.stat}>
              <span>Kutilgan naqd</span>
              <strong>{formatMoney(shift.expectedCash ?? 0)}</strong>
            </div>
            <div className={styles.stat}>
              <span>Yakuniy naqd</span>
              <strong>
                {formatMoney(shift.closingBalance ?? shift.expectedCash ?? 0)}
              </strong>
            </div>
          </section>
        ) : null}

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className={styles.success} role="status">
            {message}
          </p>
        ) : null}
        {loadingShifts ? (
          <StaffEmpty title="Smenalar yuklanmoqda..." />
        ) : !shift ? (
          <StaffEmpty title="Smena topilmadi">
            Tanlangan foydalanuvchi yoki filialda smena yo'q.
          </StaffEmpty>
        ) : loadingOrders && orders.length === 0 ? (
          <StaffEmpty title="Buyurtmalar yuklanmoqda..." />
        ) : sortedOrders.length === 0 ? (
          <StaffEmpty title="Buyurtmalar topilmadi">
            Qidiruv yoki tanlangan holat bo'yicha natija yo'q.
          </StaffEmpty>
        ) : (
          <div className={styles.historyList}>
            <OrderGroup
              title="Topshirilgan / yakunlangan"
              rows={completedOrders}
              onSelect={setSelectedOrderId}
            />
            <OrderGroup
              title="Jarayonda"
              rows={inProgressOrders}
              onSelect={setSelectedOrderId}
            />
            <OrderGroup
              title="Bekor qilingan"
              rows={cancelledOrders}
              onSelect={setSelectedOrderId}
            />
            <div className={styles.totalRow}>
              <span>Ko'rsatilgan buyurtmalar jami</span>
              <strong>
                {formatMoney(
                  sortedOrders.reduce((sum, row) => sum + Number(row.total), 0),
                )}
              </strong>
            </div>
            {hasMore ? (
              <button
                className={styles.secondary}
                disabled={loadingOrders}
                onClick={() => void loadOrders(offset + pageSize, true)}
                type="button"
              >
                {loadingOrders ? "Yuklanmoqda..." : "Keyingi buyurtmalar"}
              </button>
            ) : null}
          </div>
        )}
      </div>

      {selectedOrderId ? (
        <StaffDialog
          title={
            orderDetail
              ? `Buyurtma #${orderDetail.displayOrderNumber ?? orderDetail.orderNumber}`
              : "Buyurtma tafsiloti"
          }
          busy={false}
          onClose={() => setSelectedOrderId("")}
        >
          {orderDetail ? (
            <>
              <div className={styles.shiftRows}>
                <div>
                  <span>Holat</span>
                  <strong>
                    {orderStatusLabels[
                      orderDetail.status as keyof typeof orderStatusLabels
                    ] ?? orderDetail.status}
                  </strong>
                </div>
                <div>
                  <span>Vaqt</span>
                  <strong>{formatDate(orderDetail.createdAt)}</strong>
                </div>
                <div>
                  <span>Buyurtma turi</span>
                  <strong>{orderTypeLabel(orderDetail.type)}</strong>
                </div>
                {orderDetail.customerName ? (
                  <div>
                    <span>Mijoz</span>
                    <strong>{orderDetail.customerName}</strong>
                  </div>
                ) : null}
                {orderDetail.table ? (
                  <div>
                    <span>Stol</span>
                    <strong>
                      {orderDetail.table.name ??
                        orderDetail.table.number ??
                        "—"}
                    </strong>
                  </div>
                ) : null}
              </div>
              <h3 className={styles.subheading}>Mahsulotlar</h3>
              <ul className={styles.itemList}>
                {orderDetail.items.map((item) => (
                  <li className={styles.historyItemRow} key={item.id}>
                    <span>
                      {item.productName}
                      {item.variantName ? ` · ${item.variantName}` : ""} ×{" "}
                      {item.quantity}
                      {item.status === "CANCELLED" ? " · Bekor qilingan" : ""}
                      {item.status === "CANCELLED" &&
                      item.cancellationReason ? (
                        <small className={styles.muted}>
                          Bekor sababi: {item.cancellationReason}
                        </small>
                      ) : null}
                    </span>
                    <strong>{formatMoney(item.totalPrice)}</strong>
                    {canCancelItems && item.status !== "CANCELLED" ? (
                      <button
                        aria-label={`${item.productName} mahsulotini bekor qilish`}
                        className={styles.itemCancel}
                        disabled={!isOnline || Boolean(cancellingItemId)}
                        onClick={() =>
                          setCancelTarget({
                            itemId: item.id,
                            productName: item.productName,
                            amount: item.totalPrice,
                            idempotencyKey: crypto.randomUUID(),
                          })
                        }
                        title={
                          !isOnline
                            ? "Bekor qilish uchun internet kerak"
                            : "Mahsulotni bekor qilish"
                        }
                        type="button"
                      >
                        <Ban size={15} />
                        <span>Bekor</span>
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
              {orderDetail.notes ? (
                <p className={styles.note}>Izoh: {orderDetail.notes}</p>
              ) : null}
              <div className={styles.totalRow}>
                <span>Jami</span>
                <strong>{formatMoney(orderDetail.total)}</strong>
              </div>
              {orderDetail.payments?.length ? (
                <>
                  <h3 className={styles.subheading}>To'lovlar</h3>
                  <ul className={styles.itemList}>
                    {orderDetail.payments.map((payment) => (
                      <li key={payment.id}>
                        <span>
                          {payment.method?.name ??
                            payment.method?.code ??
                            "To'lov"}{" "}
                          · {payment.status}
                        </span>
                        <strong>{formatMoney(payment.amount)}</strong>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {orderDetail.payments?.some(
                (payment) => (payment.refunds?.length ?? 0) > 0,
              ) ? (
                <>
                  <h3 className={styles.subheading}>Naqd qaytarimlar</h3>
                  <ul className={styles.itemList}>
                    {orderDetail.payments.flatMap((payment) =>
                      (payment.refunds ?? []).map((refund) => {
                        const itemName = refund.orderItemId
                          ? orderDetail.items.find(
                              (item) => item.id === refund.orderItemId,
                            )?.productName
                          : null;
                        return (
                          <li key={refund.id}>
                            <span>
                              <strong>
                                -{formatMoney(refund.amount)}
                                {itemName ? ` · ${itemName}` : ""}
                              </strong>
                              <small className={styles.muted}>
                                {refund.reason} · {formatDate(refund.createdAt)}
                              </small>
                            </span>
                            <span className={styles.muted}>Qaytarildi</span>
                          </li>
                        );
                      }),
                    )}
                  </ul>
                </>
              ) : null}
              {orderDetail.statusHistory?.length ? (
                <details className={styles.deliveryDetails}>
                  <summary>Holatlar tarixi</summary>
                  <ul className={styles.itemList}>
                    {orderDetail.statusHistory.map((entry) => (
                      <li key={entry.id}>
                        <span>
                          {orderStatusLabels[
                            entry.toStatus as keyof typeof orderStatusLabels
                          ] ?? entry.toStatus}
                        </span>
                        <span className={styles.muted}>
                          {formatDate(entry.createdAt)}
                          {entry.reason ? ` · ${entry.reason}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              {showPrint &&
              orderDetail.receipts?.filter(
                (receipt) =>
                  !receipt.documentType || receipt.documentType === "RECEIPT",
              ).length ? (
                <div className={styles.dialogActions}>
                  {orderDetail.receipts
                    .filter(
                      (receipt) =>
                        !receipt.documentType ||
                        receipt.documentType === "RECEIPT",
                    )
                    .map((receipt) => (
                      <button
                        className={styles.secondary}
                        disabled={reprintingId === receipt.id}
                        key={receipt.id}
                        onClick={() => void reprint(receipt.id)}
                        type="button"
                      >
                        <Printer size={16} />
                        {reprintingId === receipt.id
                          ? "Navbatga qo'shilmoqda..."
                          : `Chekni qayta chiqarish · ${receipt.receiptNumber}`}
                      </button>
                    ))}
                </div>
              ) : null}
            </>
          ) : (
            <StaffEmpty title="Buyurtma ma'lumoti yo'q">
              Tarix ro'yxatini yangilang va qayta oching.
            </StaffEmpty>
          )}
        </StaffDialog>
      ) : null}

      {cancelTarget && orderDetail ? (
        <StaffDialog
          title="Mahsulotni bekor qilish"
          busy={Boolean(cancellingItemId)}
          onClose={() => {
            if (cancellingItemId) return;
            setCancelTarget(null);
            setCancelReason("");
          }}
        >
          <p className={styles.muted}>
            {cancelTarget.productName} · {formatMoney(cancelTarget.amount)}
          </p>
          <p className={styles.note}>
            Buyurtmaning ochiq smenasi tekshiriladi. To'langan ortiqcha summa
            faqat naqd to'lovdan qaytariladi; karta yoki QR uchun provayder
            qaytarishi sozlanmagan bo'lsa amal rad etiladi.
          </p>
          <label className={styles.field}>
            <span>Bekor qilish sababi</span>
            <textarea
              className={styles.input}
              maxLength={500}
              value={cancelReason}
              onChange={(event) => {
                const reason = event.target.value;
                if (reason !== cancelReason) {
                  setCancelTarget((current) =>
                    current
                      ? { ...current, idempotencyKey: crypto.randomUUID() }
                      : current,
                  );
                }
                setCancelReason(reason);
              }}
              rows={3}
            />
          </label>
          <div className={styles.dialogActions}>
            <button
              className={styles.secondary}
              disabled={Boolean(cancellingItemId)}
              onClick={() => setCancelTarget(null)}
              type="button"
            >
              Ortga
            </button>
            <button
              className={styles.danger}
              disabled={
                !isOnline ||
                Boolean(cancellingItemId) ||
                cancelReason.trim().length < 3
              }
              onClick={() => void cancelItem()}
              type="button"
            >
              {cancellingItemId
                ? "Bajarilmoqda..."
                : "Bekor qilishni tasdiqlash"}
            </button>
          </div>
        </StaffDialog>
      ) : null}
    </StaffShell>
  );
}

function OrderGroup({
  title,
  rows,
  onSelect,
}: {
  title: string;
  rows: OrderRow[];
  onSelect: (orderId: string) => void;
}) {
  if (!rows.length) return null;
  return (
    <section>
      <h3 className={styles.subheading}>
        {title} · {rows.length}
      </h3>
      <div className={styles.historyList}>
        {rows.map((row) => (
          <button
            className={styles.historyOrder}
            key={row.id}
            onClick={() => onSelect(row.id)}
            type="button"
          >
            <span>
              <strong>#{row.displayOrderNumber ?? row.orderNumber}</strong>
              <span className={styles.muted}>
                {formatDate(row.createdAt)} · {row.items.length} ta mahsulot
              </span>
            </span>
            <span className={styles.historyAmount}>
              <span
                className={styles.badge}
                data-tone={
                  row.status === "CANCELLED"
                    ? "late"
                    : row.status === "COMPLETED" || row.status === "SERVED"
                      ? "ready"
                      : "waiting"
                }
              >
                {orderStatusLabels[
                  row.status as keyof typeof orderStatusLabels
                ] ?? row.status}
              </span>
              <strong>{formatMoney(row.total)}</strong>
            </span>
          </button>
        ))}
      </div>
      <div className={styles.totalRow}>
        <span>{title} jami</span>
        <strong>
          {formatMoney(rows.reduce((sum, row) => sum + Number(row.total), 0))}
        </strong>
      </div>
    </section>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tashkent",
  });
}

function orderTypeLabel(type?: string | null) {
  if (type === "DINE_IN") return "Zal";
  if (type === "TAKEAWAY") return "Olib ketish";
  if (type === "DELIVERY") return "Yetkazib berish";
  return type ?? "—";
}
