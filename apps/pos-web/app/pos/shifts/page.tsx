"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthShell } from "../../../components/auth/auth-shell";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";
import { EmptyState, PrimaryButton } from "../../../components/erp/erp-ui";
import { apiFetch } from "../../../lib/api";

type Shift = {
  id: string;
  shiftNumber: number;
  status: "OPEN" | "CLOSED";
  openingBalance: string;
  closingBalance?: string | null;
  currentBalance?: string;
  openedAt: string;
  branch: { id: string; name: string };
  cashTransactions: CashTransaction[];
};
type CashTransaction = {
  id: string;
  type: string;
  amount: string;
  reason?: string | null;
  occurredAt: string;
};

export default function ShiftsPage() {
  return (
    <RoleGuard roles={["CASHIER", "BRANCH_MANAGER", "SUPER_ADMIN"]}>
      <PermissionGuard permission="SHIFT_OPEN">
        <AuthShell eyebrow="Cash drawer" title="Shifts">
          <ShiftConsole />
        </AuthShell>
      </PermissionGuard>
    </RoleGuard>
  );
}

function ShiftConsole() {
  const [shift, setShift] = useState<Shift | null>(null);
  const [branchId, setBranchId] = useState("");
  const [openingCash, setOpeningCash] = useState("500000");
  const [closingCash, setClosingCash] = useState("");
  const [transactionAmount, setTransactionAmount] = useState("");
  const [transactionType, setTransactionType] = useState("WITHDRAW");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const loadShift = useCallback(async () => {
    const current = await apiFetch<Shift | null>("/cash-register/shift");
    setShift(current);
  }, []);

  useEffect(() => {
    void loadShift();
  }, [loadShift]);

  async function openShift() {
    await apiFetch("/cash-register/shift/open", {
      method: "POST",
      body: JSON.stringify({ branchId, openingBalance: Number(openingCash) }),
    });
    setMessage("Shift opened");
    await loadShift();
  }

  async function closeShift() {
    if (!shift) {
      return;
    }

    await apiFetch(`/cash-register/shift/${shift.id}/close`, {
      method: "POST",
      body: JSON.stringify({ closingBalance: Number(closingCash) }),
    });
    setMessage("Shift closed");
    await loadShift();
  }

  async function addTransaction() {
    if (!shift) {
      return;
    }

    await apiFetch(`/cash-register/shift/${shift.id}/transactions`, {
      method: "POST",
      body: JSON.stringify({
        type: transactionType,
        amount: Number(transactionAmount),
        reason: description || undefined,
      }),
    });
    setTransactionAmount("");
    setDescription("");
    await loadShift();
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <div className="grid gap-5">
        {shift ? (
          <div className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-[0_14px_45px_rgba(17,24,39,0.08)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-emerald-700">Open shift</p>
                <h2 className="mt-1 text-3xl font-semibold text-neutral-950">#{shift.shiftNumber}</h2>
                <p className="mt-1 text-sm text-neutral-500">{shift.branch.name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-neutral-500">Current cash</p>
                <p className="text-3xl font-semibold text-neutral-950">{formatMoney(shift.currentBalance ?? shift.openingBalance)}</p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Metric label="Opening cash" value={formatMoney(shift.openingBalance)} />
              <Metric label="Opened" value={new Date(shift.openedAt).toLocaleString()} />
              <Metric label="Status" value={shift.status} />
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-[0_14px_45px_rgba(17,24,39,0.08)]">
            <h2 className="text-xl font-semibold text-neutral-950">Open cashier shift</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-emerald-500" placeholder="Branch ID" value={branchId} onChange={(event) => setBranchId(event.target.value)} />
              <input className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-emerald-500" inputMode="decimal" value={openingCash} onChange={(event) => setOpeningCash(event.target.value)} />
            </div>
            <div className="mt-4">
              <PrimaryButton onClick={() => void openShift()}>Open shift</PrimaryButton>
            </div>
          </div>
        )}

        <div className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-[0_14px_45px_rgba(17,24,39,0.08)]">
          <h2 className="text-xl font-semibold text-neutral-950">Cash transactions</h2>
          {shift?.cashTransactions.length ? (
            <div className="mt-4 grid gap-2">
              {shift.cashTransactions.map((transaction) => (
                <div className="flex justify-between rounded-2xl bg-neutral-50 px-4 py-3 text-sm" key={transaction.id}>
                  <span className="font-semibold text-neutral-800">{transaction.type}</span>
                  <span className="text-neutral-600">{formatMoney(transaction.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No cash drawer movements yet." />
          )}
        </div>
      </div>

      <aside className="grid content-start gap-5">
        {message ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
        {shift ? (
          <>
            <div className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-[0_14px_45px_rgba(17,24,39,0.08)]">
              <h2 className="text-lg font-semibold text-neutral-950">Drawer movement</h2>
              <div className="mt-4 grid gap-3">
                <select className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-500" value={transactionType} onChange={(event) => setTransactionType(event.target.value)}>
                  <option value="WITHDRAW">WITHDRAW</option>
                  <option value="EXPENSE">EXPENSE</option>
                  <option value="INCOME">INCOME</option>
                  <option value="CASH_IN">CASH_IN</option>
                </select>
                <input className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-emerald-500" inputMode="decimal" placeholder="Amount" value={transactionAmount} onChange={(event) => setTransactionAmount(event.target.value)} />
                <textarea className="min-h-24 rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-emerald-500" placeholder="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
                <PrimaryButton onClick={() => void addTransaction()}>Add transaction</PrimaryButton>
              </div>
            </div>

            <div className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-[0_14px_45px_rgba(17,24,39,0.08)]">
              <h2 className="text-lg font-semibold text-neutral-950">Daily closing</h2>
              <input className="mt-4 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-emerald-500" inputMode="decimal" placeholder="Actual closing cash" value={closingCash} onChange={(event) => setClosingCash(event.target.value)} />
              <div className="mt-4">
                <PrimaryButton onClick={() => void closeShift()}>Close shift</PrimaryButton>
              </div>
            </div>
          </>
        ) : null}
      </aside>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-emerald-50 p-4">
      <p className="text-sm font-semibold text-emerald-700">{label}</p>
      <p className="mt-1 text-lg font-semibold text-neutral-950">{value}</p>
    </div>
  );
}

function formatMoney(value: string | number): string {
  return `${Number(value || 0).toLocaleString("uz-UZ")} UZS`;
}
