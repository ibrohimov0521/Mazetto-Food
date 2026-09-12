"use client";

import { apiFetch } from "../../lib/api";
import { useApiResource } from "../../lib/use-api-resource";
import { reportQueryParams, type ReportQuery } from "../../lib/report-query";
import { formatMoney } from "../../lib/order-display";
import { Card, CardHeader } from "../admin-ui/card";
import { DataTable, type DataTableColumn } from "../admin-ui/data-table";
import { ErrorState, SkeletonRows } from "../admin-ui/feedback";
import { InfoBox, StatGrid } from "../admin-ui/stat-box";

/*
 * Savdo hisobotidan tashqari to'rt hisobot.
 *
 * `/reports/products`, `/reports/employees`, `/reports/expenses` va
 * `/reports/z` allaqachon qurilgan edi va admin panelda birortasining ekrani
 * yo'q edi — beshta hisobotdan faqat bittasi ko'rinardi.
 *
 * Har biri o'z permission'i ostida: tab ro'yxati chaqiruvchi tomonda
 * filtrlanadi (`admin-reports.tsx`), bu yerda esa faqat ko'rsatish.
 *
 * Sana oralig'i va Asia/Tashkent mantig'i backend'da — bu yerda hech qanday
 * sana hisoblanmaydi.
 */

/*
 * Pul va son kataklari.
 *
 * DESIGN_RULES: "Money and counts use `font-variant-numeric: tabular-nums`
 * and right alignment in tables." Proporsional raqamda ustundagi summalar
 * bir-biriga nisbatan siljib ketadi va ko'z ularni ustunma-ustun
 * solishtira olmaydi.
 *
 * `admin-ui` da bunday primitiv yo'q va uni qo'shishga ruxsat berilmagan,
 * shuning uchun bu ikki klass shu yerda turadi va MONEY/STOCK ekranlari
 * shuni import qiladi.
 */
export const moneyCell = "tabular-nums font-semibold text-mz-text";
export const numberCell = "tabular-nums text-mz-text";

/*
 * Hisobot sanasi yorlig'i.
 *
 * Grafik va jadval yorliqlari uchun: xom ISO sana ("2026-09-12") yorliq
 * sifatida o'qilmaydi. Mintaqa QAT'IY Asia/Tashkent — `toLocaleDateString`
 * brauzer mintaqasini olardi va bitta ekranda ikki xil sana chiqishi
 * mumkin edi.
 */
const dayLabelFormatter = new Intl.DateTimeFormat("uz-UZ", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Tashkent",
});
const monthLabelFormatter = new Intl.DateTimeFormat("uz-UZ", {
  month: "short",
  year: "2-digit",
  timeZone: "Asia/Tashkent",
});
const dateFormatter = new Intl.DateTimeFormat("uz-UZ", {
  dateStyle: "short",
  timeZone: "Asia/Tashkent",
});

export function reportDateLabel(
  value: string,
  grain: "day" | "month" = "day",
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return grain === "month"
    ? monthLabelFormatter.format(date)
    : dayLabelFormatter.format(date);
}

export function reportDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

const countFormatter = new Intl.NumberFormat("uz-UZ");

/** Miqdor — butun bo'lsa butun, aks holda 3 kasr. */
function decimal(value: unknown): string {
  const numeric = Number(value ?? 0);

  if (!Number.isFinite(numeric)) {
    return "—";
  }

  return countFormatter.format(
    Number.isInteger(numeric) ? numeric : Number(numeric.toFixed(3)),
  );
}

/** Hisobotni yuklab, yuklanish va xato holatini boshqaradigan umumiy ilgak. */
function useReport<T>(path: string, query: ReportQuery) {
  const key = reportQueryParams(query).toString();

  const {
    data,
    isLoading,
    error,
    reload: load,
  } = useApiResource<T>(
    () => apiFetch<T>(`${path}?${key}`),
    [key, path],
    "Hisobotni yuklab bo'lmadi.",
  );

  return { data, error, isLoading, reload: load };
}

type ProductReport = {
  products: {
    productId: string;
    productName: string;
    quantitySold: string;
    revenue: string;
    itemCount: number;
  }[];
};

export function ProductReportView({ query }: { query: ReportQuery }) {
  const { data, error, isLoading, reload } = useReport<ProductReport>(
    "/reports/products",
    query,
  );

  if (isLoading) {
    return <SkeletonRows rows={8} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void reload()} />;
  }

  const products = data?.products ?? [];
  const revenue = products.reduce(
    (sum, item) => sum + Number(item.revenue ?? 0),
    0,
  );
  const quantity = products.reduce(
    (sum, item) => sum + Number(item.quantitySold ?? 0),
    0,
  );

  const columns: DataTableColumn<ProductReport["products"][number]>[] = [
    {
      key: "name",
      header: "Mahsulot",
      primary: true,
      render: (row) => (
        <span className="font-semibold text-mz-text">{row.productName}</span>
      ),
    },
    {
      key: "quantity",
      header: "Sotilgan",
      align: "right",
      render: (row) => (
        <span className={numberCell}>{decimal(row.quantitySold)}</span>
      ),
    },
    {
      key: "count",
      header: "Qator",
      align: "right",
      hideOnMobile: true,
      render: (row) => <span className={numberCell}>{row.itemCount}</span>,
    },
    {
      key: "revenue",
      header: "Tushum",
      align: "right",
      render: (row) => (
        <span className={moneyCell}>{formatMoney(row.revenue)}</span>
      ),
    },
  ];

  return (
    <div className="grid gap-4">
      <StatGrid>
        <InfoBox
          icon="utensils"
          label="Mahsulot turi"
          value={`${products.length} ta`}
        />
        <InfoBox
          icon="boxes"
          label="Sotilgan miqdor"
          value={decimal(quantity)}
        />
        <InfoBox
          icon="wallet"
          label="Tushum"
          tone="brand"
          value={formatMoney(revenue)}
        />
        <InfoBox
          icon="chart"
          label="Eng ko'p tushum"
          value={products[0]?.productName ?? "—"}
        />
      </StatGrid>

      <Card>
        <CardHeader
          description="Eng ko'p tushum keltirgan mahsulotlar birinchi"
          title="Mahsulotlar bo'yicha"
        />
        <DataTable
          caption="Mahsulot hisoboti"
          columns={columns}
          emptyDescription="Tanlangan oraliqda sotuv bo'lmagan."
          emptyIcon="utensils"
          emptyTitle="Ma'lumot yo'q"
          getRowKey={(row) => row.productId}
          rows={products}
        />
      </Card>
    </div>
  );
}

type EmployeeReport = {
  employees: {
    employee: {
      id: string;
      employeeCode: string;
      firstName: string;
      lastName?: string | null;
    } | null;
    ordersHandled: number;
    salesAmount: string;
    shifts: { id: string }[];
  }[];
};

export function EmployeeReportView({ query }: { query: ReportQuery }) {
  const { data, error, isLoading, reload } = useReport<EmployeeReport>(
    "/reports/employees",
    query,
  );

  if (isLoading) {
    return <SkeletonRows rows={8} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void reload()} />;
  }

  const rows = data?.employees ?? [];
  const sales = rows.reduce(
    (sum, row) => sum + Number(row.salesAmount ?? 0),
    0,
  );
  const orders = rows.reduce((sum, row) => sum + row.ordersHandled, 0);
  const shifts = rows.reduce((sum, row) => sum + row.shifts.length, 0);

  const columns: DataTableColumn<EmployeeReport["employees"][number]>[] = [
    {
      key: "employee",
      header: "Xodim",
      primary: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-mz-text">
            {row.employee
              ? `${row.employee.firstName} ${row.employee.lastName ?? ""}`.trim()
              : "Noma'lum xodim"}
          </p>
          <p className="truncate text-[13px] text-mz-text-muted">
            {row.employee?.employeeCode ?? "—"}
          </p>
        </div>
      ),
    },
    {
      key: "orders",
      header: "Buyurtma",
      align: "right",
      render: (row) => (
        <span className={numberCell}>{`${row.ordersHandled} ta`}</span>
      ),
    },
    {
      key: "shifts",
      header: "Smena",
      align: "right",
      hideOnMobile: true,
      render: (row) => (
        <span className={numberCell}>{`${row.shifts.length} ta`}</span>
      ),
    },
    {
      key: "sales",
      header: "Qabul qilgan to'lov",
      align: "right",
      render: (row) => (
        <span className={moneyCell}>{formatMoney(row.salesAmount)}</span>
      ),
    },
  ];

  return (
    <div className="grid gap-4">
      <StatGrid>
        <InfoBox icon="users" label="Xodim" value={`${rows.length} ta`} />
        <InfoBox icon="receipt" label="Buyurtma" value={`${orders} ta`} />
        <InfoBox icon="clock" label="Smena" value={`${shifts} ta`} />
        <InfoBox
          icon="wallet"
          label="Qabul qilingan"
          tone="brand"
          value={formatMoney(sales)}
        />
      </StatGrid>

      <Card>
        <CardHeader
          description="Buyurtma yaratgan va to'lov qabul qilgan xodimlar"
          title="Xodimlar bo'yicha"
        />
        <DataTable
          caption="Xodim hisoboti"
          columns={columns}
          emptyDescription="Tanlangan oraliqda faoliyat qayd etilmagan."
          emptyIcon="users"
          emptyTitle="Ma'lumot yo'q"
          /*
           * Javobda xodim ID si alohida maydon sifatida yo'q — faqat topilgan
           * `employee` yozuvi ichida. Topilmagan holat uchun smena ID siga
           * tayanamiz: u barqaror, `Math.random()` esa har renderda kalitni
           * o'zgartirib, qatorni qaytadan yaratardi.
           */
          getRowKey={(row) =>
            row.employee?.id ??
            `unknown-${row.shifts[0]?.id ?? row.ordersHandled}`
          }
          rows={rows}
        />
      </Card>
    </div>
  );
}

type ExpenseReport = {
  totalAmount: string;
  expenseCount: number;
  categories: { category: string; amount: string; count: number }[];
  expenses: {
    id: string;
    category: string;
    amount: string;
    description?: string | null;
    expenseDate: string;
  }[];
};

export function ExpenseReportView({ query }: { query: ReportQuery }) {
  const { data, error, isLoading, reload } = useReport<ExpenseReport>(
    "/reports/expenses",
    query,
  );

  if (isLoading) {
    return <SkeletonRows rows={8} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void reload()} />;
  }

  const categories = data?.categories ?? [];
  const expenses = data?.expenses ?? [];

  const categoryColumns: DataTableColumn<
    ExpenseReport["categories"][number]
  >[] = [
    {
      key: "category",
      header: "Kategoriya",
      primary: true,
      render: (row) => (
        <span className="font-semibold text-mz-text">{row.category}</span>
      ),
    },
    {
      key: "count",
      header: "Soni",
      align: "right",
      render: (row) => (
        <span className={numberCell}>{`${row.count} ta`}</span>
      ),
    },
    {
      key: "amount",
      header: "Summa",
      align: "right",
      render: (row) => (
        <span className={moneyCell}>{formatMoney(row.amount)}</span>
      ),
    },
  ];

  const expenseColumns: DataTableColumn<ExpenseReport["expenses"][number]>[] = [
    {
      key: "date",
      header: "Sana",
      primary: true,
      render: (row) => (
        <span className={numberCell}>{reportDate(row.expenseDate)}</span>
      ),
    },
    { key: "category", header: "Kategoriya", render: (row) => row.category },
    {
      key: "description",
      header: "Izoh",
      hideOnMobile: true,
      render: (row) => (
        <span className="text-mz-text-muted">{row.description ?? "—"}</span>
      ),
    },
    {
      key: "amount",
      header: "Summa",
      align: "right",
      render: (row) => (
        <span className={moneyCell}>{formatMoney(row.amount)}</span>
      ),
    },
  ];

  return (
    <div className="grid gap-4">
      <StatGrid>
        <InfoBox
          icon="banknote"
          label="Xarajat"
          value={`${data?.expenseCount ?? 0} ta`}
        />
        <InfoBox
          icon="folder"
          label="Kategoriya"
          value={`${categories.length} ta`}
        />
        <InfoBox
          icon="wallet"
          label="Jami"
          tone="brand"
          value={formatMoney(data?.totalAmount)}
        />
        <InfoBox
          icon="alert"
          label="Eng katta kategoriya"
          value={categories[0]?.category ?? "—"}
        />
      </StatGrid>

      <Card>
        <CardHeader
          description="Summa bo'yicha kamayish tartibida"
          title="Kategoriyalar"
        />
        <DataTable
          caption="Xarajat kategoriyalari"
          columns={categoryColumns}
          emptyIcon="banknote"
          emptyTitle="Xarajat yo'q"
          getRowKey={(row) => row.category}
          rows={categories}
        />
      </Card>

      <Card>
        <CardHeader
          description="Oraliqdagi barcha yozuvlar"
          title="Xarajatlar"
        />
        <DataTable
          caption="Xarajatlar ro'yxati"
          columns={expenseColumns}
          emptyIcon="banknote"
          emptyTitle="Xarajat yo'q"
          getRowKey={(row) => row.id}
          rows={expenses}
        />
      </Card>
    </div>
  );
}

type ZReport = {
  totalSales: string;
  cashSales: string | null;
  cardSales: string | null;
  clickSales: string | null;
  paymeSales: string | null;
  ordersCount: number;
  averageOrder: string;
  expenses: string;
  profit: string;
  /*
   * `paymentMethod` — satr emas, PaymentMethod yozuvi. `reports.service.ts`
   * dagi `paymentBreakdown` butun obyektni saqlaydi va Z hisoboti uni
   * o'zgartirmasdan uzatadi; savdo hisoboti ham shu shaklni ishlatadi.
   * Obyektni to'g'ridan-to'g'ri render qilish React'da xato tashlaydi.
   */
  paymentBreakdown: {
    paymentMethod: { id: string; code: string; name: string };
    amount: string;
  }[];
  unavailableMetrics: string[];
};

export function ZReportView({ query }: { query: ReportQuery }) {
  const { data, error, isLoading, reload } = useReport<ZReport>(
    "/reports/z",
    query,
  );

  if (isLoading) {
    return <SkeletonRows rows={6} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void reload()} />;
  }

  if (!data) {
    return null;
  }

  const columns: DataTableColumn<ZReport["paymentBreakdown"][number]>[] = [
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
      key: "amount",
      header: "Summa",
      align: "right",
      render: (row) => (
        <span className={moneyCell}>{formatMoney(row.amount)}</span>
      ),
    },
  ];

  return (
    <div className="grid gap-4">
      <StatGrid>
        <InfoBox
          icon="wallet"
          label="Tushum"
          tone="brand"
          value={formatMoney(data.totalSales)}
        />
        <InfoBox
          icon="receipt"
          label="Buyurtma"
          value={`${data.ordersCount} ta`}
        />
        <InfoBox
          description="Naqd to'lovlar (kassa qutisi)"
          icon="banknote"
          label="Naqd sotuv"
          value={formatMoney(data.cashSales)}
        />
        <InfoBox
          icon="chart"
          label="Foyda"
          description="Tushum − xarajat"
          tone={Number(data.profit) < 0 ? "danger" : "success"}
          value={formatMoney(data.profit)}
        />
      </StatGrid>

      <div className="grid gap-3 sm:grid-cols-2">
        <InfoBox
          description="Oraliqdagi qayd etilgan xarajatlar"
          icon="wallet"
          label="Xarajat"
          value={formatMoney(data.expenses)}
        />
        <InfoBox
          description="Bitta buyurtmaga o'rtacha"
          icon="receipt"
          label="O'rtacha chek"
          value={formatMoney(data.averageOrder)}
        />
      </div>

      <Card>
        <CardHeader
          description="Muvaffaqiyatli to'lovlar bo'yicha taqsimot"
          title="To'lov usullari"
        />
        <DataTable
          caption="Z-hisobot to'lov taqsimoti"
          columns={columns}
          emptyIcon="wallet"
          emptyTitle="To'lov yo'q"
          getRowKey={(row) => row.paymentMethod.id}
          rows={data.paymentBreakdown}
        />
      </Card>

      {data.unavailableMetrics.length > 0 ? (
        <p className="rounded-mz-control border border-mz-border border-l-4 border-l-mz-warning bg-mz-surface px-3 py-2 text-[13px] text-mz-text-muted">
          {/*
           * Backend bu ko'rsatkichlarni `null` qaytaradi va o'zi ro'yxatlab
           * beradi. Nolga aylantirib ko'rsatish "karta bo'yicha savdo nol"
           * degan noto'g'ri xulosa berardi — hisoblanmagani va nol bo'lgani
           * bir narsa emas.
           */}
          Hisoblanmagan ko&apos;rsatkichlar:{" "}
          {data.unavailableMetrics.join(", ")}. Bular to&apos;lov provayderi
          integratsiyasidan keyin paydo bo&apos;ladi.
        </p>
      ) : null}
    </div>
  );
}
