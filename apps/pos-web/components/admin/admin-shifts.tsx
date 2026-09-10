"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useApiResource } from "../../lib/use-api-resource";
import { canSwitchBranch } from "../../lib/admin-nav";
import { formatDateTime, formatMoney } from "../../lib/order-display";
import { useAuth } from "../auth/auth-provider";
import { Badge } from "../admin-ui/badge";
import { Card } from "../admin-ui/card";
import { DataTable, type DataTableColumn } from "../admin-ui/data-table";
import { ErrorState } from "../admin-ui/feedback";
import { FilterBar, Select } from "../admin-ui/form";
import { Pagination } from "../admin-ui/pagination";
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

  const [branches, setBranches] = useState<Branch[]>([]);
  const [status, setStatus] = useState("");
  const [branchId, setBranchId] = useState("");
  const [offset, setOffset] = useState(0);

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
      if (status) params.set("status", status);
      if (branchId) params.set("branchId", branchId);
      return apiFetch<Shift[]>(`/shifts?${params.toString()}`);
    },
    [branchId, offset, status],
    "Smenalarni yuklab bo'lmadi.",
  );
  const shifts = data ?? [];

  const stats = useMemo(() => {
    const open = shifts.filter((shift) => shift.status === "OPEN").length;
    const sales = shifts.reduce(
      (sum, shift) => sum + Number(shift.salesTotal ?? 0),
      0,
    );
    const mismatched = shifts.filter(
      (shift) =>
        shift.cashDifference != null &&
        Math.abs(Number(shift.cashDifference)) > 0.01,
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
      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}

      <StatGrid>
        <InfoBox
          icon="clipboard"
          label="Ko'rsatilgan smena"
          value={`${stats.total} ta`}
        />
        <InfoBox
          icon="clock"
          label="Ochiq smena"
          tone="warning"
          value={`${stats.open} ta`}
        />
        <InfoBox
          icon="wallet"
          label="Savdo (sahifada)"
          tone="brand"
          value={formatMoney(stats.sales)}
        />
        <InfoBox
          icon="alert"
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

        <Pagination
          count={shifts.length}
          isLoading={isLoading}
          noun="smena"
          offset={offset}
          onOffsetChange={setOffset}
          pageSize={pageSize}
        />
      </Card>
    </div>
  );
}
