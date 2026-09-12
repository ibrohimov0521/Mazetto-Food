"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { useApiResource } from "../../lib/use-api-resource";
import { canSwitchBranch } from "../../lib/admin-nav";
import { hasPermission } from "../../lib/auth";
import {
  formatDateTime,
  formatMoney,
  maskPhone,
  orderStatusLabels,
  orderStatusTone,
  type OrderStatus,
} from "../../lib/order-display";
import { useAuth } from "../auth/auth-provider";
import { Badge } from "../admin-ui/badge";
import { Button, ButtonLink } from "../admin-ui/button";
import { Card, CardHeader } from "../admin-ui/card";
import { DataTable, type DataTableColumn } from "../admin-ui/data-table";
import { ErrorState } from "../admin-ui/feedback";
import {
  FilterBar,
  FormField,
  Select,
  Textarea,
  TextInput,
} from "../admin-ui/form";
import { Modal } from "../admin-ui/modal";
import { Pagination } from "../admin-ui/pagination";
import { InfoBox, StatGrid } from "../admin-ui/stat-box";
import { useToast } from "../admin-ui/toast";
import { nextOrderStatuses, statusChangeBlockReason } from "./admin-orders";

/*
 * Sayt va Telegram orqali kelgan mijoz buyurtmalari.
 *
 * NIMA O'ZGARDI. Bu ekran butunlay O'QISH uchun edi: online buyurtma
 * tushib turardi, lekin operator uni shu ekrandan tasdiqlay ham,
 * bekor qila ham, kuryerga biriktira ham olmasdi — u POS yoki
 * `/admin/couriers` ga o'tishga majbur edi. Online buyurtma esa
 * daromad oqimi, ya'ni eng ko'p amal talab qiladigan ro'yxat.
 *
 * QAYSI ENDPOINT ISHLATILADI (yangisi YOZILMADI):
 *   - tasdiqlash/bekor qilish → `PATCH /orders/:orderId/status`
 *     (`ORDER_SEND_KITCHEN`; server chaqiruvchining SHU FILIALDA faol
 *      xodim bo'lishini talab qiladi);
 *   - kuryer biriktirish → `PATCH /courier/orders/:customerOrderId/assign`
 *     (`COURIER_MANAGE`, faqat DELIVERY);
 *   - kuryerlar ro'yxati → `GET /couriers`.
 *
 * `PATCH /courier/orders/:id/status` ATAYLAB ishlatilmaydi: u
 * `COURIER_DELIVERY_UPDATE` talab qiladi va buyurtma boshqa kuryerga
 * biriktirilgan bo'lsa 403 qaytaradi — ya'ni u kuryerning o'zi uchun,
 * admin uchun emas.
 *
 * SAHIFALASH: `/online-orders` `limit`/`offset` qabul qiladi. Filial
 * filtri serverda; qidiruv va holat filtri esa BRAUZERDA — DTO'da
 * `search`/`status` maydonlari bo'lsa ham `listOnlineOrders` ularni
 * o'qimaydi. Yorliq buni ochiq aytadi.
 */

const pageSize = 50;

type Branch = { id: string; code: string; name: string };

type Courier = {
  id: string;
  firstName: string;
  lastName?: string | null;
  employeeCode: string;
  branch?: { id: string; name: string } | null;
  activeDeliveries: number;
};

type CustomerOrder = {
  id: string;
  type: "DELIVERY" | "PICKUP";
  status: OrderStatus | "READY";
  paymentMethod?: string | null;
  deliveryAddress?: string | null;
  notes?: string | null;
  createdAt: string;
  customer?: { id: string; name: string; phone: string } | null;
  branch?: { id: string; name: string } | null;
  order?: {
    id: string;
    orderNumber: string;
    displayOrderNumber?: string | null;
    status: OrderStatus;
    total: string;
    servedById?: string | null;
  } | null;
};

const customerOrderTypeLabels = {
  DELIVERY: "Yetkazib berish",
  PICKUP: "Olib ketish",
};

/** Ochiq tasdiqlash oynasi: holat o'zgartirish yoki kuryer biriktirish. */
type PendingAction =
  | { kind: "status"; order: CustomerOrder; status: OrderStatus }
  | { kind: "courier"; order: CustomerOrder; employeeId: string };

function courierName(courier: Courier): string {
  return [courier.firstName, courier.lastName].filter(Boolean).join(" ");
}

export function AdminOnlineOrdersPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const showBranchFilter = canSwitchBranch(user);
  const canChangeStatus = hasPermission(user, "ORDER_SEND_KITCHEN");
  const canAssignCourier = hasPermission(user, "COURIER_MANAGE");
  const canOpenOrder = hasPermission(user, "ORDER_VIEW");

  const [branches, setBranches] = useState<Branch[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [branchId, setBranchId] = useState("");
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!showBranchFilter) {
      return;
    }

    void apiFetch<Branch[]>("/branches")
      .then(setBranches)
      .catch(() => {
        // Filial ro'yxati ixtiyoriy.
      });
  }, [showBranchFilter]);

  const {
    data,
    isLoading,
    error,
    reload: load,
  } = useApiResource(
    () => {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
      });

      if (branchId) {
        params.set("branchId", branchId);
      }

      return apiFetch<CustomerOrder[]>(`/online-orders?${params.toString()}`);
    },
    [branchId, offset],
    "Online buyurtmalarni yuklab bo'lmadi.",
  );
  const orders = data ?? [];

  /*
   * Kuryerlar ro'yxati ALOHIDA o'qiladi, buyurtmalar bilan birga emas:
   * ruxsati yo'q foydalanuvchida `GET /couriers` 403 qaytaradi va
   * `Promise.all` ichida u BUTUN ro'yxatni yiqitardi.
   */
  useEffect(() => {
    if (!canAssignCourier) {
      return;
    }

    void apiFetch<Courier[]>("/couriers")
      .then(setCouriers)
      .catch(() => {
        // Kuryerlar ro'yxati ixtiyoriy — buyurtmalar baribir ko'rinadi.
      });
  }, [canAssignCourier]);

  const courierById = useMemo(
    () => new Map(couriers.map((courier) => [courier.id, courier])),
    [couriers],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return orders.filter((item) => {
      const identity = [
        item.order?.orderNumber,
        item.order?.displayOrderNumber,
        item.customer?.name,
        item.customer?.phone,
        item.deliveryAddress,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        (!needle || identity.includes(needle)) &&
        (!status || item.status === status)
      );
    });
  }, [orders, query, status]);

  const stats = useMemo(() => {
    const delivery = orders.filter((item) => item.type === "DELIVERY").length;
    const active = orders.filter(
      (item) => item.status !== "COMPLETED" && item.status !== "CANCELLED",
    ).length;
    const revenue = orders
      .filter((item) => item.order?.status !== "CANCELLED")
      .reduce((sum, item) => sum + Number(item.order?.total ?? 0), 0);

    return { delivery, active, revenue, total: orders.length };
  }, [orders]);

  function openStatusAction(order: CustomerOrder, next: OrderStatus): void {
    setReason("");
    setReasonError("");
    setPending({ kind: "status", order, status: next });
  }

  function openCourierAction(order: CustomerOrder): void {
    setReason("");
    setReasonError("");
    setPending({
      kind: "courier",
      order,
      employeeId: order.order?.servedById ?? "",
    });
  }

  async function submitPending(): Promise<void> {
    if (!pending) {
      return;
    }

    if (pending.kind === "status") {
      const orderId = pending.order.order?.id;

      if (!orderId) {
        setReasonError("Bu online buyurtmaga kassa buyurtmasi bog'lanmagan.");
        return;
      }

      const trimmed = reason.trim();

      /*
       * Bekor qilish MIJOZGA ko'rinadi va qaytarilmaydi, shuning uchun
       * sabab majburiy — u `orderStatusHistory.reason` ga yoziladi.
       */
      if (pending.status === "CANCELLED" && !trimmed) {
        setReasonError("Bekor qilish sababini yozing.");
        return;
      }

      setIsSaving(true);

      try {
        await apiFetch(`/orders/${orderId}/status`, {
          method: "PATCH",
          body: JSON.stringify({
            status: pending.status,
            reason:
              trimmed ||
              `Online buyurtma: ${orderStatusLabels[pending.status]} (admin)`,
          }),
        });
        showToast(
          `Buyurtma ${orderStatusLabels[pending.status].toLowerCase()} holatiga o'tdi.`,
          "success",
        );
        setPending(null);
        load();
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
        setIsSaving(false);
      }

      return;
    }

    setIsSaving(true);

    try {
      await apiFetch(`/courier/orders/${pending.order.id}/assign`, {
        method: "PATCH",
        // Bo'sh qiymat — biriktirishni BEKOR QILISH (`employeeId: null`).
        body: JSON.stringify({ employeeId: pending.employeeId || null }),
      });
      showToast(
        pending.employeeId
          ? "Kuryer biriktirildi."
          : "Biriktirish bekor qilindi.",
        "success",
      );
      setPending(null);
      load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      showToast(
        caught instanceof Error
          ? caught.message
          : "Kuryerni biriktirib bo'lmadi.",
        "danger",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const columns: DataTableColumn<CustomerOrder>[] = [
    {
      key: "order",
      header: "Buyurtma",
      primary: true,
      render: (item) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-mz-text">
            {item.order?.displayOrderNumber ??
              item.order?.orderNumber ??
              "Raqamsiz"}
          </p>
          <p className="truncate text-xs text-mz-text-muted">
            {formatDateTime(item.createdAt)}
            {item.order?.displayOrderNumber
              ? ` · ${item.order.orderNumber}`
              : ""}
          </p>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Mijoz",
      render: (item) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-mz-text">
            {item.customer?.name ?? "—"}
          </p>
          <p className="truncate text-xs text-mz-text-muted">
            {maskPhone(item.customer?.phone)}
          </p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Tur",
      render: (item) => {
        const assigned = item.order?.servedById
          ? courierById.get(item.order.servedById)
          : undefined;

        return (
          <div className="min-w-0">
            <p className="text-sm text-mz-text">
              {customerOrderTypeLabels[item.type]}
            </p>
            {item.type === "DELIVERY" ? (
              <p className="truncate text-xs text-mz-text-muted">
                {assigned
                  ? courierName(assigned)
                  : item.order?.servedById
                    ? "Boshqa filial kuryeri"
                    : "Kuryer biriktirilmagan"}
              </p>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "branch",
      header: "Filial",
      hideOnMobile: true,
      render: (item) => item.branch?.name ?? "—",
    },
    {
      key: "status",
      header: "Holat",
      render: (item) => (
        <Badge tone={orderStatusTone(item.status as OrderStatus)} withDot>
          {orderStatusLabels[item.status as OrderStatus] ?? item.status}
        </Badge>
      ),
    },
    {
      key: "total",
      header: "Summa",
      align: "right",
      render: (item) => (
        <span className="font-semibold text-mz-text">
          {formatMoney(item.order?.total)}
        </span>
      ),
    },
  ];

  /*
   * AMALLAR qatorning o'ng ustunida, `rowActions` orqali: mobil
   * ko'rinishda `DataTable` ularni kartochka oxirida alohida qatorga
   * chiqaradi, ya'ni tugmalar 375px da ham qisilib qolmaydi.
   */
  function rowActions(item: CustomerOrder): React.ReactNode {
    const orderStatus = item.order?.status;
    const blockReason = orderStatus
      ? statusChangeBlockReason(user, {
          status: orderStatus,
          branch: item.branch ?? null,
        })
      : "Bu online buyurtmaga kassa buyurtmasi bog'lanmagan.";
    const allowed = orderStatus ? nextOrderStatuses(orderStatus) : [];
    const canConfirm = allowed.includes("CONFIRMED");
    const canCancel = allowed.includes("CANCELLED");
    const assignable =
      item.type === "DELIVERY" && orderStatus
        ? nextOrderStatuses(orderStatus).length > 0
        : false;

    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canChangeStatus && !blockReason && canConfirm ? (
          <Button
            onClick={() => openStatusAction(item, "CONFIRMED")}
            size="sm"
            variant="secondary"
          >
            Tasdiqlash
          </Button>
        ) : null}

        {canAssignCourier && assignable ? (
          <Button
            onClick={() => openCourierAction(item)}
            size="sm"
            variant="ghost"
          >
            Kuryer
          </Button>
        ) : null}

        {canChangeStatus && !blockReason && canCancel ? (
          <Button
            onClick={() => openStatusAction(item, "CANCELLED")}
            size="sm"
            variant="danger"
          >
            Bekor qilish
          </Button>
        ) : null}

        {canOpenOrder && item.order ? (
          <ButtonLink
            href={`/admin/orders/${item.order.id}`}
            size="sm"
            variant="ghost"
          >
            Ochish
          </ButtonLink>
        ) : null}

        {/*
         * Nima uchun amal yo'qligi AYTILADI — bo'sh katak operatorga
         * "tizim buzuq" degan taassurot berardi.
         */}
        {canChangeStatus && blockReason ? (
          <span className="text-xs text-mz-text-muted">{blockReason}</span>
        ) : null}
      </div>
    );
  }

  const pendingCourierBranchId = pending?.order.branch?.id ?? "";
  /*
   * Faqat SHU FILIAL kuryerlari: `assignCourier` boshqa filial xodimini
   * "Bu xodim shu filialning faol kuryeri emas" xatosi bilan rad etadi.
   */
  const assignableCouriers = couriers.filter(
    (courier) =>
      !pendingCourierBranchId || courier.branch?.id === pendingCourierBranchId,
  );

  return (
    <div className="grid gap-5">
      {error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : null}

      <StatGrid>
        <InfoBox
          icon="globe"
          label="Jami online buyurtma"
          value={`${stats.total} ta`}
        />
        <InfoBox
          icon="clock"
          label="Jarayonda"
          tone="warning"
          value={`${stats.active} ta`}
        />
        <InfoBox
          icon="truck"
          label="Yetkazib berish"
          value={`${stats.delivery} ta`}
        />
        <InfoBox
          icon="wallet"
          label="Umumiy summa"
          tone="brand"
          value={formatMoney(stats.revenue)}
        />
      </StatGrid>

      <Card>
        <CardHeader
          actions={
            <Button
              isLoading={isLoading}
              onClick={() => load()}
              size="sm"
              variant="ghost"
            >
              Yangilash
            </Button>
          }
          description="Tasdiqlash va bekor qilish kassa buyurtmasiga yoziladi; kuryer faqat yetkazish buyurtmasiga biriktiriladi."
          title="Online buyurtmalar"
        />

        <FilterBar>
          <div className="min-w-52 flex-1">
            <FormField
              hint="Server tomonda qidiruv yo'q — faqat shu sahifa ichida."
              label="Qidirish"
            >
              {(props) => (
                <TextInput
                  {...props}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buyurtma raqami, mijoz yoki manzil"
                  value={query}
                />
              )}
            </FormField>
          </div>

          <div className="w-44">
            <FormField label="Holat">
              {(props) => (
                <Select
                  {...props}
                  onChange={(event) => setStatus(event.target.value)}
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

          {showBranchFilter ? (
            <div className="w-56">
              <FormField label="Filial">
                {(props) => (
                  <Select
                    {...props}
                    onChange={(event) => {
                      setBranchId(event.target.value);
                      setOffset(0);
                    }}
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

        <DataTable
          caption="Online buyurtmalar"
          columns={columns}
          emptyDescription={
            query || status
              ? "Qidiruv yoki filtrni o'zgartirib ko'ring."
              : "Sayt va Telegram orqali buyurtma tushganda shu ro'yxatda paydo bo'ladi."
          }
          emptyTitle="Online buyurtma topilmadi"
          getRowKey={(item) => item.id}
          isLoading={isLoading}
          rowActions={rowActions}
          rows={filtered}
        />

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
        description={
          pending?.kind === "status"
            ? pending.status === "CANCELLED"
              ? "Bekor qilish mijozga ko'rinadi va qaytarilmaydi. Sabab majburiy."
              : "Buyurtma tasdiqlanadi va oshxonaga yuboriladi."
            : "Biriktirish kuryerning ekranida darhol ko'rinadi."
        }
        dismissOnBackdrop={false}
        footer={
          <>
            <Button
              disabled={isSaving}
              onClick={() => setPending(null)}
              variant="ghost"
            >
              Ortga
            </Button>
            <Button
              isLoading={isSaving}
              onClick={() => void submitPending()}
              variant={
                pending?.kind === "status" && pending.status === "CANCELLED"
                  ? "danger"
                  : "primary"
              }
            >
              Tasdiqlash
            </Button>
          </>
        }
        isOpen={pending !== null}
        onClose={() => setPending(null)}
        title={
          pending
            ? `${pending.order.order?.displayOrderNumber ?? pending.order.order?.orderNumber ?? "Buyurtma"} · ${
                pending.kind === "status"
                  ? orderStatusLabels[pending.status]
                  : "Kuryer biriktirish"
              }`
            : "Amalni tasdiqlash"
        }
      >
        <div className="grid gap-3">
          <div className="grid gap-1 rounded-mz-control border border-mz-border bg-mz-surface-sunken px-3 py-2 text-[13px]">
            <span className="text-mz-text">
              {pending?.order.customer?.name ?? "Mijoz"} ·{" "}
              {formatMoney(pending?.order.order?.total)}
            </span>
            {pending?.order.deliveryAddress ? (
              <span className="text-mz-text-muted">
                {pending.order.deliveryAddress}
              </span>
            ) : null}
          </div>

          {pending?.kind === "status" ? (
            <FormField
              error={reasonError}
              hint="Sabab buyurtma tarixida qoladi."
              label="Sabab"
              required={pending.status === "CANCELLED"}
            >
              {(props) => (
                <Textarea
                  {...props}
                  onChange={(event) => {
                    setReason(event.target.value);
                    setReasonError("");
                  }}
                  placeholder="Masalan: mijoz telefon orqali bekor qildi"
                  value={reason}
                />
              )}
            </FormField>
          ) : null}

          {pending?.kind === "courier" ? (
            <FormField
              error={reasonError}
              hint="Bo'sh qoldirilsa biriktirish bekor qilinadi va buyurtma yana erkin bo'ladi."
              label="Kuryer"
            >
              {(props) => (
                <Select
                  {...props}
                  onChange={(event) =>
                    setPending({
                      kind: "courier",
                      order: pending.order,
                      employeeId: event.target.value,
                    })
                  }
                  value={pending.employeeId}
                >
                  <option value="">Biriktirilmagan</option>
                  {assignableCouriers.map((courier) => (
                    <option key={courier.id} value={courier.id}>
                      {courierName(courier)}
                      {courier.activeDeliveries
                        ? ` (${courier.activeDeliveries} yo'lda)`
                        : ""}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
