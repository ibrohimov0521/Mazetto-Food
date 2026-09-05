"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { canSwitchBranch } from "../../lib/admin-nav";
import { formatDateTime, formatMoney } from "../../lib/order-display";
import { useAuth } from "../auth/auth-provider";
import { Badge } from "../admin-ui/badge";
import { Button } from "../admin-ui/button";
import { Card } from "../admin-ui/card";
import { DataTable, type DataTableColumn } from "../admin-ui/data-table";
import { ErrorState } from "../admin-ui/feedback";
import { FilterBar, Select } from "../admin-ui/form";
import { InfoBox, StatGrid } from "../admin-ui/stat-box";

/*
 * Kassir smenalari va kassa solishtiruvi.
 *
 * `GET /shifts` 4-bosqichda qo'shildi (`SHIFT_VIEW_BRANCH` permission'i bilan).
 * Ilgari faqat JORIY foydalanuvchi smenasi ko'rinardi, shuning uchun admin
 * kassa topshiruvini nazorat qila olmasdi.
 *
 * Asosiy qiymat — `cashDifference`: kutilgan naqd va topshirilgan naqd farqi.
 */

type Branch = { id: string; code: string; name: string };

type Shift = {
  id: string;
  shiftNumber: number;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closedAt?: string | null;
  openingBalance: string;
  closingBalance?: string | null;
  expectedCash?: string | null;
  cashDifference?: string | null;
  salesTotal: string;
  cashTotal: string;
  orderCount: number;
  branch?: { id: string; code: string; name: string } | null;
  employee?: { id: string; firstName: string; lastName?: string | null } | null;
  device?: { id: string; name: string } | null;
};

const pageSize = 25;

function employeeName(employee: Shift["employee"]): string {
  if (!employee) {
    return "—";
  }

  return [employee.firstName, employee.lastName].filter(Boolean).join(" ");
}

export function AdminShiftsPage() {
  const { user } = useAuth();
  const showBranchFilter = canSwitchBranch(user);

  const [shifts, setShifts] = useState<Shift[]>([]);
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
      setShifts(await apiFetch<Shift[]>(`/shifts?${params.toString()}`));
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      setError(caught instanceof Error ? caught.message : "Smenalarni yuklab bo'lmadi.");
    } finally {
      setIsLoading(false);
    }
  }, [branchId, offset, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const open = shifts.filter((shift) => shift.status === "OPEN").length;
    const sales = shifts.reduce((sum, shift) => sum + Number(shift.salesTotal ?? 0), 0);
    const mismatched = shifts.filter(
      (shift) => shift.cashDifference != null && Math.abs(Number(shift.cashDifference)) > 0.01,
    ).length;

    return { open, sales, mismatched, total: shifts.length };
  }, [shifts]);

  const columns: DataTableColumn<Shift>[] = [
    {
      key: "shift",
      header: "Smena",
      primary: true,
      render: (shift) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-mz-text">
            #{shift.shiftNumber} · {employeeName(shift.employee)}
          </p>
          <p className="truncate text-xs text-mz-text-muted">
            {formatDateTime(shift.openedAt)}
            {shift.closedAt ? ` — ${formatDateTime(shift.closedAt)}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "branch",
      header: "Filial",
      hideOnMobile: true,
      render: (shift) => shift.branch?.name ?? "—",
    },
    {
      key: "orders",
      header: "Buyurtma",
      align: "right",
      render: (shift) => `${shift.orderCount} ta`,
    },
    {
      key: "sales",
      header: "Savdo",
      align: "right",
      render: (shift) => formatMoney(shift.salesTotal),
    },
    {
      key: "expected",
      header: "Kutilgan naqd",
      align: "right",
      hideOnMobile: true,
      render: (shift) => formatMoney(shift.expectedCash),
    },
    {
      key: "difference",
      header: "Farq",
      align: "right",
      render: (shift) => {
        if (shift.cashDifference == null) {
          return <span className="text-mz-text-faint">—</span>;
        }

        const difference = Number(shift.cashDifference);
        const isBalanced = Math.abs(difference) < 0.01;

        return (
          <span
            className={
              isBalanced ? "text-mz-success" : "font-semibold text-mz-danger"
            }
          >
            {isBalanced ? "To'g'ri" : formatMoney(difference)}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Holat",
      align: "right",
      render: (shift) => (
        <Badge tone={shift.status === "OPEN" ? "info" : "neutral"} withDot>
          {shift.status === "OPEN" ? "Ochiq" : "Yopilgan"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="grid gap-5">
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      <StatGrid>
        <InfoBox label="Ko'rsatilgan smena" value={`${stats.total} ta`} />
        <InfoBox label="Ochiq smena" tone="warning" value={`${stats.open} ta`} />
        <InfoBox label="Savdo (sahifada)" tone="brand" value={formatMoney(stats.sales)} />
        <InfoBox
          label="Kassa farqi bor"
          tone={stats.mismatched > 0 ? "danger" : "success"}
          value={`${stats.mismatched} ta`}
        />
      </StatGrid>

      <Card>
        <FilterBar>
          <div className="w-44">
            <Select
              aria-label="Holat bo'yicha filtr"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setOffset(0);
              }}
            >
              <option value="">Barcha holatlar</option>
              <option value="OPEN">Ochiq</option>
              <option value="CLOSED">Yopilgan</option>
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
          caption="Kassir smenalari"
          columns={columns}
          emptyDescription="Filtrni o'zgartirib ko'ring yoki boshqa sahifaga o'ting."
          emptyTitle="Smena topilmadi"
          getRowKey={(shift) => shift.id}
          isLoading={isLoading}
          rows={shifts}
        />

        <div className="flex items-center justify-between gap-3 border-t border-mz-border px-4 py-3">
          <p className="text-xs text-mz-text-muted">
            {offset + 1}–{offset + shifts.length}-smena
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
              disabled={shifts.length < pageSize || isLoading}
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
