"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useApiResource } from "../../lib/use-api-resource";
import { canSwitchBranch } from "../../lib/admin-nav";
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
import { Card } from "../admin-ui/card";
import { DataTable, type DataTableColumn } from "../admin-ui/data-table";
import { ErrorState } from "../admin-ui/feedback";
import { FilterBar, Select, TextInput } from "../admin-ui/form";
import { Pagination } from "../admin-ui/pagination";
import { InfoBox, StatGrid } from "../admin-ui/stat-box";

/*
 * Sayt va Telegram orqali kelgan mijoz buyurtmalari.
 *
 * Backend `/online-orders` tayyor edi, lekin admin panelda ekrani yo'q edi.
 *
 * SAHIFALASH: `/online-orders` endi `limit`/`offset` qabul qiladi. Filial
 * filtri serverda, qidiruv va holat filtri esa BRAUZERDA — ya'ni faqat joriy
 * sahifa ichida. Server tomonda qidiruv yo'q, shuning uchun yorliq buni
 * ochiq aytadi.
 */

const pageSize = 50;

type Branch = { id: string; code: string; name: string };

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
  } | null;
};

const customerOrderTypeLabels = {
  DELIVERY: "Yetkazib berish",
  PICKUP: "Olib ketish",
};

export function AdminOnlineOrdersPage() {
  const { user } = useAuth();
  const showBranchFilter = canSwitchBranch(user);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");

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
      render: (item) => customerOrderTypeLabels[item.type],
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

  return (
    <div className="grid gap-5">
      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
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
        <FilterBar>
          <div className="min-w-52 flex-1">
            <TextInput
              aria-label="Shu sahifada buyurtma qidirish"
              placeholder="Shu sahifada: buyurtma raqami, mijoz yoki manzil"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="w-44">
            <Select
              aria-label="Holat bo'yicha filtr"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Barcha holatlar</option>
              {Object.entries(orderStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          {showBranchFilter ? (
            <div className="w-56">
              <Select
                aria-label="Filial bo'yicha filtr"
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
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
          caption="Online buyurtmalar"
          columns={columns}
          emptyDescription="Qidiruv yoki filtrni o'zgartirib ko'ring."
          emptyTitle="Online buyurtma topilmadi"
          getRowKey={(item) => item.id}
          isLoading={isLoading}
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
    </div>
  );
}
