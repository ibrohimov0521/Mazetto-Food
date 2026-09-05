"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "../admin-ui/button";
import { TextInput } from "../admin-ui/form";
import { EmptyState } from "../admin-ui/feedback";
import { apiFetch } from "../../lib/api";
import { ErrorState, SkeletonRows } from "../admin-ui/feedback";

type Branch = {
  id: string;
  name: string;
  address?: string | null;
};

type MoneyValue = string | number | null | undefined;

type SalesReport = {
  period: {
    from: string;
    to: string;
    timezone: "Asia/Tashkent";
    preset: string;
  };
  branchId?: string | null;
  source?: "WEB" | "TELEGRAM" | "POS" | null;
  salesRule: {
    basis: string;
    paymentStatuses: string[];
    orderStatuses: string[];
    excludedOrderStatuses: string[];
  };
  revenue: string;
  totalSales: string;
  orderCount: number;
  averageOrderValue: string;
  cashSales: string;
  cancelledOrders: number;
  refundHandling: {
    supported: boolean;
    amount: string | null;
    note: string;
  };
  paymentBreakdown: {
    paymentMethod: {
      id: string;
      code: string;
      name: string;
    };
    amount: string;
    count: number;
  }[];
  sourceBreakdown: {
    source: "WEB" | "TELEGRAM" | "POS";
    amount: string;
    orderCount: number;
    paymentCount: number;
  }[];
  branchBreakdown: {
    branch: { id: string; code: string; name: string };
    amount: string;
    orderCount: number;
  }[];
  cashierBreakdown: {
    cashier: { id: string; employeeCode: string; firstName: string; lastName?: string | null };
    amount: string;
    orderCount: number;
  }[];
  shiftBreakdown: {
    id: string;
    branch: { id: string; code: string; name: string };
    cashier: { id: string; employeeCode: string; firstName: string; lastName?: string | null };
    shiftNumber: number;
    status: "OPEN" | "CLOSED";
    openedAt: string;
    closedAt?: string | null;
    orderCount: number;
    grossSales: string;
    cashSales: string;
    terminalSales: string;
    expectedCash?: string | null;
    actualCash?: string | null;
    cashDifference?: string | null;
  }[];
  topProducts: {
    productId: string | null;
    productName: string;
    quantity: string;
    amount: string;
  }[];
  categorySales: {
    category: { id: string | null; code: string; name: string };
    quantity: string;
    amount: string;
  }[];
  timeSeries: {
    grain: "day" | "month";
    data: {
      date: string;
      amount: string;
      orderCount: number;
    }[];
  };
  limitations: {
    categorySales: string;
    onlinePayments: string;
  };
};

const formatter = new Intl.NumberFormat("uz-UZ");
const yearOptions = Array.from({ length: 5 }, (_, index) => new Date().getFullYear() - index);
const sourceLabels = {
  WEB: "Web",
  TELEGRAM: "Telegram",
  POS: "Kassa",
};

export function AdminReportsPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [report, setReport] = useState<SalesReport | null>(null);
  const [branchId, setBranchId] = useState("");
  const [source, setSource] = useState("");
  const [preset, setPreset] = useState("today");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [from, setFrom] = useState(() => toDateInput(new Date()));
  const [to, setTo] = useState(() => toDateInput(new Date()));
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void Promise.all([apiFetch<Branch[]>("/branches"), loadSalesReport({ preset: "today" })])
      .then(([nextBranches, nextReport]) => {
        setBranches(nextBranches);
        setReport(nextReport);
      })
      .catch(() => setError("Hisobot ma'lumotlarini yuklab bo'lmadi."))
      .finally(() => setIsLoading(false));
  }, []);

  const branchName = useMemo(
    () => branches.find((branch) => branch.id === branchId)?.name ?? "Barcha ruxsat berilgan filiallar",
    [branchId, branches],
  );
  const maxChartAmount = Math.max(...(report?.timeSeries.data.map((row) => Number(row.amount)) ?? [0]), 1);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await reloadReport();
  }

  async function choosePreset(nextPreset: string) {
    setPreset(nextPreset);
    setError("");
    setIsLoading(true);

    try {
      setReport(await loadSalesReport(buildQuery(nextPreset)));
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : "Hisobot yuklanmadi.");
    } finally {
      setIsLoading(false);
    }
  }

  async function reloadReport() {
    setError("");
    setIsLoading(true);

    try {
      setReport(await loadSalesReport(buildQuery(preset)));
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : "Hisobot yuklanmadi.");
    } finally {
      setIsLoading(false);
    }
  }

  function buildQuery(nextPreset: string) {
    return {
      preset: nextPreset,
      branchId,
      source,
      from,
      to,
      year,
    };
  }

  return (
    <div className="grid gap-5">
      {error ? <ErrorState message={error} onRetry={() => void reloadReport()} /> : null}

      <form className="grid gap-3 rounded-mz-card border border-mz-border bg-mz-surface p-4 shadow-mz-card xl:grid-cols-[150px_150px_130px_1fr_150px_auto]" onSubmit={submit}>
        <select className="report-select" value={preset} onChange={(event) => setPreset(event.target.value)}>
          <option value="today">Bugun</option>
          <option value="yesterday">Kecha</option>
          <option value="last7days">7 kun</option>
          <option value="thisMonth">Bu oy</option>
          <option value="year">Yil</option>
          <option value="custom">Maxsus</option>
        </select>
        <TextInput disabled={preset !== "custom"} type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <TextInput disabled={preset !== "custom"} type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        <select className="report-select" value={branchId} onChange={(event) => setBranchId(event.target.value)}>
          <option value="">Barcha ruxsat berilgan filiallar</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name} · {branch.address ?? ""}
            </option>
          ))}
        </select>
        <select className="report-select" value={source} onChange={(event) => setSource(event.target.value)}>
          <option value="">Barcha kanallar</option>
          <option value="WEB">Web</option>
          <option value="TELEGRAM">Telegram</option>
          <option value="POS">Kassa</option>
        </select>
        <select className="report-select" disabled={preset !== "year"} value={year} onChange={(event) => setYear(event.target.value)}>
          {yearOptions.map((yearOption) => (
            <option key={yearOption} value={yearOption}>
              {yearOption}
            </option>
          ))}
        </select>
        <Button type="submit">Ko'rish</Button>
      </form>

      <div className="flex flex-wrap gap-2">
        <QuickRange active={preset === "today"} label="Bugun" onClick={() => void choosePreset("today")} />
        <QuickRange active={preset === "yesterday"} label="Kecha" onClick={() => void choosePreset("yesterday")} />
        <QuickRange active={preset === "last7days"} label="7 kun" onClick={() => void choosePreset("last7days")} />
        <QuickRange active={preset === "thisMonth"} label="Bu oy" onClick={() => void choosePreset("thisMonth")} />
        <QuickRange active={preset === "year"} label="Yil" onClick={() => void choosePreset("year")} />
      </div>

      {isLoading && !report ? <SkeletonRows rows={8} /> : null}

      {report ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Metric label="Jami savdo" value={formatMoney(report.totalSales)} />
            <Metric label="Buyurtmalar soni" value={`${report.orderCount} ta`} />
            <Metric label="O'rtacha chek" value={formatMoney(report.averageOrderValue)} />
            <Metric label="Naqd sotuv" value={formatMoney(report.cashSales)} />
            <Metric label="Bekor qilingan" value={`${report.cancelledOrders} ta`} muted />
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.4fr_0.9fr]">
            <Panel
              title={`${report.timeSeries.grain === "month" ? "Oyma-oy" : "Kunma-kun"} sotuv grafigi`}
              subtitle={`${branchName} · ${source ? sourceLabels[source as keyof typeof sourceLabels] : "Barcha kanallar"}`}
            >
              {report.timeSeries.data.length ? (
                <div className="grid gap-2">
                  {report.timeSeries.data.map((row) => (
                    <ChartRow
                      key={row.date}
                      label={row.date}
                      value={formatMoney(row.amount)}
                      width={`${Math.max(5, (Number(row.amount) / maxChartAmount) * 100)}%`}
                      detail={`${row.orderCount} ta`}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState title="Bu davrda tasdiqlangan sotuv yo'q." />
              )}
            </Panel>

            <Panel title="Kanal kesimi" subtitle="WEB · Telegram · Kassa">
              <div className="grid gap-3">
                {report.sourceBreakdown.map((row) => (
                  <BreakdownRow
                    key={row.source}
                    label={sourceLabels[row.source]}
                    value={formatMoney(row.amount)}
                    detail={`${row.orderCount} buyurtma · ${row.paymentCount} to'lov`}
                  />
                ))}
              </div>
            </Panel>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <Panel title="Filiallar" subtitle="Branch scope qoidasi bilan cheklangan">
              <DataTable
                empty="Bu davrda filial kesimida sotuv yo'q."
                headers={["Filial", "Buyurtma", "Tushum"]}
                rows={report.branchBreakdown.map((row) => [
                  row.branch.name,
                  `${row.orderCount} ta`,
                  formatMoney(row.amount),
                ])}
              />
            </Panel>

            <Panel title="Kassirlar" subtitle="Faqat POS sotuvlar">
              <DataTable
                empty="Bu davrda POS kassir sotuvi yo'q."
                headers={["Kassir", "Buyurtma", "Tushum"]}
                rows={report.cashierBreakdown.map((row) => [
                  employeeName(row.cashier),
                  `${row.orderCount} ta`,
                  formatMoney(row.amount),
                ])}
              />
            </Panel>
          </section>

          <Panel title="Smenalar" subtitle="Yopilgan smenada snapshot, ochiq smenada live payment asosida">
            <DataTable
              empty="Bu davrda smena ma'lumoti yo'q."
              headers={["Smena", "Kassir", "Holat", "Buyurtma", "Tushum", "Kutilgan", "Topshirildi", "Farq"]}
              rows={report.shiftBreakdown.map((shift) => [
                `${shift.branch.name} #${shift.shiftNumber}`,
                employeeName(shift.cashier),
                shift.status === "OPEN" ? "Ochiq" : "Yopilgan",
                `${shift.orderCount} ta`,
                formatMoney(shift.grossSales),
                formatMaybeMoney(shift.expectedCash),
                formatMaybeMoney(shift.actualCash),
                formatMaybeMoney(shift.cashDifference),
              ])}
            />
          </Panel>

          <section className="grid gap-5 xl:grid-cols-2">
            <Panel title="Top mahsulotlar" subtitle="OrderItem snapshot nomlari asosida">
              <DataTable
                empty="Bu davrda mahsulot sotuvlari yo'q."
                headers={["Mahsulot", "Soni", "Tushum"]}
                rows={report.topProducts.map((row) => [
                  row.productName,
                  formatQuantity(row.quantity),
                  formatMoney(row.amount),
                ])}
              />
            </Panel>

            <Panel title="Kategoriya sotuvlari" subtitle="Joriy product-category bog'lanishi asosida">
              <DataTable
                empty="Bu davrda kategoriya sotuvlari yo'q."
                headers={["Kategoriya", "Soni", "Tushum"]}
                rows={report.categorySales.map((row) => [
                  row.category.name,
                  formatQuantity(row.quantity),
                  formatMoney(row.amount),
                ])}
              />
            </Panel>
          </section>

          <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <Panel title="To'lovlar kesimi" subtitle={branchName}>
              <div className="grid gap-3">
                {report.paymentBreakdown.length ? (
                  report.paymentBreakdown.map((row) => (
                    <BreakdownRow
                      key={row.paymentMethod.id}
                      label={row.paymentMethod.name}
                      value={formatMoney(row.amount)}
                      detail={`${row.paymentMethod.code} · ${row.count} ta`}
                    />
                  ))
                ) : (
                  <EmptyState title="Bu davrda tasdiqlangan to'lov yozuvi yo'q." />
                )}
              </div>
            </Panel>

            <aside className="grid content-start gap-3">
              <Readiness
                title="Hisoblash qoidasi"
                items={[
                  "Faqat PAID/SUCCESS to'lovlar sotuvga kiradi",
                  "Bekor qilingan, failed, pending va unpaid buyurtmalar tushumga kirmaydi",
                  `Timezone: ${report.period.timezone}`,
                ]}
              />
              <Readiness
                title="N/A"
                items={[report.refundHandling.note, report.limitations.onlinePayments, report.limitations.categorySales]}
                muted
              />
            </aside>
          </section>
        </>
      ) : null}
    </div>
  );
}

async function loadSalesReport(query: {
  preset: string;
  branchId?: string;
  source?: string;
  from?: string;
  to?: string;
  year?: string;
}): Promise<SalesReport> {
  const params = new URLSearchParams({ preset: query.preset });

  if (query.branchId) {
    params.set("branchId", query.branchId);
  }

  if (query.source) {
    params.set("source", query.source);
  }

  if (query.preset === "custom" && query.from && query.to) {
    params.set("from", query.from);
    params.set("to", query.to);
  }

  if (query.preset === "year" && query.year) {
    params.set("year", query.year);
  }

  return apiFetch<SalesReport>(`/reports/sales?${params.toString()}`);
}

function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatMoney(value: MoneyValue): string {
  if (value === null || value === undefined) {
    return "N/A";
  }

  return `${formatter.format(Math.round(Number(value || 0)))} so'm`;
}

function formatMaybeMoney(value: MoneyValue): string {
  return value === null || value === undefined ? "N/A" : formatMoney(value);
}

function formatQuantity(value: string | number): string {
  const numeric = Number(value || 0);
  return `${formatter.format(Number.isInteger(numeric) ? numeric : Number(numeric.toFixed(3)))} ta`;
}

function employeeName(employee: { employeeCode: string; firstName: string; lastName?: string | null }) {
  return [employee.firstName, employee.lastName].filter(Boolean).join(" ") || employee.employeeCode;
}

function Metric({ label, muted, value }: { label: string; muted?: boolean; value: string }) {
  return (
    <article className="rounded-mz-card border border-mz-border bg-mz-surface p-5 shadow-mz-card">
      <p className="text-sm font-bold text-mz-text-muted">{label}</p>
      <p className={`mt-3 text-2xl font-black ${muted ? "text-mz-text-muted" : "text-mz-text"}`}>{value}</p>
    </article>
  );
}

function Panel({ children, subtitle, title }: { children: React.ReactNode; subtitle?: string; title: string }) {
  return (
    <section className="rounded-mz-card border border-mz-border bg-mz-surface p-5 shadow-mz-card">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-mz-text">{title}</p>
          {subtitle ? <p className="mt-1 text-sm font-semibold text-mz-text-muted">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function QuickRange({ active, label, onClick }: { active?: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`rounded-full border px-4 py-2 text-sm font-black shadow-sm transition ${
        active
          ? "border-mz-primary bg-mz-primary text-mz-text"
          : "border-mz-border bg-mz-surface text-mz-teal-700 hover:bg-mz-surface-sunken"
      }`}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function BreakdownRow({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-mz-control bg-mz-surface-sunken px-4 py-3 text-sm">
      <div>
        <p className="font-black text-mz-text">{label}</p>
        <p className="text-xs font-semibold text-mz-text-muted">{detail}</p>
      </div>
      <span className="text-right font-black text-mz-text">{value}</span>
    </div>
  );
}

function ChartRow({ detail, label, value, width }: { detail: string; label: string; value: string; width: string }) {
  return (
    <div className="grid gap-1 rounded-mz-control bg-mz-surface-sunken p-3">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-black text-mz-text">{label}</span>
        <span className="text-right font-black text-mz-text">{value}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-mz-surface">
        <div className="h-full rounded-full bg-mz-primary" style={{ width }} />
      </div>
      <p className="text-xs font-semibold text-mz-text-muted">{detail}</p>
    </div>
  );
}

/*
 * Hisobot jadvali.
 *
 * DESIGN_RULES: kichik ekranda jadval gorizontal overflow bermasdan
 * transformatsiya qilinishi kerak — shuning uchun `md` dan pastda
 * har bir qator label/value kartochkasiga aylanadi.
 */
function DataTable({ empty, headers, rows }: { empty: string; headers: string[]; rows: string[][] }) {
  if (!rows.length) {
    return <EmptyState title={empty} />;
  }

  return (
    <>
      <div className="mz-thin-scrollbar hidden overflow-x-auto md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-mz-text-muted">
            <tr>
              {headers.map((header) => (
                <th className="whitespace-nowrap border-b border-mz-border px-3 py-2 font-black" key={header}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr className="border-b border-mz-border last:border-0" key={`${row[0]}-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td className={`px-3 py-3 ${cellIndex === 0 ? "font-black text-mz-text" : "font-semibold text-mz-text-muted"}`} key={`${cell}-${cellIndex}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="grid gap-2 md:hidden">
        {rows.map((row, rowIndex) => (
          <li
            className="rounded-mz-control border border-mz-border bg-mz-surface p-3"
            key={`${row[0]}-${rowIndex}`}
          >
            <p className="mb-1.5 text-sm font-bold text-mz-text">{row[0]}</p>
            <dl className="grid gap-1">
              {row.slice(1).map((cell, cellIndex) => (
                <div className="flex items-start justify-between gap-3" key={`${cell}-${cellIndex}`}>
                  <dt className="text-xs font-medium text-mz-text-muted">
                    {headers[cellIndex + 1] ?? ""}
                  </dt>
                  <dd className="text-right text-xs font-semibold text-mz-text">{cell}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

function Readiness({ items, muted, title }: { items: string[]; muted?: boolean; title: string }) {
  return (
    <section className="rounded-mz-card border border-mz-border bg-mz-surface p-5 shadow-mz-card">
      <p className={`text-sm font-black ${muted ? "text-mz-text-muted" : "text-mz-text"}`}>{title}</p>
      <ul className="mt-3 grid gap-2 text-sm font-semibold text-mz-text-muted">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
