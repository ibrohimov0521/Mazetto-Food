"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { useApiResource } from "../../lib/use-api-resource";
import { canSwitchBranch } from "../../lib/admin-nav";
import { hasPermission, type AuthUser } from "../../lib/auth";
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
import { FilterBar, FormField, Select, TextInput } from "../admin-ui/form";
import { Modal } from "../admin-ui/modal";
import { Pagination } from "../admin-ui/pagination";
import { useToast } from "../admin-ui/toast";

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

type BulkOrderStatusResult = {
  requested: number;
  updatedCount: number;
  failedCount: number;
  failed: { id: string; message: string }[];
};

export type AdminOrder = {
  id: string;
  orderNumber: string;
  displayOrderNumber?: string | null;
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
  createdBy?: {
    id: string;
    firstName: string;
    lastName?: string | null;
  } | null;
  items?: OrderItem[];
  payments?: OrderPayment[];
  statusHistory?: OrderStatusHistory[];
};

const pageSize = 25;

export function AdminOrdersPage() {
  const { user } = useAuth();
  const showBranchFilter = canSwitchBranch(user);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [branchId, setBranchId] = useState("");
  const [offset, setOffset] = useState(0);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(
    new Set(),
  );
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<OrderStatus>("CANCELLED");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkOrderStatusResult | null>(
    null,
  );

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

  const {
    data,
    isLoading,
    error: loadError,
    reload: load,
  } = useApiResource(
    () => {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
      });
      if (status) params.set("status", status);
      if (type) params.set("type", type);
      if (paymentStatus) params.set("paymentStatus", paymentStatus);
      if (branchId) params.set("branchId", branchId);
      return apiFetch<AdminOrder[]>(`/orders?${params.toString()}`);
    },
    [branchId, offset, paymentStatus, status, type],
    "Buyurtmalarni yuklab bo'lmadi.",
  );
  const orders = data ?? [];
  /*
   * Yuklash xatosi va AMAL xatosi alohida: ommaviy amal yiqilganda
   * ro'yxat baribir ko'rinib turishi kerak, va keyingi qayta yuklash
   * amal xatosini jimgina o'chirib yubormasligi kerak.
   */
  const [saveError, setSaveError] = useState("");
  const error = saveError || loadError;

  useEffect(() => {
    setSelectedOrderIds((current) => {
      const pageIds = new Set(orders.map((order) => order.id));
      return new Set([...current].filter((id) => pageIds.has(id)));
    });
  }, [orders]);

  const selectedOrders = useMemo(
    () => orders.filter((order) => selectedOrderIds.has(order.id)),
    [orders, selectedOrderIds],
  );
  const selectableOrders = orders.filter(
    (order) => order.status !== "COMPLETED" && order.status !== "CANCELLED",
  );
  const allSelectableChecked =
    selectableOrders.length > 0 &&
    selectableOrders.every((order) => selectedOrderIds.has(order.id));

  function toggleSelected(orderId: string, checked: boolean): void {
    setSelectedOrderIds((current) => {
      const next = new Set(current);
      if (checked) next.add(orderId);
      else next.delete(orderId);
      return next;
    });
    setBulkResult(null);
  }

  function toggleCurrentPage(checked: boolean): void {
    setSelectedOrderIds((current) => {
      const next = new Set(current);
      for (const order of selectableOrders) {
        if (checked) next.add(order.id);
        else next.delete(order.id);
      }
      return next;
    });
    setBulkResult(null);
  }

  async function bulkUpdateSelected(): Promise<void> {
    setBulkBusy(true);
    setSaveError("");
    setBulkResult(null);

    try {
      const result = await apiFetch<BulkOrderStatusResult>(
        "/orders/bulk/status",
        {
          method: "PATCH",
          body: JSON.stringify({
            orderIds: [...selectedOrderIds],
            status: bulkStatus,
            reason: `Admin bulk action: ${bulkStatus} from orders list`,
            confirm: true,
          }),
        },
      );
      setBulkResult(result);
      setBulkConfirmOpen(false);
      setSelectedOrderIds(new Set());
      await load();
    } catch (caught) {
      setSaveError(
        caught instanceof Error ? caught.message : "Ommaviy amal bajarilmadi.",
      );
    } finally {
      setBulkBusy(false);
    }
  }

  /** Filtr o'zgarganda birinchi sahifaga qaytamiz. */
  function changeFilter(apply: () => void): void {
    apply();
    setOffset(0);
  }

  const columns: DataTableColumn<AdminOrder>[] = [
    {
      key: "select",
      header: "Tanlash",
      render: (order) => (
        <input
          aria-label={`${order.displayOrderNumber ?? order.orderNumber} buyurtmani tanlash`}
          checked={selectedOrderIds.has(order.id)}
          disabled={
            order.status === "COMPLETED" || order.status === "CANCELLED"
          }
          onChange={(event) => toggleSelected(order.id, event.target.checked)}
          type="checkbox"
        />
      ),
    },
    {
      key: "order",
      header: "Buyurtma",
      primary: true,
      render: (order) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-mz-text">
            {order.displayOrderNumber ?? order.orderNumber}
          </p>
          <p className="truncate text-xs text-mz-text-muted">
            {formatDateTime(order.createdAt)} ·{" "}
            {orderSourceLabels[order.source]} · {order.orderNumber}
          </p>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Mijoz",
      render: (order) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-mz-text">
            {order.customerName ?? "—"}
          </p>
          <p className="truncate text-xs text-mz-text-muted">
            {maskPhone(order.customerPhone)}
          </p>
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
        <span className="font-semibold text-mz-text">
          {formatMoney(order.total)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (order) => (
        <ButtonLink
          href={`/admin/orders/${order.id}`}
          size="sm"
          variant="ghost"
        >
          Ochish
        </ButtonLink>
      ),
    },
  ];

  return (
    <div className="grid gap-5">
      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}

      <Card>
        <FilterBar>
          <div className="w-44">
            <Select
              aria-label="Holat bo'yicha filtr"
              value={status}
              onChange={(event) =>
                changeFilter(() => setStatus(event.target.value))
              }
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
              onChange={(event) =>
                changeFilter(() => setType(event.target.value))
              }
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
              onChange={(event) =>
                changeFilter(() => setPaymentStatus(event.target.value))
              }
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
                onChange={(event) =>
                  changeFilter(() => setBranchId(event.target.value))
                }
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-mz-border px-4 py-3">
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-mz-text">
            <input
              checked={allSelectableChecked}
              disabled={!selectableOrders.length || isLoading}
              onChange={(event) => toggleCurrentPage(event.target.checked)}
              type="checkbox"
            />
            Joriy sahifadagi amaldagi buyurtmalar
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {bulkResult ? (
              <span className="text-xs font-semibold text-mz-text-muted">
                {bulkResult.updatedCount} ta bajarildi
                {bulkResult.failedCount
                  ? `, ${bulkResult.failedCount} ta o'tmadi`
                  : ""}
              </span>
            ) : null}
            <Select
              aria-label="Tanlangan buyurtmalar uchun ommaviy amal"
              disabled={!selectedOrderIds.size || bulkBusy}
              value={bulkStatus}
              onChange={(event) =>
                setBulkStatus(event.target.value as OrderStatus)
              }
            >
              {changeableStatuses.map((value) => (
                <option key={value} value={value}>
                  {orderStatusLabels[value]}
                </option>
              ))}
            </Select>
            <Button
              disabled={!selectedOrderIds.size || bulkBusy}
              onClick={() => setBulkConfirmOpen(true)}
              size="sm"
              variant={bulkStatus === "CANCELLED" ? "danger" : "primary"}
            >
              Tanlanganlarga qo'llash
            </Button>
          </div>
        </div>

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
        <Pagination
          count={orders.length}
          isLoading={isLoading}
          noun="buyurtma"
          offset={offset}
          onOffsetChange={setOffset}
          pageSize={pageSize}
        />
      </Card>

      <Modal
        description={`Bu amal tanlangan buyurtmalarni "${orderStatusLabels[bulkStatus]}" holatiga o'tkazadi. Davom etish uchun ikkinchi marta tasdiqlang.`}
        footer={
          <>
            <Button
              disabled={bulkBusy}
              onClick={() => setBulkConfirmOpen(false)}
              variant="ghost"
            >
              Ortga
            </Button>
            <Button
              disabled={bulkBusy}
              onClick={() => void bulkUpdateSelected()}
              variant={bulkStatus === "CANCELLED" ? "danger" : "primary"}
            >
              {bulkBusy
                ? "Bajarilmoqda..."
                : `${selectedOrders.length} ta buyurtmaga qo'llash`}
            </Button>
          </>
        }
        isOpen={bulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        title={`Ommaviy amal: ${orderStatusLabels[bulkStatus]}`}
      >
        <div className="grid gap-2 text-sm text-mz-text">
          {selectedOrders.slice(0, 8).map((order) => (
            <div
              className="flex items-center justify-between gap-3 rounded-mz-control border border-mz-border bg-mz-surface-sunken px-3 py-2"
              key={order.id}
            >
              <span className="font-semibold">
                {order.displayOrderNumber ?? order.orderNumber}
              </span>
              <span className="text-mz-text-muted">
                {formatMoney(order.total)}
              </span>
            </div>
          ))}
          {selectedOrders.length > 8 ? (
            <p className="text-xs text-mz-text-muted">
              Yana {selectedOrders.length - 8} ta buyurtma tanlangan.
            </p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}

/*
 * Holat o'zgartirish uchun ruxsat.
 *
 * `PATCH /orders/:id/status` `ORDER_UPDATE` emas, `ORDER_SEND_KITCHEN`
 * talab qiladi va bundan tashqari `orders.service.ts` ikki shart qo'yadi:
 * chaqiruvchi xodim bo'lishi va o'sha buyurtma FILIALIDA faol bo'lishi kerak
 * (`requireEmployee` + `assertEmployeeInBranch`). Super-admin uchun ham
 * istisno yo'q.
 *
 * Shuning uchun bu yerda tugmalarni ko'rsatib, 403 ni kutib o'tirmaymiz —
 * sababi bilan oldindan bloklaymiz.
 */
function statusChangeBlockReason(
  user: AuthUser | null,
  order: AdminOrder,
): string | null {
  if (order.status === "COMPLETED" || order.status === "CANCELLED") {
    return "Yakunlangan va bekor qilingan buyurtma holati o'zgarmaydi.";
  }

  if (!user?.employeeId) {
    return "Holatni faqat xodim hisobiga bog'langan foydalanuvchi o'zgartira oladi.";
  }

  if (!order.branch) {
    return "Buyurtma filiali aniqlanmadi.";
  }

  if (user.branchId !== order.branch.id) {
    return `Holatni ${order.branch.name} filialining faol xodimi o'zgartiradi.`;
  }

  return null;
}

/** Yakuniy holatlar tanlovda ko'rsatilmaydi — ular ortga qaytmaydi. */
const changeableStatuses: OrderStatus[] = [
  "CONFIRMED",
  "PREPARING",
  "READY",
  "SERVED",
  "COMPLETED",
  "CANCELLED",
];

export function AdminOrderDetail({ orderId }: { orderId: string }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [statusReason, setStatusReason] = useState("");
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);
  const [isChanging, setIsChanging] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      setOrder(await apiFetch<AdminOrder>(`/orders/${orderId}`));
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      setError(
        caught instanceof Error
          ? caught.message
          : "Buyurtmani yuklab bo'lmadi.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeStatus(): Promise<void> {
    if (!pendingStatus) {
      return;
    }

    setIsChanging(true);

    try {
      await apiFetch(`/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: pendingStatus,
          ...(statusReason.trim() ? { reason: statusReason.trim() } : {}),
        }),
      });

      showToast("Buyurtma holati yangilandi.", "success");
      setPendingStatus(null);
      setStatusReason("");
      await load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      showToast(
        caught instanceof Error
          ? caught.message
          : "Holatni o'zgartirib bo'lmadi.",
        "danger",
      );
    } finally {
      setIsChanging(false);
    }
  }

  if (isLoading) {
    return <SkeletonRows rows={8} />;
  }

  if (error || !order) {
    return (
      <ErrorState
        message={error || "Buyurtma topilmadi."}
        onRetry={() => void load()}
      />
    );
  }

  const statusBlockReason = statusChangeBlockReason(user, order);

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
    {
      key: "qty",
      header: "Soni",
      align: "right",
      render: (item) => item.quantity,
    },
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
        <span className="font-semibold text-mz-text">
          {formatMoney(item.totalPrice)}
        </span>
      ),
    },
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="grid gap-5">
        <Card>
          <CardHeader
            description={`${orderSourceLabels[order.source]} · ${orderTypeLabels[order.type]}`}
            title={
              order.displayOrderNumber
                ? `${order.displayOrderNumber} · ${order.orderNumber}`
                : order.orderNumber
            }
          />
          <CardBody className="flex flex-wrap gap-2">
            <Badge tone={orderStatusTone(order.status)} withDot>
              {orderStatusLabels[order.status]}
            </Badge>
            <Badge tone={paymentStatusTone(order.paymentStatus)}>
              {paymentStatusLabels[order.paymentStatus]}
            </Badge>
            {order.table ? (
              <Badge tone="neutral">{order.table.name}</Badge>
            ) : null}
            {order.branch ? (
              <Badge tone="neutral">{order.branch.name}</Badge>
            ) : null}
          </CardBody>
        </Card>

        {hasPermission(user, "ORDER_SEND_KITCHEN") ? (
          <Card>
            <CardHeader
              description="O'zgarish tarixga yoziladi va oshxonaga yetkaziladi"
              title="Holatni o'zgartirish"
            />
            <CardBody>
              {statusBlockReason ? (
                <p className="text-sm text-mz-text-muted">
                  {statusBlockReason}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {changeableStatuses
                    .filter((status) => status !== order.status)
                    .map((status) => (
                      <Button
                        key={status}
                        onClick={() => setPendingStatus(status)}
                        size="sm"
                        variant={status === "CANCELLED" ? "danger" : "ghost"}
                      >
                        {orderStatusLabels[status]}
                      </Button>
                    ))}
                </div>
              )}
            </CardBody>
          </Card>
        ) : null}

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
                  <li
                    className="flex flex-wrap items-center gap-2 text-sm"
                    key={entry.id}
                  >
                    <Badge tone={orderStatusTone(entry.toStatus)}>
                      {orderStatusLabels[entry.toStatus]}
                    </Badge>
                    <span className="text-xs text-mz-text-muted">
                      {formatDateTime(entry.createdAt)}
                    </span>
                    {entry.reason ? (
                      <span className="text-xs text-mz-text-faint">
                        {entry.reason}
                      </span>
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
            <SummaryRow
              label="Oraliq summa"
              value={formatMoney(order.subtotal)}
            />
            {Number(order.discountTotal) > 0 ? (
              <SummaryRow
                label="Chegirma"
                value={`− ${formatMoney(order.discountTotal)}`}
              />
            ) : null}
            {Number(order.deliveryFeeTotal) > 0 ? (
              <SummaryRow
                label="Yetkazib berish"
                value={formatMoney(order.deliveryFeeTotal)}
              />
            ) : null}
            <div className="mt-1 flex items-center justify-between border-t border-mz-border pt-2">
              <span className="font-semibold text-mz-text">Jami</span>
              <span className="text-lg font-bold text-mz-text">
                {formatMoney(order.total)}
              </span>
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
            {order.notes ? (
              <SummaryRow label="Izoh" value={order.notes} />
            ) : null}
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

      <Modal
        description="Sabab ixtiyoriy, lekin u buyurtma tarixida qoladi."
        footer={
          <>
            <Button onClick={() => setPendingStatus(null)} variant="ghost">
              Bekor qilish
            </Button>
            <Button
              disabled={isChanging}
              onClick={() => void changeStatus()}
              variant={pendingStatus === "CANCELLED" ? "danger" : "primary"}
            >
              {isChanging ? "Yuborilmoqda…" : "Tasdiqlash"}
            </Button>
          </>
        }
        isOpen={pendingStatus !== null}
        onClose={() => setPendingStatus(null)}
        title={
          pendingStatus
            ? `${order.orderNumber} → ${orderStatusLabels[pendingStatus]}`
            : "Holatni o'zgartirish"
        }
      >
        <FormField label="Sabab">
          {(props) => (
            <TextInput
              {...props}
              onChange={(event) => setStatusReason(event.target.value)}
              placeholder="Masalan: mijoz bekor qildi"
              value={statusReason}
            />
          )}
        </FormField>
      </Modal>
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
