"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  Check,
  Plus,
  ReceiptText,
  RotateCcw,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { PermissionGuard } from "../../../../components/auth/permission-guard";
import { RoleGuard } from "../../../../components/auth/role-guard";
import { useAuth } from "../../../../components/auth/auth-provider";
import {
  StaffDialog,
  StaffEmpty,
  StaffShell,
  StaffSync,
} from "../../../../components/staff/staff-shell";
import styles from "../../../../components/staff/staff.module.css";
import {
  CashChangePanel,
  resolveCash,
} from "../../../../components/payment/cash-change-panel";
import {
  POS_PAYMENT_METHOD_CODES,
  paymentMethodLabel,
  type PaymentMethodCode,
} from "../../../../components/payment/payment-methods";
import { apiFetch, SessionExpiredError } from "../../../../lib/api";
import {
  formatMoney,
  orderTypeLabels,
  type OrderType,
} from "../../../../lib/order-display";

type Order = {
  id: string;
  orderNumber: string;
  displayOrderNumber?: string | null;
  status: string;
  paymentStatus: string;
  total: string;
  type?: OrderType | null;
  table?: { name?: string | null; number?: number | null } | null;
  items: {
    id: string;
    productName: string;
    variantName?: string | null;
    quantity: string;
    totalPrice: string;
  }[];
  payments: { id: string; amount: string; status: string }[];
};
type Shift = { id: string; status: string; shiftNumber?: number } | null;
type Tender = { code: PaymentMethodCode; amount: string };
type ProcessResult = {
  order?: {
    id: string;
    orderNumber: string;
    displayOrderNumber?: string | null;
    paymentStatus: string;
    receipts?: { id: string; createdAt: string }[] | null;
  } | null;
};
type Completion = {
  orderLabel: string;
  paid: number;
  change: number;
  receiptId: string | null;
};

const createPaymentKey = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

const successStatuses = ["PAID", "SUCCESS"];

export default function PaymentPage() {
  return (
    <RoleGuard roles={["CASHIER", "BRANCH_MANAGER", "SUPER_ADMIN"]}>
      <PermissionGuard permission="PAYMENT_CREATE">
        <PaymentTerminal />
      </PermissionGuard>
    </RoleGuard>
  );
}

function PaymentTerminal() {
  const router = useRouter();
  const { logout } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [tenders, setTenders] = useState<Tender[]>([
    { code: "CASH", amount: "" },
  ]);
  const [cashReceived, setCashReceived] = useState("");
  const [currentShift, setCurrentShift] = useState<Shift>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [paymentKey, setPaymentKey] = useState(createPaymentKey);
  const submissionLock = useRef(false);
  const loadRequest = useRef<AbortController | null>(null);
  /*
   * Idempotentlik kaliti FAQAT urinish o'zgarganda yangilanadi.
   * `attemptRef` — oxirgi hisoblangan "imzo". Bir xil imzo bilan qayta
   * bosilsa kalit o'zgarmaydi va backend `paymentOperation.idempotencyKey`
   * unique indeksi ikkinchi to'lovni yaratmaydi.
   */
  const attemptRef = useRef<string | null>(null);

  const handleFailure = useCallback(
    (caught: unknown, fallback: string): string => {
      if (caught instanceof SessionExpiredError) {
        void logout();
        return caught.message;
      }

      return caught instanceof Error ? caught.message : fallback;
    },
    [logout],
  );

  const loadOrders = useCallback(async () => {
    loadRequest.current?.abort();
    const controller = new AbortController();
    loadRequest.current = controller;
    setIsLoading(true);
    setLoadError(null);
    try {
      const signal = AbortSignal.any([
        controller.signal,
        AbortSignal.timeout(12000),
      ]);
      const [nextOrders, shift] = await Promise.all([
        apiFetch<Order[]>("/orders?limit=50", { cache: "no-store", signal }),
        apiFetch<Shift>("/cash-register/shift", { signal }).catch(() => null),
      ]);

      if (controller.signal.aborted) {
        return;
      }

      const payable = nextOrders.filter(
        (order) =>
          order.status !== "CANCELLED" && order.paymentStatus !== "PAID",
      );
      setOrders(payable);
      setCurrentShift(shift);
      setUpdatedAt(new Date());
      setSelectedOrderId((current) =>
        current && payable.some((order) => order.id === current)
          ? current
          : (payable[0]?.id ?? null),
      );
    } catch (caught) {
      if (controller.signal.aborted) {
        return;
      }
      // Bo'sh ro'yxat va yuklanmagan ro'yxat — IKKI XIL holat.
      setOrders(null);
      setLoadError(handleFailure(caught, "Buyurtmalar yuklanmadi."));
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [handleFailure]);

  useEffect(() => {
    void loadOrders();
    return () => loadRequest.current?.abort();
  }, [loadOrders]);

  const selectedOrder = useMemo(
    () => orders?.find((order) => order.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );
  const total = Number(selectedOrder?.total ?? 0);
  const alreadyPaid =
    selectedOrder?.payments
      .filter((payment) => successStatuses.includes(payment.status))
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0) ?? 0;
  const outstanding = Math.max(0, total - alreadyPaid);
  const isSplit = tenders.length > 1;

  /*
   * Bitta tender rejimida summa har doim qoldiqqa teng: backend bittadan
   * ortiq tender bo'lsa aniq tenglikni talab qiladi, ortiq summani esa
   * har qanday holatda rad etadi. Shuning uchun kassir summani emas,
   * USULNI tanlaydi.
   */
  const payload = useMemo<{ code: PaymentMethodCode; amount: number }[]>(() => {
    if (!isSplit) {
      const code = tenders[0]?.code ?? "CASH";
      return outstanding > 0 ? [{ code, amount: outstanding }] : [];
    }

    return tenders.map((tender) => ({
      code: tender.code,
      amount: Number(tender.amount || 0),
    }));
  }, [isSplit, outstanding, tenders]);

  const payloadTotal = payload.reduce((sum, item) => sum + item.amount, 0);
  const cashDue = payload
    .filter((item) => item.code === "CASH")
    .reduce((sum, item) => sum + item.amount, 0);
  /*
   * Naqd ulushi bo'lmasa kiritilgan qiymat butunlay e'tiborsiz qoldiriladi:
   * aks holda kassir naqddan kartaga o'tganda eski summa "qaytim" bo'lib
   * ko'rinib qolardi.
   */
  const cash = resolveCash(cashDue > 0 ? cashReceived : "", cashDue);
  const needsShift = cashDue > 0;
  const shiftMissing = needsShift && currentShift?.status !== "OPEN";
  const splitMismatch = isSplit && Math.round(payloadTotal) !== Math.round(outstanding);
  const canSubmit =
    !!selectedOrder &&
    outstanding > 0 &&
    payload.length > 0 &&
    payload.every((item) => item.amount > 0) &&
    !splitMismatch &&
    cash.valid &&
    !shiftMissing &&
    !isSubmitting;

  // Buyurtma almashsa tenderlar va naqd maydoni tozalanadi.
  useEffect(() => {
    setTenders([{ code: "CASH", amount: "" }]);
    setCashReceived("");
    setSubmitError(null);
  }, [selectedOrderId]);

  /*
   * Kalitni yangilash sharti: buyurtma, qoldiq yoki YUBORILADIGAN tender
   * to'plami o'zgarsa. Xato chiqqandan keyin qayta bosish imzoni
   * o'zgartirmaydi — kalit ham o'zgarmaydi, ya'ni qayta urinish
   * mavjud operatsiyani qaytaradi, ikkinchi to'lovni yaratmaydi.
   */
  useEffect(() => {
    const attempt = JSON.stringify({
      orderId: selectedOrderId,
      outstanding: Math.round(outstanding),
      payload: payload.map((item) => [item.code, Math.round(item.amount)]),
    });

    if (attemptRef.current !== attempt) {
      attemptRef.current = attempt;
      setPaymentKey(createPaymentKey());
    }
  }, [outstanding, payload, selectedOrderId]);

  function updateTender(index: number, patch: Partial<Tender>) {
    setSubmitError(null);
    setTenders((current) =>
      current.map((tender, candidateIndex) =>
        candidateIndex === index ? { ...tender, ...patch } : tender,
      ),
    );
  }

  function addTender() {
    setSubmitError(null);
    setTenders((current) => {
      /*
       * Birinchi tender rejimida summa yashirin (qoldiqqa teng) edi —
       * aralash rejimga o'tganda uni ko'rinadigan qiymatga aylantiramiz,
       * aks holda yig'indi noto'g'ri hisoblanadi.
       */
      const normalized =
        current.length === 1 && current[0]
          ? [{ ...current[0], amount: String(Math.round(outstanding)) }]
          : current;
      const used = normalized.reduce(
        (sum, tender) => sum + Number(tender.amount || 0),
        0,
      );
      const rest = Math.max(0, Math.round(outstanding - used));
      return [
        ...normalized,
        { code: "CARD" as PaymentMethodCode, amount: rest ? String(rest) : "" },
      ];
    });
  }

  function removeTender(index: number) {
    setSubmitError(null);
    setTenders((current) =>
      current.length > 1
        ? current.filter((_, candidateIndex) => candidateIndex !== index)
        : current,
    );
  }

  function resetForNextOrder() {
    setCompletion(null);
    setTenders([{ code: "CASH", amount: "" }]);
    setCashReceived("");
    setSubmitError(null);
    void loadOrders();
  }

  async function submitPayment() {
    if (submissionLock.current || !selectedOrder || !canSubmit) {
      return;
    }

    submissionLock.current = true;
    setIsSubmitting(true);
    setSubmitError(null);
    const order = selectedOrder;
    const orderLabel = order.displayOrderNumber ?? order.orderNumber;
    try {
      const result = await apiFetch<ProcessResult>("/payments/process", {
        method: "POST",
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          orderId: order.id,
          idempotencyKey: paymentKey,
          ...(needsShift && currentShift?.id
            ? { shiftId: currentShift.id }
            : {}),
          /*
           * Naqd ustidan qabul qilingan ortiqcha pul SERVERGA
           * YUBORILMAYDI — faqat qoldiq summasi yoziladi.
           */
          payments: payload.map((item) => ({
            paymentMethodCode: item.code,
            amount: item.amount,
          })),
        }),
      });

      const receipts = result.order?.receipts ?? [];
      const latestReceipt = [...receipts].sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt),
      )[0];
      setConfirmOpen(false);
      setCompletion({
        orderLabel,
        paid: payloadTotal,
        change: cash.change,
        receiptId: latestReceipt?.id ?? (await findReceiptId(order.id)),
      });
      setTenders([{ code: "CASH", amount: "" }]);
      setCashReceived("");
      await loadOrders();
    } catch (caught) {
      setSubmitError(handleFailure(caught, "To'lov qabul qilinmadi."));
    } finally {
      submissionLock.current = false;
      setIsSubmitting(false);
    }
  }

  const orderLabel = selectedOrder
    ? (selectedOrder.displayOrderNumber ?? selectedOrder.orderNumber)
    : "";

  return (
    <StaffShell
      title="To'lov"
      actions={
        <Link className={styles.shiftLink} href="/pos">
          <ArrowLeft size={17} aria-hidden="true" />
          <span>Kassaga qaytish</span>
        </Link>
      }
    >
      <div className={`${styles.content} ${styles.narrowContent}`}>
        <div className={styles.overview}>
          <h2 className={styles.pageHeading}>To'lovni qabul qilish</h2>
          <StaffSync
            updatedAt={updatedAt}
            error={!!loadError}
            refreshing={isLoading}
            onRefresh={() => void loadOrders()}
          />
        </div>

        {loadError ? (
          <div className={styles.error} role="alert">
            <span>{loadError}</span>
            <button
              className={styles.button}
              onClick={() => void loadOrders()}
              type="button"
            >
              <RotateCcw size={16} aria-hidden="true" />
              Qayta urinish
            </button>
          </div>
        ) : null}

        {isLoading && !orders ? (
          <StaffEmpty title="Buyurtmalar yuklanmoqda..." />
        ) : !orders ? null : (
          <div className={styles.payLayout}>
            <aside className={styles.payOrders} aria-label="To'lanmagan buyurtmalar">
              <div className={styles.payOrdersHead}>
                <h3 className={styles.subheading}>To'lanmagan buyurtmalar</h3>
                <span className={styles.badge}>{orders.length} ta</span>
              </div>
              {orders.length ? (
                <div className={styles.payOrderList}>
                  {orders.map((order) => (
                    <button
                      className={styles.payOrderCard}
                      aria-pressed={selectedOrderId === order.id}
                      disabled={isSubmitting}
                      key={order.id}
                      onClick={() => setSelectedOrderId(order.id)}
                      type="button"
                    >
                      <strong>
                        #{order.displayOrderNumber ?? order.orderNumber}
                      </strong>
                      <span className={styles.muted}>{tableLabel(order)}</span>
                      <b>{formatMoney(order.total)}</b>
                    </button>
                  ))}
                </div>
              ) : (
                <StaffEmpty title="To'lanmagan buyurtma yo'q">
                  Yangi buyurtmalar shu yerda ko'rinadi.
                </StaffEmpty>
              )}
            </aside>

            {selectedOrder ? (
              <section className={styles.payMain} aria-label="To'lov ma'lumotlari">
                <div className={styles.payPanel}>
                  <div className={styles.payOrderHead}>
                    <div>
                      <span className={styles.muted}>Buyurtma</span>
                      <h3 className={styles.payOrderNumber}>#{orderLabel}</h3>
                      <span className={styles.muted}>
                        {tableLabel(selectedOrder)}
                      </span>
                    </div>
                    <div className={styles.payTotalBox}>
                      <span>To'lanishi kerak</span>
                      <strong>{formatMoney(outstanding)}</strong>
                      {alreadyPaid > 0 ? (
                        <small>
                          Jami {formatMoney(total)} · To'langan{" "}
                          {formatMoney(alreadyPaid)}
                        </small>
                      ) : null}
                    </div>
                  </div>
                  <ul className={styles.payItems}>
                    {selectedOrder.items.map((item) => (
                      <li className={styles.payItemRow} key={item.id}>
                        <span>
                          {formatQuantity(item.quantity)} ×{" "}
                          {item.productName}
                          {item.variantName ? ` (${item.variantName})` : ""}
                        </span>
                        <b>{formatMoney(item.totalPrice)}</b>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={styles.payPanel}>
                  <div className={styles.payOrdersHead}>
                    <h3 className={styles.subheading}>To'lov usuli</h3>
                    <button
                      className={styles.button}
                      disabled={isSubmitting || outstanding <= 0}
                      onClick={addTender}
                      type="button"
                    >
                      <Plus size={16} aria-hidden="true" />
                      Aralash to'lov
                    </button>
                  </div>

                  <div className={styles.payTenders}>
                    {tenders.map((tender, index) => (
                      <div
                        className={styles.payTenderRow}
                        key={`tender-${index}`}
                      >
                        <label className={styles.field}>
                          <span>Usul {isSplit ? index + 1 : ""}</span>
                          <select
                            className={styles.payTenderSelect}
                            aria-label={`To'lov usuli ${index + 1}`}
                            disabled={isSubmitting}
                            value={tender.code}
                            onChange={(event) =>
                              updateTender(index, {
                                code: event.target.value as PaymentMethodCode,
                              })
                            }
                          >
                            {POS_PAYMENT_METHOD_CODES.map((code) => (
                              <option key={code} value={code}>
                                {paymentMethodLabel(code)}
                              </option>
                            ))}
                          </select>
                        </label>
                        {isSplit ? (
                          <>
                            <label className={styles.field}>
                              <span>Summa</span>
                              <input
                                className={styles.input}
                                inputMode="numeric"
                                type="number"
                                min="0"
                                step="1"
                                disabled={isSubmitting}
                                value={tender.amount}
                                onChange={(event) =>
                                  updateTender(index, {
                                    amount: event.target.value,
                                  })
                                }
                              />
                            </label>
                            <button
                              className={styles.payRemove}
                              disabled={isSubmitting || tenders.length <= 1}
                              onClick={() => removeTender(index)}
                              type="button"
                            >
                              <Trash2 size={17} aria-hidden="true" />
                              <span>O'chirish</span>
                            </button>
                          </>
                        ) : (
                          <div className={styles.payFixedAmount}>
                            <span>Summa</span>
                            <strong>{formatMoney(outstanding)}</strong>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {isSplit ? (
                    <div className={styles.paySummary}>
                      <div className={styles.paySummaryRow}>
                        <span>Kiritilgan</span>
                        <b>{formatMoney(payloadTotal)}</b>
                      </div>
                      <div className={styles.paySummaryRow}>
                        <span>Qoldiq</span>
                        <b>{formatMoney(outstanding)}</b>
                      </div>
                    </div>
                  ) : null}

                  {splitMismatch ? (
                    <p className={styles.note}>
                      Aralash to'lovda summalar yig'indisi qoldiqqa aniq teng
                      bo'lishi shart: {formatMoney(outstanding)}.
                    </p>
                  ) : null}

                  {cashDue > 0 ? (
                    <CashChangePanel
                      cashDue={cashDue}
                      value={cashReceived}
                      onChange={(next) => {
                        setSubmitError(null);
                        setCashReceived(next);
                      }}
                      cash={cash}
                      disabled={isSubmitting}
                    />
                  ) : null}

                  {shiftMissing ? (
                    <div className={styles.error} role="alert">
                      <span>
                        Naqd pul qabul qilish uchun smena ochilishi kerak.
                      </span>
                      <button
                        className={styles.button}
                        onClick={() => router.push("/shift")}
                        type="button"
                      >
                        Smenani ochish
                      </button>
                    </div>
                  ) : null}

                  {outstanding <= 0 ? (
                    <p className={styles.note}>
                      Bu buyurtmada to'lanishi kerak summa qolmagan.
                    </p>
                  ) : null}

                  {submitError ? (
                    <div className={styles.error} role="alert">
                      <span>{submitError}</span>
                      <button
                        className={styles.button}
                        disabled={isSubmitting}
                        onClick={() => void submitPayment()}
                        type="button"
                      >
                        <RotateCcw size={16} aria-hidden="true" />
                        Qayta urinish
                      </button>
                    </div>
                  ) : null}

                  <div className={styles.payActions}>
                    <button
                      className={`${styles.primary} ${styles.full} ${styles.payPrimary}`}
                      disabled={!canSubmit}
                      onClick={() => setConfirmOpen(true)}
                      type="button"
                    >
                      <Banknote size={20} aria-hidden="true" />
                      {isSubmitting
                        ? "Qabul qilinmoqda..."
                        : `To'lovni qabul qilish · ${formatMoney(outstanding)}`}
                    </button>
                  </div>
                </div>
              </section>
            ) : orders.length ? (
              <StaffEmpty title="Buyurtma tanlanmagan">
                Chapdagi ro'yxatdan buyurtmani tanlang.
              </StaffEmpty>
            ) : null}
          </div>
        )}
      </div>

      {confirmOpen && selectedOrder ? (
        <StaffDialog
          title="To'lovni tasdiqlaysizmi?"
          busy={isSubmitting}
          onClose={() => setConfirmOpen(false)}
        >
          <p className={styles.muted}>
            #{orderLabel} · {tableLabel(selectedOrder)}
          </p>
          <div className={styles.payConfirmList}>
            {payload.map((item, index) => (
              <div className={styles.paySummaryRow} key={`${item.code}-${index}`}>
                <span>{paymentMethodLabel(item.code)}</span>
                <b>{formatMoney(item.amount)}</b>
              </div>
            ))}
            <div className={styles.paySummaryRow} data-tone="total">
              <span>Yoziladigan summa</span>
              <b>{formatMoney(payloadTotal)}</b>
            </div>
            {cashDue > 0 ? (
              <div className={styles.paySummaryRow}>
                <span>Mijoz uzatgan naqd</span>
                <b>{formatMoney(cash.received)}</b>
              </div>
            ) : null}
          </div>
          {cash.change > 0 ? (
            <div className={styles.payDialogChange}>
              <span>Qaytim</span>
              <strong>{formatMoney(cash.change)}</strong>
            </div>
          ) : null}
          <p className={styles.note}>
            <TriangleAlert size={15} aria-hidden="true" /> Tasdiqlangandan
            keyin to'lov bekor qilinmaydi.
          </p>
          {submitError ? (
            <p className={styles.error} role="alert">
              {submitError}
            </p>
          ) : null}
          <div className={styles.dialogActions}>
            <button
              className={styles.button}
              disabled={isSubmitting}
              onClick={() => setConfirmOpen(false)}
              type="button"
            >
              Bekor qilish
            </button>
            <button
              className={styles.primary}
              disabled={!canSubmit}
              onClick={() => void submitPayment()}
              type="button"
            >
              <Check size={18} aria-hidden="true" />
              {isSubmitting ? "Qabul qilinmoqda..." : "Tasdiqlash"}
            </button>
          </div>
        </StaffDialog>
      ) : null}

      {completion ? (
        <StaffDialog
          title="To'lov qabul qilindi"
          onClose={resetForNextOrder}
        >
          <div className={styles.success} role="status">
            #{completion.orderLabel} uchun {formatMoney(completion.paid)}{" "}
            qabul qilindi.
          </div>
          <div className={styles.payDialogChange}>
            <span>Qaytim</span>
            <strong>{formatMoney(completion.change)}</strong>
          </div>
          <div className={styles.dialogActions}>
            {completion.receiptId ? (
              <Link
                className={styles.secondary}
                href={`/pos/receipt/${completion.receiptId}`}
              >
                <ReceiptText size={18} aria-hidden="true" />
                Chekni ko'rish
              </Link>
            ) : null}
            <button
              className={styles.primary}
              onClick={resetForNextOrder}
              type="button"
            >
              <Check size={18} aria-hidden="true" />
              Yangi buyurtma
            </button>
          </div>
        </StaffDialog>
      ) : null}
    </StaffShell>
  );
}

/**
 * `/payments/process` javobida chek bo'lmasa (masalan qisman to'lov
 * to'liq bo'lib qolgan holatlar), chekni buyurtma bo'yicha izlaymiz.
 * Topilmasa `null` — bu to'lovni buzmaydi, faqat havola ko'rsatilmaydi.
 */
async function findReceiptId(orderId: string): Promise<string | null> {
  try {
    const receipt = await apiFetch<{ id: string }>(
      `/receipts/order/${orderId}`,
      { signal: AbortSignal.timeout(8000) },
    );
    return receipt.id;
  } catch {
    return null;
  }
}

function tableLabel(order: Order): string {
  if (order.table?.name) {
    return order.table.name;
  }

  if (order.table?.number) {
    return `${order.table.number}-stol`;
  }

  return order.type ? orderTypeLabels[order.type] : "Olib ketish";
}

function formatQuantity(value: string): string {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(2);
}
