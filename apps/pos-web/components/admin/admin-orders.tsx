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
import {
  Checkbox,
  FilterBar,
  FormField,
  Select,
  Textarea,
  TextInput,
} from "../admin-ui/form";
import { Modal } from "../admin-ui/modal";
import { Pagination } from "../admin-ui/pagination";
import { useToast } from "../admin-ui/toast";

/*
 * Admin buyurtmalar moduli.
 *
 * Backend allaqachon tayyor edi (`/orders`, `/orders/:id`), lekin admin panelda
 * ekrani yo'q edi — POS, sayt va Telegram buyurtmalari birga ko'rinmasdi.
 *
 * Ekran O'QIYDI va IKKI xil yozadi:
 *   - ro'yxatda ommaviy holat o'zgartirish (`PATCH /orders/bulk/status`),
 *   - detalda bitta buyurtma holati (`PATCH /orders/:id/status`).
 * Ikkalasi ham `ORDER_SEND_KITCHEN` talab qiladi va serverda qo'shimcha
 * shart bor: chaqiruvchi shu FILIALNING faol xodimi bo'lishi kerak.
 *
 * PUL QAYTARISH (refund/void) bu yerda YO'Q, chunki backendda umuman
 * yo'q: `PosOrderStatus` enum'ida REFUNDED yo'q va `payments` moduli
 * qaytarish endpoint'i bermaydi. Ishlamaydigan tugma qo'yilmadi.
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
  changedByEmployee?: {
    id: string;
    firstName: string;
    lastName?: string | null;
    employeeCode?: string | null;
  } | null;
  changedByUser?: {
    id: string;
    displayName?: string | null;
    email?: string | null;
  } | null;
};

/*
 * Chek ishoratlari. `orderInclude()` (backend) `receipts` ni MAZMUNSIZ
 * qaytaradi — faqat id, raqam va chop etilgani. Shuning uchun bu yerda
 * chekni ko'rsatib bo'lmaydi, unga HAVOLA qo'yiladi: `/pos/receipt/:id`
 * sahifasi allaqachon bor va `GET /receipts/:id` ni o'qiydi.
 */
type OrderReceipt = {
  id: string;
  receiptNumber: string;
  printed: boolean;
  printedAt?: string | null;
  createdAt?: string;
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
  receipts?: OrderReceipt[];
  statusHistory?: OrderStatusHistory[];
};

const pageSize = 25;

/*
 * HOLAT O'TISHLARI — serverdagi qoidaning aynan o'zi.
 *
 * `orders.service.ts#updateStatus` ikki qoidani qo'yadi:
 *   1. COMPLETED/CANCELLED — yakuniy, o'zgarmaydi;
 *   2. NEW dan faqat CONFIRMED yoki CANCELLED ga o'tiladi
 *      ("Order must be confirmed before moving to preparation...").
 * Qolgan holatlarda server har qanday oldinga o'tishni qabul qiladi,
 * lekin UI oshxona oqimini buzmaydi: har holatdan KEYINGI qadam va
 * bekor qilish taklif qilinadi.
 *
 * Ilgari bu yerda oltita maqsad bir qatorda, joriy holatga qaramay
 * ko'rsatilardi — ya'ni NEW → SERVED tugmasi bosilardi va server 400
 * qaytarardi. Mumkin bo'lmagan tugmani ko'rsatmaslik eng arzon tuzatish.
 */
const orderStatusFlow: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["SERVED", "COMPLETED", "CANCELLED"],
  SERVED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function nextOrderStatuses(current: OrderStatus): OrderStatus[] {
  return orderStatusFlow[current] ?? [];
}

/** CANCELLED uchun sabab MAJBURIY — u buyurtma tarixiga yoziladi. */
function statusNeedsReason(status: OrderStatus | null): boolean {
  return status === "CANCELLED";
}

export function AdminOrdersPage() {
  const { user } = useAuth();
  const showBranchFilter = canSwitchBranch(user);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [branchId, setBranchId] = useState("");
  /*
   * QIDIRUV va SANA ORALIG'I.
   *
   * Ilgari bu ekranda erkin qidiruv umuman yo'q edi: aniq buyurtmani
   * topish uchun 25 tadan varaqlash kerak bo'lardi. Server tomonida
   * `buildOrderSearchWhere` allaqachon buyurtma raqami, mijoz
   * ismi/telefoni, manzil va taom nomi bo'yicha qidiradi.
   *
   * `search` kiritilayotganda, `appliedSearch` esa so'rovda ishlatiladi:
   * har harf uchun so'rov yubormaslik uchun 400 ms kechiktiriladi.
   */
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(
    new Set(),
  );
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<OrderStatus>("CANCELLED");
  const [bulkReason, setBulkReason] = useState("");
  const [bulkReasonError, setBulkReasonError] = useState("");
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch(search.trim());
      setOffset(0);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [search]);

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
      if (appliedSearch) params.set("search", appliedSearch);
      /*
       * Sana maydoni `YYYY-MM-DD` beradi. Boshi kunning boshidan,
       * oxiri kunning OXIRIGA qadar olinadi — aks holda "to" sifatida
       * tanlangan kun butunlay tushib qolardi.
       */
      if (from) params.set("from", `${from}T00:00:00.000Z`);
      if (to) params.set("to", `${to}T23:59:59.999Z`);
      return apiFetch<AdminOrder[]>(`/orders?${params.toString()}`);
    },
    [appliedSearch, branchId, from, offset, paymentStatus, status, to, type],
    "Buyurtmalarni yuklab bo'lmadi.",
  );
  // `data` hali kelmagan yoki xato bo'lgan paytda yangi `[]` yaratish
  // pastdagi selection-effect'ni har renderda qayta ishga tushirardi.
  const orders = useMemo(() => data ?? [], [data]);
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
      const next = new Set([...current].filter((id) => pageIds.has(id)));

      return next.size === current.size ? current : next;
    });
  }, [orders]);

  const selectedOrders = useMemo(
    () => orders.filter((order) => selectedOrderIds.has(order.id)),
    [orders, selectedOrderIds],
  );
  const selectableOrders = orders.filter(
    (order) => nextOrderStatuses(order.status).length > 0,
  );
  const allSelectableChecked =
    selectableOrders.length > 0 &&
    selectableOrders.every((order) => selectedOrderIds.has(order.id));

  /*
   * OMMAVIY AMAL uchun ruxsat etilgan maqsadlar — tanlangan BARCHA
   * buyurtmalar uchun bir vaqtda mumkin bo'lgan holatlar kesishmasi.
   *
   * Ilgari ro'yxat qat'iy oltita edi: NEW va READY buyurtmalarni birga
   * tanlab "Berildi" ni qo'llash mumkin bo'lardi, server esa NEW larni
   * rad etardi va operator nima uchunligini bilmasdi.
   */
  const bulkStatusOptions = useMemo(() => {
    if (!selectedOrders.length) {
      return [] as OrderStatus[];
    }

    return selectedOrders
      .map((order) => nextOrderStatuses(order.status))
      .reduce((shared, allowed) =>
        shared.filter((status) => allowed.includes(status)),
      );
  }, [selectedOrders]);

  useEffect(() => {
    if (bulkStatusOptions.length && !bulkStatusOptions.includes(bulkStatus)) {
      setBulkStatus(bulkStatusOptions[0]!);
    }
  }, [bulkStatus, bulkStatusOptions]);

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
    const reason = bulkReason.trim();

    /*
     * Sabab bekor qilishda MAJBURIY: u `orderStatusHistory.reason` ga
     * yoziladi va keyin "nega bekor qilingan" savoliga yagona javob
     * bo'lib qoladi. Ilgari bu yerga inglizcha qat'iy matn
     * ("Admin bulk action: ...") yozilardi — tarix o'zbekcha panelda
     * inglizcha to'lib ketardi va hech qanday ma'lumot bermasdi.
     */
    if (statusNeedsReason(bulkStatus) && !reason) {
      setBulkReasonError("Bekor qilish sababini yozing.");
      return;
    }

    setBulkReasonError("");
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
            reason:
              reason ||
              `Ommaviy amal: ${orderStatusLabels[bulkStatus]} (admin ro'yxati)`,
            confirm: true,
          }),
        },
      );
      setBulkResult(result);
      setBulkConfirmOpen(false);
      setBulkReason("");
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
        <SelectRowCheckbox
          checked={selectedOrderIds.has(order.id)}
          disabled={!nextOrderStatuses(order.status).length}
          label={`${order.displayOrderNumber ?? order.orderNumber} buyurtmani tanlash`}
          onChange={(checked) => toggleSelected(order.id, checked)}
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
        {/*
         * Filtrlarda KO'RINADIGAN yorliq bor.
         *
         * Ilgari bu yerda faqat `aria-label` va `placeholder` turardi:
         * matn terilgach placeholder yo'qoladi va maydonning nima ekani
         * bilinmasdi, ikkita sana maydoni esa bir-biridan farq qilmasdi.
         */}
        <FilterBar>
          <div className="min-w-56 flex-1">
            <FormField label="Qidirish">
              {(props) => (
                <TextInput
                  {...props}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Raqam, ism, telefon, manzil yoki taom"
                  value={search}
                />
              )}
            </FormField>
          </div>

          <div className="w-40">
            <FormField label="Sanadan">
              {(props) => (
                <TextInput
                  {...props}
                  max={to || undefined}
                  onChange={(event) =>
                    changeFilter(() => setFrom(event.target.value))
                  }
                  type="date"
                  value={from}
                />
              )}
            </FormField>
          </div>

          <div className="w-40">
            <FormField label="Sanagacha">
              {(props) => (
                <TextInput
                  {...props}
                  min={from || undefined}
                  onChange={(event) =>
                    changeFilter(() => setTo(event.target.value))
                  }
                  type="date"
                  value={to}
                />
              )}
            </FormField>
          </div>

          <div className="w-44">
            <FormField label="Holat">
              {(props) => (
                <Select
                  {...props}
                  onChange={(event) =>
                    changeFilter(() => setStatus(event.target.value))
                  }
                  value={status}
                >
                  <option value="">Barcha holatlar</option>
                  {Object.entries(orderStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>

          <div className="w-40">
            <FormField label="Tur">
              {(props) => (
                <Select
                  {...props}
                  onChange={(event) =>
                    changeFilter(() => setType(event.target.value))
                  }
                  value={type}
                >
                  <option value="">Barcha turlar</option>
                  {Object.entries(orderTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>

          <div className="w-44">
            <FormField label="To'lov holati">
              {(props) => (
                <Select
                  {...props}
                  onChange={(event) =>
                    changeFilter(() => setPaymentStatus(event.target.value))
                  }
                  value={paymentStatus}
                >
                  <option value="">Barcha to'lovlar</option>
                  {Object.entries(paymentStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>

          {/*
           * Filial tanlagichi FAQAT global scope rollar uchun.
           * Branch-scoped rol boshqa filialga o'ta olmaydi (RBAC core_rules).
           */}
          {showBranchFilter ? (
            <div className="w-56">
              <FormField label="Filial">
                {(props) => (
                  <Select
                    {...props}
                    onChange={(event) =>
                      changeFilter(() => setBranchId(event.target.value))
                    }
                    value={branchId}
                  >
                    <option value="">Barcha filiallar</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            </div>
          ) : null}
        </FilterBar>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-mz-border px-4 py-2">
          <Checkbox
            checked={allSelectableChecked}
            disabled={!selectableOrders.length || isLoading}
            label="Joriy sahifadagi amaldagi buyurtmalar"
            onChange={(checked) => toggleCurrentPage(checked)}
          />
          {bulkResult ? (
            <span className="text-[13px] font-semibold text-mz-text-muted">
              {bulkResult.updatedCount} ta bajarildi
              {bulkResult.failedCount
                ? `, ${bulkResult.failedCount} ta o'tmadi`
                : ""}
            </span>
          ) : null}
        </div>

        {/*
         * OMMAVIY AMAL PANELI faqat tanlov bo'lganda ko'rinadi.
         *
         * Ilgari u doim turardi — o'chirilgan tanlagich va o'chirilgan
         * tugma bilan, ya'ni ekranning doimiy qismi hech qachon
         * ishlamaydigan boshqaruvdan iborat edi.
         */}
        {selectedOrders.length ? (
          <div className="flex flex-wrap items-end justify-between gap-3 border-t border-mz-border bg-mz-info-bg px-4 py-3">
            <p className="text-[13px] font-semibold text-mz-text">
              {selectedOrders.length} ta buyurtma tanlandi
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-52">
                <Select
                  aria-label="Tanlangan buyurtmalar uchun ommaviy amal"
                  disabled={bulkBusy || !bulkStatusOptions.length}
                  value={bulkStatus}
                  onChange={(event) =>
                    setBulkStatus(event.target.value as OrderStatus)
                  }
                >
                  {bulkStatusOptions.map((value) => (
                    <option key={value} value={value}>
                      {orderStatusLabels[value]}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                disabled={bulkBusy || !bulkStatusOptions.length}
                onClick={() => {
                  setBulkReasonError("");
                  setBulkConfirmOpen(true);
                }}
                variant={bulkStatus === "CANCELLED" ? "danger" : "primary"}
              >
                Tanlanganlarga qo&apos;llash
              </Button>
            </div>
            {!bulkStatusOptions.length ? (
              <p className="w-full text-[13px] text-mz-text-muted">
                Tanlangan buyurtmalar turli holatlarda — ularning hammasiga
                birdek qo&apos;llanadigan amal yo&apos;q. Tanlovni toraytiring.
              </p>
            ) : null}
          </div>
        ) : null}

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
        dismissOnBackdrop={false}
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
              isLoading={bulkBusy}
              onClick={() => void bulkUpdateSelected()}
              variant={bulkStatus === "CANCELLED" ? "danger" : "primary"}
            >
              {`${selectedOrders.length} ta buyurtmaga qo'llash`}
            </Button>
          </>
        }
        isOpen={bulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        title={`Ommaviy amal: ${orderStatusLabels[bulkStatus]}`}
      >
        <div className="grid gap-3">
          <FormField
            error={bulkReasonError}
            hint="Sabab har bir buyurtmaning holat tarixiga yoziladi."
            label="Sabab"
            required={statusNeedsReason(bulkStatus)}
          >
            {(props) => (
              <Textarea
                {...props}
                onChange={(event) => {
                  setBulkReason(event.target.value);
                  setBulkReasonError("");
                }}
                placeholder="Masalan: mijoz telefon orqali bekor qildi"
                value={bulkReason}
              />
            )}
          </FormField>
        </div>
        <div className="mt-3 grid gap-2 text-sm text-mz-text">
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
function statusActor(entry: OrderStatusHistory): string {
  const employee = entry.changedByEmployee;
  if (employee) {
    return ["employee:", employee.firstName, employee.lastName]
      .filter(Boolean)
      .join(" ");
  }

  return entry.changedByUser?.displayName
    ? "user: " + entry.changedByUser.displayName
    : "system";
}

export function statusChangeBlockReason(
  user: AuthUser | null,
  order: { status: OrderStatus; branch?: { id: string; name: string } | null },
): string | null {
  if (!nextOrderStatuses(order.status).length) {
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

/**
 * Qator ichidagi tanlash katakchasi.
 *
 * `admin-ui/form.tsx` dagi `Checkbox` yorliqni KO'RINADIGAN qilib
 * chiqaradi, jadval katagida esa yorliq matni ("ORD-123 tanlash")
 * "Buyurtma" ustunini takrorlardi. Shuning uchun bu yerda shu
 * primitivning o'lchamlari (20px kvadrat, 44px nishon) saqlanib,
 * yorliq faqat ekran o'quvchi uchun qoldirildi. Umumiy primitiv
 * o'zgartirilmadi — u boshqa muallifning fayli.
 */
function SelectRowCheckbox({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-mz-control ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      }`}
    >
      <input
        checked={checked}
        className="h-5 w-5 shrink-0 rounded-sm border-mz-border-strong accent-mz-info"
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span className="sr-only">{label}</span>
    </label>
  );
}

export function AdminOrderDetail({ orderId }: { orderId: string }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [statusReason, setStatusReason] = useState("");
  const [statusReasonError, setStatusReasonError] = useState("");
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

    const reason = statusReason.trim();

    if (statusNeedsReason(pendingStatus) && !reason) {
      setStatusReasonError("Bekor qilish sababini yozing.");
      return;
    }

    setStatusReasonError("");
    setIsChanging(true);

    try {
      await apiFetch(`/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: pendingStatus,
          ...(reason ? { reason } : {}),
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
  const allowedStatuses = nextOrderStatuses(order.status);
  /*
   * Chek FAQAT to'langan buyurtmada yaratiladi (`receipts` bo'sh bo'lsa
   * chek ham yo'q). `GET /receipts/:id` `RECEIPT_VIEW` talab qiladi,
   * shuning uchun ruxsati yo'q foydalanuvchiga havola KO'RSATILMAYDI —
   * u bosib 403 olmasin.
   */
  const receipt = order.receipts?.[0] ?? null;
  const canSeeReceipt = hasPermission(user, "RECEIPT_VIEW");

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
          {/*
           * CHEK HAVOLASI.
           *
           * Ilgari detal sahifasidan chekka yo'l yo'q edi, holbuki
           * `orderInclude()` chek ishoratlarini allaqachon qaytaradi va
           * `/pos/receipt/:id` sahifasi (chop etish tugmasi bilan) bor.
           * Operator chekni qayta chiqarish uchun POS ni ochishga majbur
           * bo'lardi.
           */}
          {receipt ? (
            <CardBody className="flex flex-wrap items-center gap-3 border-t border-mz-border">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-mz-text">
                  Chek {receipt.receiptNumber}
                </p>
                <p className="text-xs text-mz-text-muted">
                  {receipt.printed
                    ? `Chop etilgan · ${formatDateTime(receipt.printedAt)}`
                    : "Hali chop etilmagan"}
                </p>
              </div>
              {canSeeReceipt ? (
                <ButtonLink
                  className="ml-auto"
                  href={`/pos/receipt/${receipt.id}`}
                  size="sm"
                  variant="ghost"
                >
                  Chekni ochish
                </ButtonLink>
              ) : (
                <p className="ml-auto text-xs text-mz-text-muted">
                  Chekni ko&apos;rish uchun ruxsat yo&apos;q.
                </p>
              )}
            </CardBody>
          ) : null}
        </Card>

        {hasPermission(user, "ORDER_SEND_KITCHEN") ? (
          <Card>
            <CardHeader
              description="Faqat joriy holatdan mumkin bo'lgan qadamlar ko'rsatiladi. O'zgarish tarixga yoziladi va oshxonaga yetkaziladi."
              title="Holatni o'zgartirish"
            />
            <CardBody>
              {statusBlockReason ? (
                <p className="text-sm text-mz-text-muted">
                  {statusBlockReason}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {allowedStatuses.map((status) => (
                    <Button
                      key={status}
                      onClick={() => {
                        setStatusReasonError("");
                        setPendingStatus(status);
                      }}
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
                    <span className="text-xs text-mz-text-muted">
                      {statusActor(entry)}
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
        description={
          statusNeedsReason(pendingStatus)
            ? "Bekor qilish qaytarilmaydi. Sabab majburiy va buyurtma tarixida qoladi."
            : "Sabab ixtiyoriy, lekin u buyurtma tarixida qoladi."
        }
        dismissOnBackdrop={false}
        footer={
          <>
            <Button onClick={() => setPendingStatus(null)} variant="ghost">
              Ortga
            </Button>
            <Button
              isLoading={isChanging}
              onClick={() => void changeStatus()}
              variant={pendingStatus === "CANCELLED" ? "danger" : "primary"}
            >
              {pendingStatus === "CANCELLED"
                ? "Buyurtmani bekor qilish"
                : "Tasdiqlash"}
            </Button>
          </>
        }
        isOpen={pendingStatus !== null}
        onClose={() => setPendingStatus(null)}
        title={
          pendingStatus
            ? `${order.displayOrderNumber ?? order.orderNumber} → ${orderStatusLabels[pendingStatus]}`
            : "Holatni o'zgartirish"
        }
      >
        <FormField
          error={statusReasonError}
          label="Sabab"
          required={statusNeedsReason(pendingStatus)}
        >
          {(props) => (
            <Textarea
              {...props}
              onChange={(event) => {
                setStatusReason(event.target.value);
                setStatusReasonError("");
              }}
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
