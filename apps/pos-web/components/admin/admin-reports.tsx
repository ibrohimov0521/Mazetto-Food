"use client";

import { useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useApiResource } from "../../lib/use-api-resource";
import { reportQueryParams, type ReportQuery } from "../../lib/report-query";
import { formatMoney } from "../../lib/order-display";
import { hasPermission } from "../../lib/auth";
import { useAuth } from "../auth/auth-provider";
import { Badge } from "../admin-ui/badge";
import { Card, CardBody, CardHeader } from "../admin-ui/card";
import { DataTable, type DataTableColumn } from "../admin-ui/data-table";
import { EmptyState, ErrorState, SkeletonRows } from "../admin-ui/feedback";
import { FormField, Select, TextInput } from "../admin-ui/form";
import { InfoBox, StatBox, StatGrid } from "../admin-ui/stat-box";
import { ChipGroup, Tabs, type TabItem } from "../admin-ui/tabs";
import {
  EmployeeReportView,
  ExpenseReportView,
  ProductReportView,
  ZReportView,
  moneyCell,
  numberCell,
  reportDateLabel,
} from "./admin-report-views";

type Branch = {
  id: string;
  name: string;
  address?: string | null;
};

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
    cashier: {
      id: string;
      employeeCode: string;
      firstName: string;
      lastName?: string | null;
    };
    amount: string;
    orderCount: number;
  }[];
  shiftBreakdown: {
    id: string;
    branch: { id: string; code: string; name: string };
    cashier: {
      id: string;
      employeeCode: string;
      firstName: string;
      lastName?: string | null;
    };
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

const countFormatter = new Intl.NumberFormat("uz-UZ");

function formatCount(value: string | number): string {
  const numeric = Number(value || 0);

  if (!Number.isFinite(numeric)) {
    return "—";
  }

  return `${countFormatter.format(
    Number.isInteger(numeric) ? numeric : Number(numeric.toFixed(3)),
  )} ta`;
}

const yearOptions = Array.from(
  { length: 5 },
  (_, index) => new Date().getFullYear() - index,
);

const sourceLabels: Record<"WEB" | "TELEGRAM" | "POS", string> = {
  WEB: "Web",
  TELEGRAM: "Telegram",
  POS: "Kassa",
};

/*
 * Beshta hisobot, beshta permission.
 *
 * `/reports/z` savdo hisobotining kengaytmasi, shuning uchun u ham
 * `REPORT_SALES_VIEW` ostida — backend'da ham xuddi shunday.
 *
 * Ruxsati yo'q tab UMUMAN ko'rsatilmaydi: bo'sh tab ochib "ruxsat yo'q"
 * deyish foydalanuvchini bekorga yuboradi.
 */
const reportTabs: (TabItem & { permission: string })[] = [
  {
    key: "sales",
    label: "Savdo",
    icon: "chart",
    permission: "REPORT_SALES_VIEW",
  },
  {
    key: "products",
    label: "Mahsulotlar",
    icon: "utensils",
    permission: "REPORT_PRODUCTS_VIEW",
  },
  {
    key: "employees",
    label: "Xodimlar",
    icon: "users",
    permission: "REPORT_EMPLOYEES_VIEW",
  },
  {
    key: "expenses",
    label: "Xarajatlar",
    icon: "banknote",
    permission: "REPORT_EXPENSES_VIEW",
  },
  {
    key: "z",
    label: "Z-hisobot",
    icon: "scroll",
    permission: "REPORT_SALES_VIEW",
  },
];

/*
 * Sana oralig'i — BITTA boshqaruv.
 *
 * Ilgari ekranda ikkita bor edi: chiplar darhol qo'llanardi, select esa
 * "Ko'rish" bosilishini kutardi. Ikkisi bir-birini yangilamagani uchun
 * ekranda "Bu oy" turib, ma'lumot "Bugun" bo'lishi mumkin edi. Endi faqat
 * chiplar qoldi va BARCHA filtr darhol qo'llanadi — "Ko'rish" tugmasi ham
 * shu bilan yo'qoldi.
 */
const reportPresets: TabItem[] = [
  { key: "today", label: "Bugun" },
  { key: "yesterday", label: "Kecha" },
  { key: "last7days", label: "7 kun" },
  { key: "thisMonth", label: "Bu oy" },
  { key: "year", label: "Yil" },
  { key: "custom", label: "Maxsus" },
];

function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function employeeName(employee: {
  employeeCode: string;
  firstName: string;
  lastName?: string | null;
}): string {
  return (
    [employee.firstName, employee.lastName].filter(Boolean).join(" ") ||
    employee.employeeCode
  );
}

export function AdminReportsPage() {
  const { user } = useAuth();
  const visibleTabs = useMemo(
    () => reportTabs.filter((item) => hasPermission(user, item.permission)),
    [user],
  );
  /*
   * Birinchi RUXSAT BERILGAN tab. Ilgari "sales" qotib qo'yilgan edi:
   * `REPORT_SALES_VIEW` yo'q buxgalter bo'sh ekran ko'rardi va sahifa
   * baribir `/reports/sales` ga so'rov yuborib 403 olardi.
   */
  const [tab, setTab] = useState(visibleTabs[0]?.key ?? "sales");
  const activeTab = visibleTabs.some((item) => item.key === tab)
    ? tab
    : (visibleTabs[0]?.key ?? "");

  const [branchId, setBranchId] = useState("");
  const [source, setSource] = useState("");
  const [preset, setPreset] = useState("today");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [from, setFrom] = useState(() => toDateInput(new Date()));
  const [to, setTo] = useState(() => toDateInput(new Date()));

  const { data: branches } = useApiResource<Branch[]>(
    () => apiFetch<Branch[]>("/branches"),
    [],
    "Filiallarni yuklab bo'lmadi.",
  );
  const branchOptions = branches ?? [];

  /*
   * Maxsus oraliq xatosi INLINE ko'rsatiladi va so'rov yuborilmaydi.
   * Toast bu yerda yaramaydi: xato aynan qaysi maydonda ekanini aytmaydi.
   */
  const rangeError =
    preset === "custom" && from && to && from > to
      ? "Boshlanish sanasi tugash sanasidan keyin bo'lmasligi kerak."
      : "";
  const isRangeIncomplete = preset === "custom" && (!from || !to);

  const query = useMemo<ReportQuery>(
    () => ({ preset, branchId, source, from, to, year }),
    [branchId, from, preset, source, to, year],
  );
  const queryKey = reportQueryParams(query).toString();
  const isQueryReady = !rangeError && !isRangeIncomplete;

  const {
    data: report,
    isLoading,
    error,
    reload,
  } = useApiResource<SalesReport | null>(
    () =>
      isQueryReady && activeTab === "sales"
        ? apiFetch<SalesReport>(`/reports/sales?${queryKey}`)
        : Promise.resolve(null),
    [queryKey, isQueryReady, activeTab],
    "Savdo hisobotini yuklab bo'lmadi.",
  );

  const branchName =
    branchOptions.find((branch) => branch.id === branchId)?.name ??
    "Barcha ruxsat berilgan filiallar";
  const sourceName = source
    ? sourceLabels[source as keyof typeof sourceLabels]
    : "Barcha kanallar";

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader
          description="Filtr darhol qo'llanadi — barcha hisobot tablari shu oraliqni ishlatadi"
          title="Hisobot oralig'i"
        />
        <CardBody className="grid gap-3">
          <ChipGroup
            active={preset}
            items={reportPresets}
            label="Sana oralig'i"
            onChange={setPreset}
          />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {preset === "custom" ? (
              <>
                <FormField
                  error={rangeError}
                  label="Boshlanish sanasi"
                  required
                >
                  {(props) => (
                    <TextInput
                      {...props}
                      onChange={(event) => setFrom(event.target.value)}
                      type="date"
                      value={from}
                    />
                  )}
                </FormField>
                <FormField label="Tugash sanasi" required>
                  {(props) => (
                    <TextInput
                      {...props}
                      onChange={(event) => setTo(event.target.value)}
                      type="date"
                      value={to}
                    />
                  )}
                </FormField>
              </>
            ) : null}

            {preset === "year" ? (
              <FormField label="Yil">
                {(props) => (
                  <Select
                    {...props}
                    onChange={(event) => setYear(event.target.value)}
                    value={year}
                  >
                    {yearOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            ) : null}

            <FormField label="Filial">
              {(props) => (
                <Select
                  {...props}
                  onChange={(event) => setBranchId(event.target.value)}
                  value={branchId}
                >
                  <option value="">Barcha ruxsat berilgan filiallar</option>
                  {branchOptions.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>

            <FormField label="Kanal">
              {(props) => (
                <Select
                  {...props}
                  onChange={(event) => setSource(event.target.value)}
                  value={source}
                >
                  <option value="">Barcha kanallar</option>
                  <option value="WEB">Web</option>
                  <option value="TELEGRAM">Telegram</option>
                  <option value="POS">Kassa</option>
                </Select>
              )}
            </FormField>
          </div>
        </CardBody>
      </Card>

      {visibleTabs.length > 1 ? (
        <Tabs
          active={activeTab}
          items={visibleTabs}
          label="Hisobot turi"
          onChange={setTab}
          panelId="report-panel"
        />
      ) : null}

      {/* `role="tab"` bog'liq panelni talab qiladi — Tabs unga `aria-controls` bilan ishora qiladi. */}
      <div className="grid gap-5" id="report-panel" role="tabpanel">
        {visibleTabs.length === 0 ? (
          <EmptyState
            description="Hisobot ko'rish uchun ruxsat berilmagan."
            icon="shield"
            title="Ruxsat yo'q"
          />
        ) : null}

        {activeTab === "products" ? <ProductReportView query={query} /> : null}
        {activeTab === "employees" ? <EmployeeReportView query={query} /> : null}
        {activeTab === "expenses" ? <ExpenseReportView query={query} /> : null}
        {activeTab === "z" ? <ZReportView query={query} /> : null}

        {activeTab === "sales" ? (
          <>
            {error ? (
              <ErrorState message={error} onRetry={() => void reload()} />
            ) : null}

            {!isQueryReady ? (
              <EmptyState
                description={
                  rangeError ||
                  "Maxsus oraliq uchun boshlanish va tugash sanasini tanlang."
                }
                icon="filter"
                title="Oraliq to'liq emas"
              />
            ) : isLoading ? (
              <SkeletonRows rows={8} />
            ) : !report ? (
              !error ? (
                <EmptyState
                  description="Filtrni o'zgartirib qayta urinib ko'ring."
                  icon="chart"
                  title="Hisobot yo'q"
                />
              ) : null
            ) : (
              <SalesReportBody
                branchName={branchName}
                report={report}
                sourceName={sourceName}
              />
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

function SalesReportBody({
  branchName,
  report,
  sourceName,
}: {
  branchName: string;
  report: SalesReport;
  sourceName: string;
}) {
  const shiftColumns: DataTableColumn<
    SalesReport["shiftBreakdown"][number]
  >[] = [
    {
      key: "shift",
      header: "Smena",
      primary: true,
      render: (shift) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-mz-text">
            {shift.branch.name} #{shift.shiftNumber}
          </p>
          <p className="truncate text-[13px] text-mz-text-muted">
            {employeeName(shift.cashier)}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Holat",
      render: (shift) => (
        <Badge tone={shift.status === "OPEN" ? "info" : "neutral"} withDot>
          {shift.status === "OPEN" ? "Ochiq" : "Yopilgan"}
        </Badge>
      ),
    },
    {
      key: "orders",
      header: "Buyurtma",
      align: "right",
      hideOnMobile: true,
      render: (shift) => (
        <span className={numberCell}>{formatCount(shift.orderCount)}</span>
      ),
    },
    {
      key: "gross",
      header: "Tushum",
      align: "right",
      render: (shift) => (
        <span className={moneyCell}>{formatMoney(shift.grossSales)}</span>
      ),
    },
    {
      key: "expected",
      header: "Kutilgan naqd",
      align: "right",
      hideOnMobile: true,
      render: (shift) => (
        <span className={numberCell}>{formatMoney(shift.expectedCash)}</span>
      ),
    },
    {
      key: "actual",
      header: "Topshirilgan",
      align: "right",
      hideOnMobile: true,
      render: (shift) => (
        <span className={numberCell}>{formatMoney(shift.actualCash)}</span>
      ),
    },
    {
      key: "difference",
      header: "Farq",
      align: "right",
      render: (shift) => <CashDifference value={shift.cashDifference} />,
    },
  ];

  const branchColumns: DataTableColumn<
    SalesReport["branchBreakdown"][number]
  >[] = [
    {
      key: "branch",
      header: "Filial",
      primary: true,
      render: (row) => (
        <span className="font-semibold text-mz-text">{row.branch.name}</span>
      ),
    },
    {
      key: "orders",
      header: "Buyurtma",
      align: "right",
      render: (row) => (
        <span className={numberCell}>{formatCount(row.orderCount)}</span>
      ),
    },
    {
      key: "amount",
      header: "Tushum",
      align: "right",
      render: (row) => <span className={moneyCell}>{formatMoney(row.amount)}</span>,
    },
  ];

  const cashierColumns: DataTableColumn<
    SalesReport["cashierBreakdown"][number]
  >[] = [
    {
      key: "cashier",
      header: "Kassir",
      primary: true,
      render: (row) => (
        <span className="font-semibold text-mz-text">
          {employeeName(row.cashier)}
        </span>
      ),
    },
    {
      key: "orders",
      header: "Buyurtma",
      align: "right",
      render: (row) => (
        <span className={numberCell}>{formatCount(row.orderCount)}</span>
      ),
    },
    {
      key: "amount",
      header: "Tushum",
      align: "right",
      render: (row) => <span className={moneyCell}>{formatMoney(row.amount)}</span>,
    },
  ];

  const productColumns: DataTableColumn<SalesReport["topProducts"][number]>[] = [
    {
      key: "product",
      header: "Mahsulot",
      primary: true,
      render: (row) => (
        <span className="font-semibold text-mz-text">{row.productName}</span>
      ),
    },
    {
      key: "quantity",
      header: "Soni",
      align: "right",
      render: (row) => (
        <span className={numberCell}>{formatCount(row.quantity)}</span>
      ),
    },
    {
      key: "amount",
      header: "Tushum",
      align: "right",
      render: (row) => <span className={moneyCell}>{formatMoney(row.amount)}</span>,
    },
  ];

  const categoryColumns: DataTableColumn<
    SalesReport["categorySales"][number]
  >[] = [
    {
      key: "category",
      header: "Kategoriya",
      primary: true,
      render: (row) => (
        <span className="font-semibold text-mz-text">{row.category.name}</span>
      ),
    },
    {
      key: "quantity",
      header: "Soni",
      align: "right",
      render: (row) => (
        <span className={numberCell}>{formatCount(row.quantity)}</span>
      ),
    },
    {
      key: "amount",
      header: "Tushum",
      align: "right",
      render: (row) => <span className={moneyCell}>{formatMoney(row.amount)}</span>,
    },
  ];

  const paymentColumns: DataTableColumn<
    SalesReport["paymentBreakdown"][number]
  >[] = [
    {
      key: "method",
      header: "To'lov usuli",
      primary: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-mz-text">
            {row.paymentMethod.name}
          </p>
          <p className="truncate text-[13px] text-mz-text-muted">
            {row.paymentMethod.code}
          </p>
        </div>
      ),
    },
    {
      key: "count",
      header: "Soni",
      align: "right",
      render: (row) => <span className={numberCell}>{formatCount(row.count)}</span>,
    },
    {
      key: "amount",
      header: "Summa",
      align: "right",
      render: (row) => <span className={moneyCell}>{formatMoney(row.amount)}</span>,
    },
  ];

  const sourceColumns: DataTableColumn<
    SalesReport["sourceBreakdown"][number]
  >[] = [
    {
      key: "source",
      header: "Kanal",
      primary: true,
      render: (row) => (
        <span className="font-semibold text-mz-text">
          {sourceLabels[row.source]}
        </span>
      ),
    },
    {
      key: "orders",
      header: "Buyurtma",
      align: "right",
      render: (row) => (
        <span className={numberCell}>{formatCount(row.orderCount)}</span>
      ),
    },
    {
      key: "payments",
      header: "To'lov",
      align: "right",
      hideOnMobile: true,
      render: (row) => (
        <span className={numberCell}>{formatCount(row.paymentCount)}</span>
      ),
    },
    {
      key: "amount",
      header: "Summa",
      align: "right",
      render: (row) => <span className={moneyCell}>{formatMoney(row.amount)}</span>,
    },
  ];

  return (
    <>
      <StatGrid>
        <StatBox
          icon="wallet"
          label="Jami savdo"
          tone="brand"
          value={formatMoney(report.totalSales)}
        />
        <StatBox
          icon="receipt"
          label="Buyurtmalar soni"
          value={formatCount(report.orderCount)}
        />
        <StatBox
          icon="chart"
          label="O'rtacha chek"
          value={formatMoney(report.averageOrderValue)}
        />
        <StatBox
          icon="banknote"
          label="Naqd sotuv"
          value={formatMoney(report.cashSales)}
        />
      </StatGrid>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <InfoBox
          description="Tushumga kirmaydi"
          icon="close"
          label="Bekor qilingan"
          tone={report.cancelledOrders > 0 ? "warning" : "neutral"}
          value={formatCount(report.cancelledOrders)}
        />
        <InfoBox
          description={
            report.refundHandling.supported
              ? "Tushumdan ayirilgan"
              : "Hisoblanmaydi"
          }
          icon="arrowDown"
          label="Qaytarilgan"
          tone={report.refundHandling.supported ? "neutral" : "warning"}
          value={
            report.refundHandling.supported
              ? formatMoney(report.refundHandling.amount)
              : "N/A"
          }
        />
        <InfoBox
          description={`${report.period.from.slice(0, 10)} — ${report.period.to.slice(0, 10)} · ${report.period.timezone}`}
          icon="clock"
          label="Oraliq"
          value={
            reportPresets.find((item) => item.key === report.period.preset)
              ?.label ?? report.period.preset
          }
        />
      </div>

      <Card>
        <CardHeader
          description={`${branchName} · ${sourceName}`}
          title={`${report.timeSeries.grain === "month" ? "Oyma-oy" : "Kunma-kun"} sotuv grafigi`}
        />
        {report.timeSeries.data.length ? (
          <CardBody className="grid gap-4">
            <SalesChart
              data={report.timeSeries.data}
              grain={report.timeSeries.grain}
            />

            {/*
             * Grafik o'zi bezak (`aria-hidden`), raqamlar esa shu jadvalda —
             * ilgari butun oraliq 70px lik qatorlar ro'yxati edi va 30 kunlik
             * oraliq ~2100px scroll bo'lardi.
             */}
            <details className="rounded-mz-control border border-mz-border">
              <summary className="flex min-h-10 cursor-pointer items-center px-3 text-[13px] font-semibold text-mz-text">
                Raqamlar jadvali ({report.timeSeries.data.length} nuqta)
              </summary>
              <div className="border-t border-mz-border">
                <DataTable
                  caption="Sotuv grafigi raqamlari"
                  columns={[
                    {
                      key: "date",
                      header: "Sana",
                      primary: true,
                      render: (row) => (
                        <span className={numberCell}>
                          {reportDateLabel(row.date, report.timeSeries.grain)}
                        </span>
                      ),
                    },
                    {
                      key: "orders",
                      header: "Buyurtma",
                      align: "right",
                      render: (row) => (
                        <span className={numberCell}>
                          {formatCount(row.orderCount)}
                        </span>
                      ),
                    },
                    {
                      key: "amount",
                      header: "Tushum",
                      align: "right",
                      render: (row) => (
                        <span className={moneyCell}>
                          {formatMoney(row.amount)}
                        </span>
                      ),
                    },
                  ]}
                  getRowKey={(row) => row.date}
                  rows={report.timeSeries.data}
                  scrollHeightClass="max-h-96"
                />
              </div>
            </details>
          </CardBody>
        ) : (
          <EmptyState
            description="Tanlangan oraliqda tasdiqlangan to'lov yozuvi topilmadi."
            icon="chart"
            title="Sotuv yo'q"
          />
        )}
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader description={branchName} title="To'lovlar kesimi" />
          <DataTable
            caption="To'lov usullari kesimi"
            columns={paymentColumns}
            emptyDescription="Bu oraliqda tasdiqlangan to'lov yozuvi yo'q."
            emptyIcon="wallet"
            emptyTitle="To'lov yo'q"
            getRowKey={(row) => row.paymentMethod.id}
            rows={report.paymentBreakdown}
          />
        </Card>

        <Card>
          <CardHeader
            description="Web · Telegram · Kassa"
            title="Kanal kesimi"
          />
          <DataTable
            caption="Kanal kesimi"
            columns={sourceColumns}
            emptyDescription="Bu oraliqda kanal kesimida sotuv yo'q."
            emptyIcon="globe"
            emptyTitle="Kanal ma'lumoti yo'q"
            getRowKey={(row) => row.source}
            rows={report.sourceBreakdown}
          />
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader
            description="Filial qamrovi qoidasi bilan cheklangan"
            title="Filiallar"
          />
          <DataTable
            caption="Filial kesimi"
            columns={branchColumns}
            emptyDescription="Bu oraliqda filial kesimida sotuv yo'q."
            emptyIcon="building"
            emptyTitle="Filial ma'lumoti yo'q"
            getRowKey={(row) => row.branch.id}
            rows={report.branchBreakdown}
          />
        </Card>

        <Card>
          <CardHeader description="Faqat kassa sotuvlari" title="Kassirlar" />
          <DataTable
            caption="Kassir kesimi"
            columns={cashierColumns}
            emptyDescription="Bu oraliqda kassa sotuvi qayd etilmagan."
            emptyIcon="users"
            emptyTitle="Kassir ma'lumoti yo'q"
            getRowKey={(row) => row.cashier.id}
            rows={report.cashierBreakdown}
          />
        </Card>
      </div>

      <Card>
        <CardHeader
          description="Yopilgan smenada saqlangan qiymat, ochiq smenada joriy to'lovlar asosida"
          title="Smenalar"
        />
        <DataTable
          caption="Smena kesimi"
          columns={shiftColumns}
          emptyDescription="Bu oraliqda smena ma'lumoti yo'q."
          emptyIcon="clock"
          emptyTitle="Smena yo'q"
          getRowKey={(shift) => shift.id}
          rows={report.shiftBreakdown}
        />
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader
            description="Buyurtma yozuvidagi nomlar asosida"
            title="Top mahsulotlar"
          />
          <DataTable
            caption="Top mahsulotlar"
            columns={productColumns}
            emptyDescription="Bu oraliqda mahsulot sotuvi yo'q."
            emptyIcon="utensils"
            emptyTitle="Mahsulot yo'q"
            getRowKey={(row) => row.productId ?? row.productName}
            rows={report.topProducts}
          />
        </Card>

        <Card>
          <CardHeader
            description="Joriy mahsulot-kategoriya bog'lanishi asosida"
            title="Kategoriya sotuvlari"
          />
          <DataTable
            caption="Kategoriya sotuvlari"
            columns={categoryColumns}
            emptyDescription="Bu oraliqda kategoriya sotuvi yo'q."
            emptyIcon="folder"
            emptyTitle="Kategoriya yo'q"
            getRowKey={(row) => row.category.id ?? row.category.code}
            rows={report.categorySales}
          />
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader
            description="Raqamlar qanday hisoblanadi"
            title="Hisoblash qoidasi"
          />
          <CardBody>
            <ul className="grid gap-2 text-sm text-mz-text">
              <li>{report.salesRule.basis}</li>
              <li>
                Sotuvga kiradigan to'lov holatlari:{" "}
                {report.salesRule.paymentStatuses.join(", ")}
              </li>
              <li>
                Kiritilmaydigan buyurtma holatlari:{" "}
                {report.salesRule.excludedOrderStatuses.join(", ")}
              </li>
              <li>Vaqt mintaqasi: {report.period.timezone}</li>
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            description="Bu raqamlar hali hisoblanmaydi"
            title="Cheklovlar"
          />
          <CardBody>
            <ul className="grid gap-2 text-sm text-mz-text-muted">
              <li>{report.refundHandling.note}</li>
              <li>{report.limitations.onlinePayments}</li>
              <li>{report.limitations.categorySales}</li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

/**
 * Kassa farqi.
 *
 * DESIGN_RULES: KAMOMAD hech qachon muvaffaqiyat rangida ko'rsatilmaydi.
 * Ortiqcha pul ham normal emas — u OGOHLANTIRISH, chunki u ham hisobot
 * xatosi yoki qayd etilmagan tushum belgisi.
 */
function CashDifference({ value }: { value: string | null | undefined }) {
  if (value === null || value === undefined) {
    return <span className="text-mz-text-faint">—</span>;
  }

  const difference = Number(value);

  if (!Number.isFinite(difference)) {
    return <span className="text-mz-text-faint">—</span>;
  }

  if (Math.abs(difference) < 0.01) {
    return <span className="tabular-nums text-mz-success">To&apos;g&apos;ri</span>;
  }

  return (
    <span
      className={`tabular-nums font-semibold ${
        difference < 0 ? "text-mz-danger" : "text-mz-warning"
      }`}
    >
      {difference > 0 ? "+" : ""}
      {formatMoney(difference)}
    </span>
  );
}

/**
 * Ustunli grafik.
 *
 * Ilgari har nuqta ~70px balandlikdagi alohida qator edi, ya'ni 30 kunlik
 * oraliq ~2100px vertikal scroll bo'lardi va yorliq sifatida xom ISO sana
 * turardi. Endi bu bitta ustunli grafik: yorliqlar qisqa sana, ma'lumot
 * esa yonidagi jadvalda — grafikning o'zi `aria-hidden`.
 */
function SalesChart({
  data,
  grain,
}: {
  data: { date: string; amount: string; orderCount: number }[];
  grain: "day" | "month";
}) {
  const max = Math.max(...data.map((row) => Number(row.amount) || 0), 1);
  /* Ko'p nuqtada har bir yorliqni chizish o'qilmas bo'ladi — har N-chisi. */
  const labelStep = data.length > 14 ? Math.ceil(data.length / 10) : 1;

  return (
    <div className="mz-thin-scrollbar overflow-x-auto pb-1">
      <div
        aria-hidden="true"
        className="flex items-end gap-1.5"
        style={{ minWidth: `${Math.max(data.length * 28, 240)}px` }}
      >
        {data.map((row, index) => {
          const amount = Number(row.amount) || 0;
          const height = Math.max(2, Math.round((amount / max) * 100));

          return (
            <div
              className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
              key={row.date}
            >
              <div className="flex h-40 w-full items-end">
                <div
                  className="w-full rounded-t-mz-control bg-mz-primary"
                  style={{ height: `${height}%` }}
                  title={`${reportDateLabel(row.date, grain)} · ${formatMoney(row.amount)}`}
                />
              </div>
              <span className="h-4 whitespace-nowrap text-[13px] tabular-nums text-mz-text-muted">
                {index % labelStep === 0 ? reportDateLabel(row.date, grain) : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
