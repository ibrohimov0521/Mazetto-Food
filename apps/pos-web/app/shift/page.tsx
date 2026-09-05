"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PermissionGuard } from "../../components/auth/permission-guard";
import { RoleGuard } from "../../components/auth/role-guard";
import { useAuth } from "../../components/auth/auth-provider";
import { apiFetch } from "../../lib/api";

type Shift = {
  id: string;
  shiftNumber: number;
  status: "OPEN" | "CLOSED";
  openingBalance: string;
  closingBalance?: string | null;
  expectedCash?: string | null;
  cashDifference?: string | null;
  currentBalance?: string;
  cashSales?: string;
  orderCount?: number;
  openedAt: string;
  closedAt?: string | null;
  branch: { id: string; name: string; address?: string | null };
  employee: { firstName: string; lastName?: string | null };
  cashTransactions?: CashTransaction[];
};

type CashTransaction = {
  id: string;
  type: string;
  amount: string;
  reason?: string | null;
  occurredAt: string;
};

const formatter = new Intl.NumberFormat("uz-UZ");

export default function ShiftPage() {
  return (
    <RoleGuard roles={["CASHIER", "BRANCH_MANAGER", "SUPER_ADMIN"]}>
      <PermissionGuard permission="SHIFT_VIEW_OWN">
        <ShiftConsole />
      </PermissionGuard>
    </RoleGuard>
  );
}

function ShiftConsole() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [shift, setShift] = useState<Shift | null>(null);
  const [closedShift, setClosedShift] = useState<Shift | null>(null);
  const [openingCash, setOpeningCash] = useState("0");
  const [closingCash, setClosingCash] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const expectedCash = Number(shift?.expectedCash ?? shift?.currentBalance ?? shift?.openingBalance ?? 0);
  const closingValue = Number(closingCash || 0);
  const differencePreview = closingCash ? closingValue - expectedCash : 0;

  const cashierName = useMemo(() => {
    if (shift?.employee) {
      return [shift.employee.firstName, shift.employee.lastName].filter(Boolean).join(" ");
    }

    return user?.email ?? user?.phone ?? "Kassir";
  }, [shift?.employee, user?.email, user?.phone]);

  const loadShift = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const current = await apiFetch<Shift | null>("/cash-register/shift");
      setShift(current);
    } catch (loadError) {
      if (isAuthenticationError(loadError)) {
        void logout();
        return;
      }

      setError(loadError instanceof Error ? loadError.message : "Smena ma'lumoti yuklanmadi");
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    void loadShift();
  }, [loadShift]);

  async function openShift() {
    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const opened = await apiFetch<Shift>("/cash-register/shift/open", {
        method: "POST",
        body: JSON.stringify({ openingBalance: Number(openingCash || 0) }),
      });
      setShift(opened);
      setClosedShift(null);
      setMessage("Smena ochildi. Endi savdo qilish mumkin.");
      router.replace("/pos");
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Smena ochilmadi");
    } finally {
      setIsSaving(false);
    }
  }

  async function closeShift() {
    if (!shift) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const closed = await apiFetch<Shift>(`/cash-register/shift/${shift.id}/close`, {
        method: "POST",
        body: JSON.stringify({ closingBalance: Number(closingCash || 0) }),
      });
      setClosedShift(closed);
      setShift(null);
      setClosingCash("");
      setMessage("Smena yopildi. Yangi savdo uchun yangi smena oching.");
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : "Smena yopilmadi");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#062d2b] px-4 py-5 text-[#10233a] sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-white/10 bg-[#073f3b] px-5 py-4 text-white shadow-2xl">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ffd52e]">MAZETTO FOOD</p>
            <h1 className="text-2xl font-black">Kassa smenasi</h1>
            <p className="mt-1 text-sm font-bold text-white/70">{cashierName}</p>
          </div>
          <div className="flex gap-2">
            {shift ? (
              <button className="rounded-full bg-[#ffd52e] px-5 py-3 text-sm font-black text-[#10233a]" onClick={() => router.push("/pos")} type="button">
                POSga o'tish
              </button>
            ) : null}
            <button className="rounded-full bg-white/10 px-4 py-3 text-sm font-black" onClick={() => void logout()} type="button">
              Chiqish
            </button>
          </div>
        </header>

        {isLoading ? (
          <section className="rounded-[30px] bg-[#fffaf0] p-6 text-lg font-black shadow-2xl">Smena tekshirilmoqda...</section>
        ) : null}

        {error ? <p className="rounded-3xl bg-red-50 px-5 py-4 text-sm font-black text-red-700">{error}</p> : null}
        {message ? <p className="rounded-3xl bg-emerald-50 px-5 py-4 text-sm font-black text-emerald-700">{message}</p> : null}

        {shift ? (
          <section className="grid gap-4 lg:grid-cols-[1fr_380px]">
            <article className="rounded-[30px] bg-[#fffaf0] p-5 shadow-2xl">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.14em] text-[#008678]">Ochiq smena</p>
                  <h2 className="mt-2 text-4xl font-black">#{shift.shiftNumber}</h2>
                  <p className="mt-2 text-sm font-bold text-slate-500">{shift.branch.name}</p>
                </div>
                <div className="rounded-[24px] bg-[#ffe86b] px-5 py-4 text-right">
                  <p className="text-xs font-black uppercase text-[#00796f]">Kutilgan naqd</p>
                  <p className="text-2xl font-black">{money(expectedCash)}</p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Boshlang'ich naqd" value={money(shift.openingBalance)} />
                <Metric label="Naqd savdo" value={money(shift.cashSales ?? 0)} />
                <Metric label="Buyurtmalar" value={`${shift.orderCount ?? 0} ta`} />
                <Metric label="Ochilgan vaqt" value={new Date(shift.openedAt).toLocaleString("uz-UZ")} />
              </div>

              <div className="mt-6 rounded-[24px] bg-white p-4">
                <h3 className="text-lg font-black">Kassa harakatlari</h3>
                <div className="mt-3 grid gap-2">
                  {shift.cashTransactions?.length ? (
                    shift.cashTransactions.map((transaction) => (
                      <div className="flex justify-between rounded-2xl bg-[#f3f8f5] px-4 py-3 text-sm font-bold" key={transaction.id}>
                        <span>{transaction.type}</span>
                        <span>{money(transaction.amount)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm font-bold text-slate-500">Hali kassa harakati yo'q.</p>
                  )}
                </div>
              </div>
            </article>

            <aside className="rounded-[30px] bg-[#fffaf0] p-5 shadow-2xl">
              <p className="text-sm font-black uppercase tracking-[0.14em] text-[#008678]">Kassa topshirish</p>
              <h2 className="mt-2 text-2xl font-black">Smenani yopish</h2>
              <label className="mt-5 grid gap-2 text-sm font-black">
                Haqiqiy naqd summa
                <input className="min-h-14 rounded-2xl border border-[#d8e5df] px-4 text-lg font-black outline-none focus:border-[#008678]" inputMode="numeric" onChange={(event) => setClosingCash(event.target.value)} value={closingCash} />
              </label>
              <div className="mt-4 grid gap-2 rounded-2xl bg-white p-4 text-sm font-black">
                <div className="flex justify-between"><span>Kutilgan</span><span>{money(expectedCash)}</span></div>
                <div className="flex justify-between"><span>Farq</span><span className={differencePreview === 0 ? "text-[#008678]" : "text-red-600"}>{money(differencePreview)}</span></div>
              </div>
              <button className="mt-5 min-h-14 w-full rounded-2xl bg-[#ffd52e] text-base font-black shadow-[0_12px_28px_rgba(255,213,46,0.35)] disabled:opacity-50" disabled={isSaving || !closingCash} onClick={() => void closeShift()} type="button">
                {isSaving ? "Yopilmoqda..." : "Kassa topshirish"}
              </button>
            </aside>
          </section>
        ) : !isLoading ? (
          <section className="grid gap-4 lg:grid-cols-[1fr_380px]">
            <article className="rounded-[30px] bg-[#fffaf0] p-6 shadow-2xl">
              <p className="text-sm font-black uppercase tracking-[0.14em] text-[#008678]">Smena yopiq</p>
              <h2 className="mt-2 text-4xl font-black">Savdoni boshlash uchun smena oching</h2>
              <p className="mt-3 max-w-2xl text-sm font-bold text-slate-600">
                Smena ochilmaguncha POS savdo oynasi ishlamaydi. Filial va kassir serverdagi xodim profilingizdan olinadi.
              </p>
              {closedShift ? (
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <Metric label="Yopilgan smena" value={`#${closedShift.shiftNumber}`} />
                  <Metric label="Kutilgan naqd" value={money(closedShift.expectedCash ?? 0)} />
                  <Metric label="Farq" value={money(closedShift.cashDifference ?? 0)} />
                </div>
              ) : null}
            </article>
            <aside className="rounded-[30px] bg-[#fffaf0] p-5 shadow-2xl">
              <p className="text-sm font-black uppercase tracking-[0.14em] text-[#008678]">Smenani ochish</p>
              <label className="mt-5 grid gap-2 text-sm font-black">
                Boshlang'ich naqd summa
                <input className="min-h-14 rounded-2xl border border-[#d8e5df] px-4 text-lg font-black outline-none focus:border-[#008678]" inputMode="numeric" onChange={(event) => setOpeningCash(event.target.value)} value={openingCash} />
              </label>
              <button className="mt-5 min-h-14 w-full rounded-2xl bg-[#ffd52e] text-base font-black shadow-[0_12px_28px_rgba(255,213,46,0.35)] disabled:opacity-50" disabled={isSaving} onClick={() => void openShift()} type="button">
                {isSaving ? "Ochilmoqda..." : "Smenani ochish"}
              </button>
            </aside>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <p className="text-xs font-black uppercase text-[#008678]">{label}</p>
      <p className="mt-2 text-lg font-black">{value}</p>
    </div>
  );
}

function money(value: string | number): string {
  return `${formatter.format(Math.round(Number(value || 0)))} so'm`;
}

function isAuthenticationError(error: unknown): boolean {
  return error instanceof Error && /invalid or expired access token|unauthorized|jwt/i.test(error.message);
}
