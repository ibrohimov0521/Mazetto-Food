"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthShell } from "../../../components/auth/auth-shell";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";
import { EmptyState } from "../../../components/erp/erp-ui";
import { apiFetch } from "../../../lib/api";

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: string;
  table?: { name?: string | null; number?: number | null } | null;
  items: { id: string; productName: string; quantity: string; totalPrice: string }[];
  payments: { id: string; amount: string; status: string; method?: { code: string } }[];
};
type Shift = { id: string; status: string } | null;
type PaymentCode = "CASH" | "CARD" | "CLICK" | "PAYME" | "UZCARD" | "HUMO" | "ONLINE";
type Tender = { code: PaymentCode; amount: string };

const paymentCodes: PaymentCode[] = ["CASH", "CARD", "CLICK", "PAYME", "UZCARD", "HUMO", "ONLINE"];

export default function PaymentPage() {
  return (
    <RoleGuard roles={["CASHIER", "BRANCH_MANAGER", "SUPER_ADMIN"]}>
      <PermissionGuard permission="PAYMENT_CREATE">
        <AuthShell eyebrow="Cash register" title="Payment terminal">
          <PaymentTerminal />
        </AuthShell>
      </PermissionGuard>
    </RoleGuard>
  );
}

function PaymentTerminal() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [tenders, setTenders] = useState<Tender[]>([{ code: "CASH", amount: "" }]);
  const [currentShift, setCurrentShift] = useState<Shift>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    const nextOrders = await apiFetch<Order[]>("/orders?limit=50");
    const payableOrders = nextOrders.filter((order) => order.status !== "CANCELLED" && order.paymentStatus !== "PAID");
    setOrders(payableOrders);
    setSelectedOrderId((current) => current ?? payableOrders[0]?.id ?? null);
  }, []);

  const loadShift = useCallback(async () => {
    setCurrentShift(await apiFetch<Shift>("/cash-register/shift"));
  }, []);

  useEffect(() => {
    void loadOrders();
    void loadShift();
  }, [loadOrders, loadShift]);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );
  const total = Number(selectedOrder?.total ?? 0);
  const alreadyPaid = selectedOrder?.payments
    .filter((payment) => ["PAID", "SUCCESS"].includes(payment.status))
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0) ?? 0;
  const outstanding = Math.max(0, total - alreadyPaid);
  const tenderTotal = tenders.reduce((sum, tender) => sum + Number(tender.amount || 0), 0);
  const remaining = Math.max(0, outstanding - tenderTotal);

  useEffect(() => {
    if (selectedOrder) {
      const paid = selectedOrder.payments
        .filter((payment) => ["PAID", "SUCCESS"].includes(payment.status))
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      setTenders([{ code: "CASH", amount: String(Math.max(0, Number(selectedOrder.total) - paid)) }]);
    }
  }, [selectedOrder?.id]);

  async function submitPayment() {
    if (!selectedOrder) {
      return;
    }

    await apiFetch("/payments/process", {
      method: "POST",
      body: JSON.stringify({
        orderId: selectedOrder.id,
        idempotencyKey: crypto.randomUUID(),
        ...(tenders.some((tender) => tender.code === "CASH") && currentShift?.id ? { shiftId: currentShift.id } : {}),
        payments: tenders
          .filter((tender) => Number(tender.amount) > 0)
          .map((tender) => ({ paymentMethodCode: tender.code, amount: Number(tender.amount) })),
      }),
    });
    setMessage(`Payment completed for ${selectedOrder.orderNumber}`);
    await loadOrders();
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <aside className="rounded-3xl border border-neutral-100 bg-white p-4 shadow-[0_14px_45px_rgba(17,24,39,0.08)]">
        <h2 className="text-lg font-semibold text-neutral-950">Payable orders</h2>
        <div className="mt-4 grid gap-3">
          {orders.length ? (
            orders.map((order) => (
              <button
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  selectedOrderId === order.id ? "border-emerald-500 bg-emerald-50" : "border-neutral-100 bg-white"
                }`}
                key={order.id}
                onClick={() => setSelectedOrderId(order.id)}
                type="button"
              >
                <p className="font-semibold text-neutral-950">{order.orderNumber}</p>
                <p className="mt-1 text-sm text-neutral-500">{tableLabel(order)} · {formatMoney(order.total)}</p>
              </button>
            ))
          ) : (
            <EmptyState title="No payable orders." />
          )}
        </div>
      </aside>

      <div className="grid gap-5">
        {selectedOrder ? (
          <>
            <div className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-[0_14px_45px_rgba(17,24,39,0.08)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-emerald-700">Order</p>
                  <h2 className="mt-1 text-2xl font-semibold text-neutral-950">{selectedOrder.orderNumber}</h2>
                  <p className="mt-1 text-sm text-neutral-500">{tableLabel(selectedOrder)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-neutral-500">Total</p>
                  <p className="text-4xl font-semibold text-neutral-950">{formatMoney(selectedOrder.total)}</p>
                </div>
              </div>
              <div className="mt-5 grid gap-2">
                {selectedOrder.items.map((item) => (
                  <div className="flex justify-between rounded-2xl bg-neutral-50 px-4 py-3 text-sm" key={item.id}>
                    <span className="font-semibold text-neutral-800">{formatQuantity(item.quantity)}x {item.productName}</span>
                    <span className="text-neutral-600">{formatMoney(item.totalPrice)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-[0_14px_45px_rgba(17,24,39,0.08)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-neutral-950">Payment</h2>
                <button
                  className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700"
                  onClick={() => setTenders([...tenders, { code: "CARD", amount: String(remaining || "") }])}
                  type="button"
                >
                  Aralash
                </button>
              </div>
              <div className="mt-4 grid gap-3">
                {tenders.map((tender, index) => (
                  <div className="grid gap-3 rounded-2xl bg-neutral-50 p-3 sm:grid-cols-[1fr_180px_auto]" key={`${tender.code}-${index}`}>
                    <select
                      className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-500"
                      value={tender.code}
                      onChange={(event) =>
                        setTenders((current) =>
                          current.map((candidate, candidateIndex) =>
                            candidateIndex === index ? { ...candidate, code: event.target.value as PaymentCode } : candidate,
                          ),
                        )
                      }
                    >
                      {paymentCodes.map((code) => (
                        <option key={code} value={code}>{code}</option>
                      ))}
                    </select>
                    <input
                      className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-500"
                      inputMode="decimal"
                      onChange={(event) =>
                        setTenders((current) =>
                          current.map((candidate, candidateIndex) =>
                            candidateIndex === index ? { ...candidate, amount: event.target.value } : candidate,
                          ),
                        )
                      }
                      value={tender.amount}
                    />
                    <button className="rounded-2xl px-4 py-3 text-sm font-semibold text-red-600" onClick={() => setTenders(tenders.filter((_, i) => i !== index))} type="button">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid gap-2 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-neutral-800 sm:grid-cols-3">
                <span>Total: {formatMoney(total)}</span>
                <span>Paid: {formatMoney(tenderTotal)}</span>
                <span>Remaining: {formatMoney(remaining)}</span>
              </div>
              {tenders.some((tender) => tender.code === "CASH") && !currentShift?.id ? (
                <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">Open a cashier shift before accepting cash.</p>
              ) : null}
              {message ? <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
              <button
                className="mt-5 w-full rounded-2xl bg-emerald-600 px-5 py-4 text-base font-bold text-white shadow-[0_12px_30px_rgba(5,150,105,0.25)] transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!selectedOrder || tenderTotal !== outstanding || (tenders.some((tender) => tender.code === "CASH") && !currentShift?.id)}
                onClick={() => void submitPayment()}
                type="button"
              >
                TO&apos;LOV
              </button>
            </div>
          </>
        ) : (
          <EmptyState title="Select an order to receive payment." />
        )}
      </div>
    </section>
  );
}

function tableLabel(order: Order): string {
  return order.table?.name ?? (order.table?.number ? `Table ${order.table.number}` : "Pickup / delivery");
}

function formatMoney(value: string | number): string {
  return `${Number(value || 0).toLocaleString("uz-UZ")} UZS`;
}

function formatQuantity(value: string): string {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(2);
}
