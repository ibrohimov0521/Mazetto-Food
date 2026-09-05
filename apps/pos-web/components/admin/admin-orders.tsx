"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { canSwitchBranch } from "../../lib/admin-nav";
import {
  formatDateTime,
  formatMoney,
  maskPhone,
  orderSourceLabels,
  orderStatusLabels,
  orderStatusTone,
  orderTypeLabels,
  paymentStatusLabels,
  paymentStatusTone,
  type OrderSource,
  type OrderStatus,
  type OrderType,
  type PaymentStatus,
} from "../../lib/order-display";
import { useAuth } from "../auth/auth-provider";
import { Badge } from "../admin-ui/badge";
import { Button, ButtonLink } from "../admin-ui/button";
import { Card, CardBody, CardHeader } from "../admin-ui/card";
import { DataTable, type DataTableColumn } from "../admin-ui/data-table";
import { ErrorState, SkeletonRows } from "../admin-ui/feedback";
import { FilterBar, Select } from "../admin-ui/form";

/*
 * Admin buyurtmalar moduli.
 *
 * Backend allaqachon tayyor edi (`/orders`, `/orders/:id`), lekin admin panelda
 * ekrani yo'q edi — POS, sayt va Telegram buyurtmalari birga ko'rinmasdi.
 *
 * Bu ekran FAQAT O'QISH uchun. Status o'zgartirish oshxona va kassa ishi;
 * `ORDER_SEND_KITCHEN` permission'i bu yerda ishlatilmaydi.
 */

type Branch = { id: string; code: string; name: string };

type OrderItem = {
  id: string;
  productName: string;
  variantName?: string | null;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
  notes?: string | null;
  status?: string;
};

type OrderPayment = {
  id: string;
  amount: string;
  status: PaymentStatus;
  methodCode?: string | null;
  paidAt?: string | null;
  method?: { code: string; name: string } | null;
};

type OrderStatusHistory = {
  id: string;
  toStatus: OrderStatus;
  reason?: string | null;
  createdAt: string;
};

export type AdminOrder = {
  id: string;
  orderNumber: string;
  source: OrderSource;
  type: OrderType;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  customerName?: string | null;
  customerPhone?: string | null;
  deliveryAddress?: string | null;
  notes?: string | null;
  kitchenComment?: string | null;
  subtotal: string;
  discountTotal: string;
  deliveryFeeTotal: string;
  total: string;
  createdAt: string;
  branch?: { id: string; code: string; name: string } | null;
  table?: { id: string; name: string } | null;
  createdBy?: { id: string; firstName: string; lastName?: string | null } | null;
  items?: OrderItem[];
  payments?: OrderPayment[];
  statusHistory?: OrderStatusHistory[];
};

const pageSize = 25;

export function AdminOrdersPage() {
  const { user } = useAuth();
  const showBranchFilter = canSwitchBranch(user);

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [branchId, setBranchId] = useState("");
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!showBranchFilter) {
      return;
    }

    void apiFetch<Branch[]>("/branches")
      .then(setBranches)
      .catch(() => {
        // Filial ro'yxati ixtiyoriy — buyurtmalar baribir yuklanadi.
      });
  }, [showBranchFilter]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");

    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String(offset),
    });

    if (status) params.set("status", status);
    if (type) params.set("type", type);
    if (paymentStatus) params.set("paymentStatus", paymentStatus);
    if (branchId) params.set("branchId", branchId);

    try {
      setOrders(await apiFetch<AdminOrder[]>(`/orders?${params.toString()}`));
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      setError(caught instanceof Error ? caught.message : "Buyurtmalarni yuklab bo'lmadi.");
    } finally {
      setIsLoading(false);
    }
  }, [branchId, offset, paymentStatus, status, type]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Filtr o'zgarganda birinchi sahifaga qaytamiz. */
  function changeFilter(apply: () => void): void {
    apply();
    setOffset(0);
  }

  const columns: DataTableColumn<AdminOrder>[] = [
    {
      key: "order",
      header: "Buyurtma",
      primary: true,
      render: (order) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-mz-text">{order.orderNumber}</p>
          <p className="truncate text-xs text-mz-text-muted">
            {formatDateTime(order.createdAt)} · {orderSourceLabels[order.source]}
          </p>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Mijoz",
      render: (order) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-mz-text">{order.customerName ?? "—"}</p>
          <p className="truncate text-xs text-mz-text-muted">{maskPhone(order.customerPhone)}</p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Tur",
      hideOnMobile: true,
      render: (order) => orderTypeLabels[order.type],
    },
    {
      key: "status",
      header: "Holat",
      render: (order) => (
        <Badge tone={orderStatusTone(order.status)} withDot>
          {orderStatusLabels[order.status]}
        </Badge>
      ),
    },
    {
      key: "payment",
      header: "To'lov",
      render: (order) => (
        <Badge tone={paymentStatusTone(order.paymentStatus)}>
          {paymentStatusLabels[order.paymentStatus]}
        </Badge>
      ),
    },
    {
      key: "total",
      header: "Summa",
      align: "right",
      render: (order) => (
        <span className="font-semibold text-mz-text">{formatMoney(order.total)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (order) => (
        <ButtonLink href={`/admin/orders/${order.id}`} size="sm" variant="ghost">
          Ochish
        </ButtonLink>
      ),
    },
  ];

  return (
    <div className="grid gap-5">
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      <Card>
        <FilterBar>
          <div className="w-44">
            <Select
              aria-label="Holat bo'yicha filtr"
              value={status}
              onChange={(event) => changeFilter(() => setStatus(event.target.value))}
            >
              <option value="">Barcha holatlar</option>
              {Object.entries(orderStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <div className="w-40">
            <Select
              aria-label="Tur bo'yicha filtr"
              value={type}
              onChange={(event) => changeFilter(() => setType(event.target.value))}
            >
              <option value="">Barcha turlar</option>
              {Object.entries(orderTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <div className="w-44">
            <Select
              aria-label="To'lov holati bo'yicha filtr"
              value={paymentStatus}
              onChange={(event) => changeFilter(() => setPaymentStatus(event.target.value))}
            >
              <option value="">Barcha to'lovlar</option>
              {Object.entries(paymentStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          {/*
           * Filial tanlagichi FAQAT global scope rollar uchun.
           * Branch-scoped rol boshqa filialga o'ta olmaydi (RBAC core_rules).
           */}
          {showBranchFilter ? (
            <div className="w-56">
              <Select
                aria-label="Filial bo'yicha filtr"
                value={branchId}
                onChange={(event) => changeFilter(() => setBranchId(event.target.value))}
              >
                <option value="">Barcha filiallar</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
        </FilterBar>

        <DataTable
          caption="Buyurtmalar ro'yxati"
          columns={columns}
          emptyDescription="Filtrni o'zgartirib ko'ring yoki boshqa sahifaga o'ting."
          emptyTitle="Buyurtma topilmadi"
          getRowKey={(order) => order.id}
          isLoading={isLoading}
          rows={orders}
        />

        {/*
         * Backend jami sonni qaytarmaydi, shuning uchun sahifa raqamlari emas,
         * oldinga/orqaga navigatsiya ishlatiladi.
         */}
        <div className="flex items-center justify-between gap-3 border-t border-mz-border px-4 py-3">
          <p className="text-xs text-mz-text-muted">
            {offset + 1}–{offset + orders.length}-buyurtma
          </p>
          <div className="flex gap-2">
            <Button
              disabled={offset === 0 || isLoading}
              onClick={() => setOffset((current) => Math.max(0, current - pageSize))}
              size="sm"
              variant="ghost"
            >
              Oldingi
            </Button>
            <Button
              disabled={orders.length < pageSize || isLoading}
              onClick={() => setOffset((current) => current + pageSize)}
              size="sm"
              variant="ghost"
            >
              Keyingi
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function AdminOrderDetail({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      setOrder(await apiFetch<AdminOrder>(`/orders/${orderId}`));
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      setError(caught instanceof Error ? caught.message : "Buyurtmani yuklab bo'lmadi.");
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) {
    return <SkeletonRows rows={8} />;
  }

  if (error || !order) {
    return <ErrorState message={error || "Buyurtma topilmadi."} onRetry={() => void load()} />;
  }

  const itemColumns: DataTableColumn<OrderItem>[] = [
    {
      key: "product",
      header: "Mahsulot",
      primary: true,
      render: (item) => (
        <div className="min-w-0">
          <p className="truncate text-mz-text">
            {item.productName}
            {item.variantName ? ` · ${item.variantName}` : ""}
          </p>
          {item.notes ? (
            <p className="truncate text-xs text-mz-text-muted">{item.notes}</p>
          ) : null}
        </div>
      ),
    },
    { key: "qty", header: "Soni", align: "right", render: (item) => item.quantity },
    {
      key: "unit",
      header: "Narx",
      align: "right",
      hideOnMobile: true,
      render: (item) => formatMoney(item.unitPrice),
    },
    {
      key: "total",
      header: "Jami",
      align: "right",
      render: (item) => (
        <span className="font-semibold text-mz-text">{formatMoney(item.totalPrice)}</span>
      ),
    },
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="grid gap-5">
        <Card>
          <CardHeader
            description={`${orderSourceLabels[order.source]} · ${orderTypeLabels[order.type]}`}
            title={order.orderNumber}
          />
          <CardBody className="flex flex-wrap gap-2">
            <Badge tone={orderStatusTone(order.status)} withDot>
              {orderStatusLabels[order.status]}
            </Badge>
            <Badge tone={paymentStatusTone(order.paymentStatus)}>
              {paymentStatusLabels[order.paymentStatus]}
            </Badge>
            {order.table ? <Badge tone="neutral">{order.table.name}</Badge> : null}
            {order.branch ? <Badge tone="neutral">{order.branch.name}</Badge> : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Tarkib" />
          <DataTable
            caption="Buyurtma tarkibi"
            columns={itemColumns}
            emptyTitle="Buyurtmada mahsulot yo'q"
            getRowKey={(item) => item.id}
            rows={order.items ?? []}
          />
        </Card>

        {order.statusHistory && order.statusHistory.length > 0 ? (
          <Card>
            <CardHeader title="Holat tarixi" />
            <CardBody>
              <ol className="grid gap-2">
                {order.statusHistory.map((entry) => (
                  <li className="flex flex-wrap items-center gap-2 text-sm" key={entry.id}>
                    <Badge tone={orderStatusTone(entry.toStatus)}>
                      {orderStatusLabels[entry.toStatus]}
                    </Badge>
                    <span className="text-xs text-mz-text-muted">
                      {formatDateTime(entry.createdAt)}
                    </span>
                    {entry.reason ? (
                      <span className="text-xs text-mz-text-faint">{entry.reason}</span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        ) : null}
      </div>

      <aside className="grid content-start gap-5">
        <Card>
          <CardHeader title="Hisob" />
          <CardBody className="grid gap-2 text-sm">
            <SummaryRow label="Oraliq summa" value={formatMoney(order.subtotal)} />
            {Number(order.discountTotal) > 0 ? (
              <SummaryRow label="Chegirma" value={`− ${formatMoney(order.discountTotal)}`} />
            ) : null}
            {Number(order.deliveryFeeTotal) > 0 ? (
              <SummaryRow label="Yetkazib berish" value={formatMoney(order.deliveryFeeTotal)} />
            ) : null}
            <div className="mt-1 flex items-center justify-between border-t border-mz-border pt-2">
              <span className="font-semibold text-mz-text">Jami</span>
              <span className="text-lg font-bold text-mz-text">{formatMoney(order.total)}</span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Mijoz" />
          <CardBody className="grid gap-2 text-sm">
            <SummaryRow label="Ism" value={order.customerName ?? "—"} />
            {/* Detal sahifasida to'liq raqam — operatorga qo'ng'iroq qilish uchun kerak. */}
            <SummaryRow label="Telefon" value={order.customerPhone ?? "—"} />
            {order.deliveryAddress ? (
              <SummaryRow label="Manzil" value={order.deliveryAddress} />
            ) : null}
            {order.notes ? <SummaryRow label="Izoh" value={order.notes} /> : null}
          </CardBody>
        </Card>

        {order.payments && order.payments.length > 0 ? (
          <Card>
            <CardHeader title="To'lovlar" />
            <CardBody className="grid gap-3 text-sm">
              {order.payments.map((payment) => (
                <div className="grid gap-1" key={payment.id}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-mz-text">
                      {payment.method?.name ?? payment.methodCode ?? "To'lov"}
                    </span>
                    <span className="font-semibold text-mz-text">
                      {formatMoney(payment.amount)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={paymentStatusTone(payment.status)}>
                      {paymentStatusLabels[payment.status]}
                    </Badge>
                    <span className="text-xs text-mz-text-muted">
                      {formatDateTime(payment.paidAt)}
                    </span>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        ) : null}
      </aside>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-mz-text-muted">{label}</span>
      <span className="text-right text-mz-text">{value}</span>
    </div>
  );
}
