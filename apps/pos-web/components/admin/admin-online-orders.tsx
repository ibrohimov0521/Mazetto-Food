"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
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
import { InfoBox, StatGrid } from "../admin-ui/stat-box";

/*
 * Sayt va Telegram orqali kelgan mijoz buyurtmalari.
 *
 * Backend `/online-orders` tayyor edi, lekin admin panelda ekrani yo'q edi.
 *
 * ESLATMA: `/online-orders` pagination'ni qo'llab-quvvatlamaydi — barcha
 * yozuvlarni qaytaradi. Buyurtmalar soni o'sganda backend'ga `limit`/`offset`
 * qo'shilishi kerak (4-bosqich). Hozircha filtr/qidiruv brauzerda bajariladi.
 */

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

  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

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

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");

    const path = branchId
      ? `/online-orders?branchId=${encodeURIComponent(branchId)}`
      : "/online-orders";

    try {
      setOrders(await apiFetch<CustomerOrder[]>(path));
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      setError(caught instanceof Error ? caught.message : "Online buyurtmalarni yuklab bo'lmadi.");
    } finally {
      setIsLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return orders.filter((item) => {
      const identity = [
        item.order?.orderNumber,
        item.customer?.name,
        item.customer?.phone,
        item.deliveryAddress,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (!needle || identity.includes(needle)) && (!status || item.status === status);
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
            {item.order?.orderNumber ?? "Raqamsiz"}
          </p>
          <p className="truncate text-xs text-mz-text-muted">{formatDateTime(item.createdAt)}</p>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Mijoz",
      render: (item) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-mz-text">{item.customer?.name ?? "—"}</p>
          <p className="truncate text-xs text-mz-text-muted">{maskPhone(item.customer?.phone)}</p>
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
        <span className="font-semibold text-mz-text">{formatMoney(item.order?.total)}</span>
      ),
    },
  ];

  return (
    <div className="grid gap-5">
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      <StatGrid>
        <InfoBox label="Jami online buyurtma" value={`${stats.total} ta`} />
        <InfoBox label="Jarayonda" tone="warning" value={`${stats.active} ta`} />
        <InfoBox label="Yetkazib berish" value={`${stats.delivery} ta`} />
        <InfoBox label="Umumiy summa" tone="brand" value={formatMoney(stats.revenue)} />
      </StatGrid>

      <Card>
        <FilterBar>
          <div className="min-w-52 flex-1">
            <TextInput
              aria-label="Online buyurtma qidirish"
              placeholder="Buyurtma raqami, mijoz yoki manzil"
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
      </Card>
    </div>
  );
}
