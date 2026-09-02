"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { EmptyState, PrimaryButton, TextInput } from "../erp/erp-ui";
import { apiFetch } from "../../lib/api";

type Branch = {
  id: string;
  name: string;
  address?: string | null;
};

type SalesReport = {
  period: {
    from: string;
    to: string;
  };
  branchId?: string | null;
  revenue: string;
  orderCount: number;
  averageOrderValue: string;
  paymentBreakdown: {
    paymentMethod: {
      id: string;
      code: string;
      name: string;
    };
    amount: string;
    count: number;
  }[];
};

const formatter = new Intl.NumberFormat("uz-UZ");

export function AdminReportsPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [report, setReport] = useState<SalesReport | null>(null);
  const [branchId, setBranchId] = useState("");
  const [from, setFrom] = useState(() => toDateInput(new Date()));
  const [to, setTo] = useState(() => toDateInput(new Date()));
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([apiFetch<Branch[]>("/branches"), loadSalesReport(from, to, "")])
      .then(([nextBranches, nextReport]) => {
        setBranches(nextBranches);
        setReport(nextReport);
      })
      .catch(() => setError("Hisobot ma'lumotlarini yuklab bo'lmadi."));
  }, []);

  const branchName = useMemo(
    () => branches.find((branch) => branch.id === branchId)?.name ?? "Barcha ruxsat berilgan filiallar",
    [branchId, branches],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      setReport(await loadSalesReport(from, to, branchId));
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : "Hisobot yuklanmadi.");
    }
  }

  function setRange(range: "today" | "yesterday" | "week" | "month") {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);

    if (range === "yesterday") {
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
    }

    if (range === "week") {
      start.setDate(start.getDate() - 6);
    }

    if (range === "month") {
      start.setDate(1);
    }

    setFrom(toDateInput(start));
    setTo(toDateInput(end));
  }

  return (
    <div className="grid gap-5">
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <form className="grid gap-3 rounded-3xl border border-white/70 bg-white p-4 shadow-[0_18px_60px_rgba(0,84,77,0.10)] lg:grid-cols-[150px_150px_1fr_auto]" onSubmit={submit}>
        <TextInput type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <TextInput type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        <select
          className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold text-neutral-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          value={branchId}
          onChange={(event) => setBranchId(event.target.value)}
        >
          <option value="">Barcha ruxsat berilgan filiallar</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name} · {branch.address ?? ""}
            </option>
          ))}
        </select>
        <PrimaryButton type="submit">Ko'rish</PrimaryButton>
      </form>

      <div className="flex flex-wrap gap-2">
        <QuickRange label="Bugun" onClick={() => setRange("today")} />
        <QuickRange label="Kecha" onClick={() => setRange("yesterday")} />
        <QuickRange label="7 kun" onClick={() => setRange("week")} />
        <QuickRange label="Bu oy" onClick={() => setRange("month")} />
      </div>

      {report ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <Metric label="Tasdiqlangan tushum" value={formatMoney(report.revenue)} />
            <Metric label="Buyurtmalar" value={`${report.orderCount} ta`} />
            <Metric label="O'rtacha chek" value={formatMoney(report.averageOrderValue)} />
          </section>

          <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <div className="rounded-3xl border border-white/70 bg-white p-5 shadow-[0_18px_60px_rgba(0,84,77,0.10)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-[#06433d]">To'lovlar kesimi</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{branchName}</p>
                </div>
                <Badge>{new Date(report.period.from).toLocaleDateString("uz-UZ")} - {new Date(report.period.to).toLocaleDateString("uz-UZ")}</Badge>
              </div>
              <div className="mt-5 grid gap-3">
                {report.paymentBreakdown.length ? (
                  report.paymentBreakdown.map((row) => (
                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm" key={row.paymentMethod.id}>
                      <div>
                        <p className="font-black text-[#083f39]">{row.paymentMethod.name}</p>
                        <p className="text-xs font-semibold text-slate-500">{row.paymentMethod.code} · {row.count} ta</p>
                      </div>
                      <span className="font-black text-[#06433d]">{formatMoney(row.amount)}</span>
                    </div>
                  ))
                ) : (
                  <EmptyState title="Bu davrda tasdiqlangan to'lov yozuvi yo'q." />
                )}
              </div>
            </div>

            <aside className="grid content-start gap-3">
              <Readiness title="Hozir ishonchli" items={["Tasdiqlangan to'lovlar tushumi", "Buyurtmalar soni", "O'rtacha chek", "To'lov metodi kesimi"]} />
              <Readiness title="Keyingi bosqichdan keyin" items={["Kassir shift topshirishi", "Click/Payme provider reconciliation", "Refund va cancellation moliyaviy analitikasi", "Mahsulot/category profitability"]} muted />
            </aside>
          </section>
        </>
      ) : (
        <EmptyState title="Hisobot yuklanmoqda." />
      )}
    </div>
  );
}

async function loadSalesReport(from: string, to: string, branchId: string): Promise<SalesReport> {
  const params = new URLSearchParams({ from, to });

  if (branchId) {
    params.set("branchId", branchId);
  }

  return apiFetch<SalesReport>(`/reports/sales?${params.toString()}`);
}

function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatMoney(value: string | number): string {
  return `${formatter.format(Math.round(Number(value || 0)))} so'm`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-3xl border border-white/70 bg-white p-5 shadow-[0_18px_60px_rgba(0,84,77,0.10)]">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-black text-[#083f39]">{value}</p>
    </article>
  );
}

function QuickRange({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      className="rounded-full border border-white/70 bg-white px-4 py-2 text-sm font-black text-[#0c6b60] shadow-sm transition hover:bg-[#e6f4ef]"
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function Readiness({ items, muted, title }: { items: string[]; muted?: boolean; title: string }) {
  return (
    <section className="rounded-3xl border border-white/70 bg-white p-5 shadow-[0_18px_60px_rgba(0,84,77,0.10)]">
      <p className={`text-sm font-black ${muted ? "text-slate-500" : "text-[#06433d]"}`}>{title}</p>
      <ul className="mt-3 grid gap-2 text-sm font-semibold text-slate-600">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-[#fff2b8] px-3 py-1 text-xs font-black text-[#836100]">{children}</span>;
}

function Notice({ children, tone = "success" }: { children: React.ReactNode; tone?: "success" | "danger" }) {
  return (
    <div className={`rounded-2xl px-4 py-3 text-sm font-bold ${tone === "danger" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>
      {children}
    </div>
  );
}
