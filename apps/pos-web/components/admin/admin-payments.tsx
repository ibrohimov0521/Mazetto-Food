"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { canSwitchBranch } from "../../lib/admin-nav";
import {
  formatDateTime,
  formatMoney,
  orderSourceLabels,
  paymentStatusLabels,
  paymentStatusTone,
  type OrderSource,
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
 * To'lovlar ro'yxati.
 *
 * `GET /payments` 4-bosqichda qo'shildi (`PAYMENT_VIEW` permission'i bilan).
 * `PAYMENT_CREATE` yozish uchun; ko'rish alohida permission bo'lishi kerak edi.
 */

type Branch = { id: string; code: string; name: string };

type Payment = {
  id: string;
  amount: string;
  status: PaymentStatus;
  methodCode?: string | null;
  reference?: string | null;
  paidAt?: string | null;
  createdAt: string;
  method?: { id: string; code: string; name: string } | null;
  acceptedBy?: { id: string; firstName: string; lastName?: string | null } | null;
  order?: {
    id: string;
    orderNumber: string;
    source: OrderSource;
    total: string;
    branch?: { id: string; code: string; name: string } | null;
  } | null;
};

const pageSize = 25;

export function AdminPaymentsPage() {
  const { user } = useAuth();
  const showBranchFilter = canSwitchBranch(user);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [status, setStatus] = useState("");
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

    if (status) params.set("status", status);
    if (branchId) params.set("branchId", branchId);

    try {
      setPayments(await apiFetch<Payment[]>(`/payments?${params.toString()}`));
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      setError(caught instanceof Error ? caught.message : "To'lovlarni yuklab bo'lmadi.");
    } finally {
      setIsLoading(false);
    }
  }, [branchId, offset, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const successful = payments.filter(
      (payment) => payment.status === "PAID" || payment.status === "SUCCESS",
    );
    const amount = successful.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
    const refunded = payments.filter(
      (payment) => payment.status === "REFUNDED" || payment.status === "PARTIALLY_REFUNDED",
    ).length;

    return { successful: successful.length, amount, refunded, total: payments.length };
  }, [payments]);

  const columns: DataTableColumn<Payment>[] = [
    {
      key: "payment",
      header: "To'lov",
      primary: true,
      render: (payment) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-mz-text">
            {payment.order?.orderNumber ?? "Buyurtmasiz"}
          </p>
          <p className="truncate text-xs text-mz-text-muted">
            {formatDateTime(payment.paidAt ?? payment.createdAt)}
            {payment.order ? ` · ${orderSourceLabels[payment.order.source]}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "method",
      header: "Usul",
      render: (payment) => payment.method?.name ?? payment.methodCode ?? "—",
    },
    {
      key: "branch",
      header: "Filial",
      hideOnMobile: true,
      render: (payment) => payment.order?.branch?.name ?? "—",
    },
    {
      key: "accepted",
      header: "Qabul qilgan",
      hideOnMobile: true,
      render: (payment) =>
        payment.acceptedBy
          ? [payment.acceptedBy.firstName, payment.acceptedBy.lastName]
              .filter(Boolean)
              .join(" ")
          : "—",
    },
    {
      key: "status",
      header: "Holat",
      render: (payment) => (
        <Badge tone={paymentStatusTone(payment.status)} withDot>
          {paymentStatusLabels[payment.status]}
        </Badge>
      ),
    },
    {
      key: "amount",
      header: "Summa",
      align: "right",
      render: (payment) => (
        <span className="font-semibold text-mz-text">{formatMoney(payment.amount)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (payment) =>
        payment.order ? (
          <ButtonLink href={`/admin/orders/${payment.order.id}`} size="sm" variant="ghost">
            Buyurtma
          </ButtonLink>
        ) : null,
    },
  ];

  return (
    <div className="grid gap-5">
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      <StatGrid>
        <InfoBox label="Ko'rsatilgan to'lov" value={`${stats.total} ta`} />
        <InfoBox label="Muvaffaqiyatli" tone="success" value={`${stats.successful} ta`} />
        <InfoBox label="Summa (sahifada)" tone="brand" value={formatMoney(stats.amount)} />
        <InfoBox
          label="Qaytarilgan"
          tone={stats.refunded > 0 ? "warning" : "neutral"}
          value={`${stats.refunded} ta`}
        />
      </StatGrid>

      <Card>
        <FilterBar>
          <div className="w-48">
            <Select
              aria-label="Holat bo'yicha filtr"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setOffset(0);
              }}
            >
              <option value="">Barcha holatlar</option>
              {Object.entries(paymentStatusLabels).map(([value, label]) => (
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
          caption="To'lovlar ro'yxati"
          columns={columns}
          emptyDescription="Filtrni o'zgartirib ko'ring yoki boshqa sahifaga o'ting."
          emptyTitle="To'lov topilmadi"
          getRowKey={(payment) => payment.id}
          isLoading={isLoading}
          rows={payments}
        />

        <div className="flex items-center justify-between gap-3 border-t border-mz-border px-4 py-3">
          <p className="text-xs text-mz-text-muted">
            {offset + 1}–{offset + payments.length}-to&apos;lov
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
              disabled={payments.length < pageSize || isLoading}
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
