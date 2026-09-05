"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { canSwitchBranch } from "../../lib/admin-nav";
import {
  formatDateTime,
  formatMoney,
  orderSourceLabels,
  orderStatusLabels,
  orderStatusTone,
  type OrderSource,
  type OrderStatus,
  type PaymentStatus,
} from "../../lib/order-display";
import { useAuth } from "../auth/auth-provider";
import { Badge } from "../admin-ui/badge";
import { Button, ButtonLink } from "../admin-ui/button";
import { Card } from "../admin-ui/card";
import { DataTable, type DataTableColumn } from "../admin-ui/data-table";
import { ErrorState } from "../admin-ui/feedback";
import { FilterBar, Select } from "../admin-ui/form";
import { InfoBox, StatGrid } from "../admin-ui/stat-box";

/*
 * Cheklar ro'yxati.
 *
 * `GET /receipts` 4-bosqichda qo'shildi. Ro'yxat chek MAZMUNINI qaytarmaydi —
 * `content` va ESC/POS satri faqat bitta chek so'ralganda keladi.
 *
 * Bu ekran FAQAT O'QISH: chekni qayta chop etish kassa ishi
 * (`RECEIPT_PRINT`, POS ekranida).
 */

type Branch = { id: string; code: string; name: string };

type Receipt = {
  id: string;
  receiptNumber: string;
  total: string;
  printed: boolean;
  printedAt?: string | null;
  createdAt: string;
  orderId: string;
  branch?: { id: string; code: string; name: string } | null;
  order?: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    source: OrderSource;
  } | null;
};

const pageSize = 25;

export function AdminReceiptsPage() {
  const { user } = useAuth();
  const showBranchFilter = canSwitchBranch(user);

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [printed, setPrinted] = useState("");
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
        // Filial ro'yxati ixtiyoriy.
      });
  }, [showBranchFilter]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");

    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String(offset),
    });

    if (branchId) params.set("branchId", branchId);

    try {
      setReceipts(await apiFetch<Receipt[]>(`/receipts?${params.toString()}`));
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      setError(caught instanceof Error ? caught.message : "Cheklarni yuklab bo'lmadi.");
    } finally {
      setIsLoading(false);
    }
  }, [branchId, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * Backend `printed` bo'yicha filtrlashni qo'llab-quvvatlamaydi,
   * shuning uchun bu filtr sahifa ichida ishlaydi.
   */
  const filtered = useMemo(() => {
    if (!printed) {
      return receipts;
    }

    return receipts.filter((receipt) =>
      printed === "PRINTED" ? receipt.printed : !receipt.printed,
    );
  }, [printed, receipts]);

  const stats = useMemo(() => {
    const printedCount = receipts.filter((receipt) => receipt.printed).length;
    const amount = receipts.reduce((sum, receipt) => sum + Number(receipt.total ?? 0), 0);

    return { printedCount, amount, total: receipts.length };
  }, [receipts]);

  const columns: DataTableColumn<Receipt>[] = [
    {
      key: "receipt",
      header: "Chek",
      primary: true,
      render: (receipt) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-mz-text">{receipt.receiptNumber}</p>
          <p className="truncate text-xs text-mz-text-muted">
            {formatDateTime(receipt.createdAt)}
            {receipt.order ? ` · ${orderSourceLabels[receipt.order.source]}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "order",
      header: "Buyurtma",
      render: (receipt) => receipt.order?.orderNumber ?? "—",
    },
    {
      key: "orderStatus",
      header: "Buyurtma holati",
      hideOnMobile: true,
      render: (receipt) =>
        receipt.order ? (
          <Badge tone={orderStatusTone(receipt.order.status)}>
            {orderStatusLabels[receipt.order.status]}
          </Badge>
        ) : (
          "—"
        ),
    },
    {
      key: "branch",
      header: "Filial",
      hideOnMobile: true,
      render: (receipt) => receipt.branch?.name ?? "—",
    },
    {
      key: "printed",
      header: "Chop etilgan",
      render: (receipt) => (
        <Badge tone={receipt.printed ? "success" : "neutral"} withDot>
          {receipt.printed ? "Ha" : "Yo'q"}
        </Badge>
      ),
    },
    {
      key: "total",
      header: "Summa",
      align: "right",
      render: (receipt) => (
        <span className="font-semibold text-mz-text">{formatMoney(receipt.total)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (receipt) => (
        <ButtonLink href={`/admin/orders/${receipt.orderId}`} size="sm" variant="ghost">
          Buyurtma
        </ButtonLink>
      ),
    },
  ];

  return (
    <div className="grid gap-5">
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      <StatGrid>
        <InfoBox label="Ko'rsatilgan chek" value={`${stats.total} ta`} />
        <InfoBox label="Chop etilgan" tone="success" value={`${stats.printedCount} ta`} />
        <InfoBox
          label="Chop etilmagan"
          tone={stats.total - stats.printedCount > 0 ? "warning" : "neutral"}
          value={`${stats.total - stats.printedCount} ta`}
        />
        <InfoBox label="Summa (sahifada)" tone="brand" value={formatMoney(stats.amount)} />
      </StatGrid>

      <Card>
        <FilterBar>
          <div className="w-48">
            <Select
              aria-label="Chop etilish holati bo'yicha filtr"
              value={printed}
              onChange={(event) => setPrinted(event.target.value)}
            >
              <option value="">Barchasi</option>
              <option value="PRINTED">Chop etilgan</option>
              <option value="NOT_PRINTED">Chop etilmagan</option>
            </Select>
          </div>

          {showBranchFilter ? (
            <div className="w-56">
              <Select
                aria-label="Filial bo'yicha filtr"
                value={branchId}
                onChange={(event) => {
                  setBranchId(event.target.value);
                  setOffset(0);
                }}
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
          caption="Cheklar ro'yxati"
          columns={columns}
          emptyDescription="Filtrni o'zgartirib ko'ring yoki boshqa sahifaga o'ting."
          emptyTitle="Chek topilmadi"
          getRowKey={(receipt) => receipt.id}
          isLoading={isLoading}
          rows={filtered}
        />

        <div className="flex items-center justify-between gap-3 border-t border-mz-border px-4 py-3">
          <p className="text-xs text-mz-text-muted">
            {offset + 1}–{offset + receipts.length}-chek
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
              disabled={receipts.length < pageSize || isLoading}
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
