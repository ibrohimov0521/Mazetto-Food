"use client";

import { useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useApiResource } from "../../lib/use-api-resource";
import { hasPermission } from "../../lib/auth";
import { useAuth } from "../auth/auth-provider";
import { canSwitchBranch } from "../../lib/admin-nav";
import { Badge } from "../admin-ui/badge";
import { ButtonLink } from "../admin-ui/button";
import { Card, CardBody, CardHeader } from "../admin-ui/card";
import { DataTable, type DataTableColumn } from "../admin-ui/data-table";
import { EmptyState, ErrorState, Skeleton } from "../admin-ui/feedback";
import { FilterBar, Select } from "../admin-ui/form";
import { ChipGroup, type TabItem } from "../admin-ui/tabs";
import { InfoBox, StatBox, StatGrid } from "../admin-ui/stat-box";
import {
  catalogVisibilityLabel,
  paymentMethodLabel,
  shiftTypeLabel,
} from "./people-branch-labels";

/*
 * Admin / menejer dashboard.
 *
 * OLDINGI HOLAT VA NIMA UCHUN O'ZGARDI.
 *
 *  1. To'rtta "bugungi" KPI va katalog sanog'idan boshqa hech narsa yo'q edi:
 *     davr tanlagichi yo'q, dinamika yo'q, top mahsulot yo'q, filial
 *     taqsimoti yo'q. Holbuki `/reports/sales` bularning HAMMASINI bitta
 *     javobda qaytaradi (`timeSeries`, `topProducts`, `branchBreakdown`,
 *     `paymentBreakdown`, `shiftBreakdown`) va u faqat hisobotlar ekranida
 *     ishlatilardi.
 *
 *  2. Yuklanish holati oltita ro'yxat chizig'i edi, yuklangan ko'rinish esa
 *     KPI setkasi — ya'ni har yuklashda maket siljiydi. Endi skelet
 *     yuklanadigan maketning O'ZI shaklida (`admin-shell/shell-content-skeleton.tsx`
 *     dagi model bo'yicha; u sahifa sarlavhasini ham chizadi, shuning uchun
 *     bu yerda faqat kontent qismi takrorlanadi).
 *
 *  3. `QuickLinks` yon menyuning aynan nusxasi edi — olib tashlandi. O'rniga
 *     har blok o'z kontekstidagi ekranga havola beradi.
 *
 * DAVR MANBASI. `/dashboard/summary` FAQAT bugunni biladi (backendda sana
 * parametri yo'q, faqat `branchId`). Shuning uchun davrga bog'liq hamma narsa
 * `/reports/sales` dan keladi va u `REPORT_SALES_VIEW` talab qiladi. Bu
 * ruxsat bo'lmasa davr tanlagichi UMUMAN ko'rsatilmaydi va ekran ochiq-oydin
 * "faqat bugun" deb turadi — ishlamaydigan tanlagich ko'rsatishdan yaxshiroq.
 */

export type DashboardVariant = "admin" | "manager";

type DashboardSummary = {
  todayRevenue: string | number;
  todayOrdersCount: number;
  activeShifts: number;
  averageOrderValue: string | number;
  branchId: string | null;
};

type SalesReport = {
  period: { from: string; to: string };
  revenue: string | number;
  orderCount: number;
  averageOrderValue: string | number;
  cashSales: string | number;
  cancelledOrders: number;
  paymentBreakdown: {
    paymentMethod: { id: string; code: string; name: string };
    amount: string | number;
    count: number;
  }[];
  branchBreakdown: {
    branch: { id: string; code: string; name: string };
    amount: string | number;
    orderCount: number;
  }[];
  shiftBreakdown: {
    id: string;
    branch: { id: string; name: string };
    cashier: { id: string; employeeCode: string; firstName: string; lastName?: string | null };
    shiftNumber: number;
    status: "OPEN" | "CLOSED";
    type?: string;
    orderCount: number;
    grossSales: string | number;
    cashSales: string | number;
  }[];
  topProducts: {
    productId: string | null;
    productName: string;
    quantity: string | number;
    amount: string | number;
  }[];
  timeSeries: {
    grain: "day" | "month";
    data: { date: string; amount: string | number; orderCount: number }[];
  };
};

type Branch = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  acceptsOrders: boolean;
  isTemporarilyClosed?: boolean;
  isOpen?: boolean;
  _count?: { employees: number; printers: number; devices: number; products: number };
};

type CatalogProduct = { catalogVisibility?: string };

type DashboardContext = {
  branches: Branch[] | null;
  catalog: { products: number; canonical: number; categories: number } | null;
  openOrders: { count: number; isCapped: boolean } | null;
};

/*
 * Preset'lar `/reports/sales` ning `ReportQueryDto` dan — frontend sana
 * hisoblamaydi, davr chegarasi Asia/Tashkent bo'yicha backendda aniqlanadi.
 */
const presets: TabItem[] = [
  { key: "today", label: "Bugun" },
  { key: "yesterday", label: "Kecha" },
  { key: "last7days", label: "7 kun" },
  { key: "thisMonth", label: "Bu oy" },
];

/*
 * "Ochiq buyurtma" deb hisoblanadigan statuslar.
 *
 * NIMA UCHUN uchta alohida so'rov: `GET /orders` bitta `status` qabul qiladi
 * va UMUMIY SONNI qaytarmaydi — faqat massiv. Sanoq shuning uchun sahifa
 * hajmi bilan CHEKLANGAN va yorliq buni ochiq aytadi ("100+"). To'g'ri yechim
 * backendda statuslar bo'yicha sanoq endpoint'i (hisobotda ko'rsatilgan).
 */
const openOrderStatuses = ["NEW", "CONFIRMED", "PREPARING", "READY"] as const;
const openOrderPageSize = 100;

export function AdminDashboard({
  variant = "admin",
}: {
  variant?: DashboardVariant;
}) {
  const { user } = useAuth();

  const canViewSummary = hasPermission(user, "DASHBOARD_VIEW");
  const canViewSales = hasPermission(user, "REPORT_SALES_VIEW");
  const canViewCatalog = hasPermission(user, "MENU_VIEW");
  const canViewBranches = hasPermission(user, "BRANCH_VIEW");
  const canViewOrders = hasPermission(user, "ORDER_VIEW");
  const canViewShifts = hasPermission(user, "SHIFT_VIEW_BRANCH");

  /*
   * Filial tanlagichi FAQAT global scope rol uchun. Branch-scoped rol
   * (ADMIN, BRANCH_MANAGER) boshqa filialni ko'rmaydi — backend baribir
   * o'zining filialiga qisqartiradi, ya'ni tanlagich yolg'on bo'lardi.
   */
  const canPickBranch = variant === "admin" && canSwitchBranch(user);

  const [preset, setPreset] = useState("today");
  const [branchId, setBranchId] = useState("");

  const effectiveBranchId = canPickBranch ? branchId : "";

  // --- Kontekst: filiallar, katalog, ochiq buyurtmalar (davrga bog'liq emas)
  const context = useApiResource<DashboardContext>(
    async () => {
      const [branches, catalog, openOrders] = await Promise.all([
        canViewBranches ? apiFetch<Branch[]>("/branches") : Promise.resolve(null),
        canViewCatalog ? loadCatalogCounts() : Promise.resolve(null),
        canViewOrders ? loadOpenOrders() : Promise.resolve(null),
      ]);

      return { branches, catalog, openOrders };
    },
    [canViewBranches, canViewCatalog, canViewOrders],
    "Kontekst ma'lumotlarini yuklab bo'lmadi.",
  );

  // --- Bugungi operatsion holat (davrga bog'liq EMAS)
  const today = useApiResource<DashboardSummary | null>(
    () =>
      canViewSummary
        ? apiFetch<DashboardSummary>(
            `/dashboard/summary${effectiveBranchId ? `?branchId=${effectiveBranchId}` : ""}`,
          )
        : Promise.resolve(null),
    [canViewSummary, effectiveBranchId],
    "Bugungi ko'rsatkichlarni yuklab bo'lmadi.",
  );

  // --- Davr bo'yicha savdo
  const sales = useApiResource<SalesReport | null>(
    () => {
      if (!canViewSales) {
        return Promise.resolve(null);
      }

      const params = new URLSearchParams({ preset });

      if (effectiveBranchId) {
        params.set("branchId", effectiveBranchId);
      }

      return apiFetch<SalesReport>(`/reports/sales?${params.toString()}`);
    },
    [canViewSales, preset, effectiveBranchId],
    "Savdo ko'rsatkichlarini yuklab bo'lmadi.",
  );

  const branches = context.data?.branches ?? null;
  const catalog = context.data?.catalog ?? null;
  const openOrders = context.data?.openOrders ?? null;
  const report = sales.data ?? null;
  const summary = today.data ?? null;

  const presetLabel =
    presets.find((item) => item.key === preset)?.label ?? "Bugun";

  const branchName = useMemo(() => {
    if (!effectiveBranchId) {
      return null;
    }

    return (
      branches?.find((branch) => branch.id === effectiveBranchId)?.name ?? null
    );
  }, [branches, effectiveBranchId]);

  const openShifts = useMemo(
    () =>
      (report?.shiftBreakdown ?? []).filter((shift) => shift.status === "OPEN"),
    [report],
  );

  const isLoading = today.isLoading || sales.isLoading || context.isLoading;
  /*
   * Davr yoki filial almashganda FILTR QATORI joyida qolishi shart — aks
   * holda foydalanuvchi yuklanish paytida boshqaruvni yo'qotadi va tanlovini
   * o'zgartira olmaydi. Shuning uchun to'liq skelet faqat BIRINCHI yuklashda.
   */
  const hasLoadedOnce = Boolean(today.data || sales.data || context.data);
  const isInitialLoading = isLoading && !hasLoadedOnce;

  /*
   * Xatolar TO'PLAB ko'rsatiladi, lekin ekranni almashtirmaydi: uchta
   * so'rovdan biri yiqilsa qolgan ikkitasining ma'lumoti baribir foydali.
   * Har xato o'z "qayta urinish" tugmasi bilan keladi.
   */
  const failures = [
    today.error ? { message: today.error, retry: today.reload } : null,
    sales.error ? { message: sales.error, retry: sales.reload } : null,
    context.error ? { message: context.error, retry: context.reload } : null,
  ].filter((item): item is { message: string; retry: () => void } =>
    Boolean(item),
  );

  const hasAnyData = Boolean(summary || report || catalog || branches);

  if (isInitialLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="grid gap-5">
      {failures.map((failure, index) => (
        <ErrorState key={index} message={failure.message} onRetry={failure.retry} />
      ))}

      {canViewSales || canPickBranch ? (
        <Card>
          <FilterBar>
            {canViewSales ? (
              <div className="min-w-0">
                <p className="mb-1.5 text-[13px] font-semibold text-mz-text">
                  Davr
                </p>
                <ChipGroup
                  active={preset}
                  items={presets}
                  label="Hisobot davri"
                  onChange={setPreset}
                />
              </div>
            ) : null}

            {canPickBranch ? (
              <div className="w-full sm:w-64">
                <label
                  className="mb-1.5 block text-[13px] font-semibold text-mz-text"
                  htmlFor="dashboard-branch"
                >
                  Filial
                </label>
                <Select
                  id="dashboard-branch"
                  onChange={(event) => setBranchId(event.target.value)}
                  value={branchId}
                >
                  <option value="">Barcha filiallar</option>
                  {(branches ?? []).map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            <p className="ml-auto max-w-sm text-[13px] text-mz-text-muted">
              {canViewSales
                ? `Pul va buyurtma ko'rsatkichlari — ${presetLabel.toLowerCase()}${
                    branchName ? `, ${branchName}` : ""
                  }. Smenalar va ochiq buyurtmalar esa ayni damdagi holat.`
                : "Davr tanlash uchun savdo hisoboti ruxsati kerak. Hozir faqat bugungi holat ko'rsatilmoqda."}
            </p>
          </FilterBar>
        </Card>
      ) : null}

      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
      {!hasAnyData && failures.length === 0 ? (
        <Card>
          <EmptyState
            description="Sizning rolingizga dashboardda ko'rsatiladigan ko'rsatkichlar biriktirilmagan. Yon menyudan o'z bo'limingizni tanlang."
            icon="gauge"
            title="Ko'rsatiladigan ma'lumot yo'q"
          />
        </Card>
      ) : null}

      <KpiRow
        openOrders={openOrders}
        presetLabel={presetLabel}
        report={report}
        summary={summary}
      />

      {report && report.timeSeries.data.length > 1 ? (
        <TrendCard series={report.timeSeries} />
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        {report ? <TopProductsCard products={report.topProducts} /> : null}
        {report ? <PaymentMixCard rows={report.paymentBreakdown} /> : null}
      </div>

      {/*
        Filial taqsimoti FAQAT global ko'rish uchun ma'noli: branch-scoped
        rol baribir bitta filialni ko'radi va jadval bir qatorli bo'lardi.
      */}
      {report && !effectiveBranchId && report.branchBreakdown.length > 1 ? (
        <BranchBreakdownCard rows={report.branchBreakdown} />
      ) : null}

      {/*
        Menejer ko'rinishining O'ZIGA XOS bloki: ochiq smenalar va kassa
        holati. Menejerning kunlik ishi aynan shu — kassir smenasini ochib
        yopish, naqd farqini kuzatish.
      */}
      {variant === "manager" && canViewShifts ? (
        <OpenShiftsCard shifts={openShifts} />
      ) : null}

      {branches && variant === "manager" ? (
        <BranchReadinessCard branches={branches} />
      ) : null}

      {catalog ? <CatalogCard catalog={catalog} /> : null}
        </>
      )}
    </div>
  );
}

// --- Bloklar -----------------------------------------------------------------

function KpiRow({
  summary,
  report,
  openOrders,
  presetLabel,
}: {
  summary: DashboardSummary | null;
  report: SalesReport | null;
  openOrders: DashboardContext["openOrders"];
  presetLabel: string;
}) {
  if (!summary && !report) {
    return null;
  }

  /*
   * Pul KPI'lari davr hisobotidan, u yo'q bo'lsa bugungi xulosadan.
   * Ikkalasi bir vaqtda ko'rsatilmaydi — bir xil nomdagi ikki xil raqam
   * eng chalkash holat.
   */
  const revenue = report?.revenue ?? summary?.todayRevenue;
  const orders = report?.orderCount ?? summary?.todayOrdersCount;
  const average = report?.averageOrderValue ?? summary?.averageOrderValue;
  const periodNote = report ? presetLabel : "Bugun";

  return (
    <StatGrid>
      <StatBox
        hint={periodNote}
        icon="wallet"
        label="Tushum"
        tone="brand"
        value={formatMoney(revenue)}
      />
      <StatBox
        hint={
          report
            ? `${report.cancelledOrders} ta bekor qilingan`
            : periodNote
        }
        icon="receipt"
        label="Buyurtmalar"
        value={`${orders ?? 0} ta`}
      />
      <StatBox
        hint={periodNote}
        icon="chart"
        label="O'rtacha chek"
        value={formatMoney(average)}
      />
      {openOrders ? (
        <StatBox
          hint="Yangi, tayyorlanmoqda va tayyor"
          icon="clock"
          label="Ochiq buyurtmalar"
          tone={openOrders.count > 0 ? "warning" : "neutral"}
          value={`${openOrders.count}${openOrders.isCapped ? "+" : ""} ta`}
        />
      ) : (
        <StatBox
          hint="Ayni damdagi holat"
          icon="clock"
          label="Ochiq smenalar"
          tone={(summary?.activeShifts ?? 0) > 0 ? "success" : "neutral"}
          value={`${summary?.activeShifts ?? 0} ta`}
        />
      )}
    </StatGrid>
  );
}

/**
 * Dinamika — kunlar bo'yicha tushum.
 *
 * Kutubxona ishlatilmaydi: bu yerda kerak bo'lgani nisbiy balandlikdagi
 * ustunlar. Ekran o'quvchi uchun `<table>` ko'rinishi ham beriladi, chunki
 * ustunlarning o'zi hech qanday ma'no tashimaydi.
 */
function TrendCard({ series }: { series: SalesReport["timeSeries"] }) {
  const rows = series.data;
  const peak = Math.max(...rows.map((row) => toNumber(row.amount)), 1);

  return (
    <Card>
      <CardHeader
        description={
          series.grain === "day"
            ? "Kunlar bo'yicha tushum"
            : "Oylar bo'yicha tushum"
        }
        title="Dinamika"
      />
      <CardBody>
        <div className="mz-thin-scrollbar overflow-x-auto">
          <ul className="flex min-w-full items-end gap-1.5" role="presentation">
            {rows.map((row) => {
              const amount = toNumber(row.amount);
              const height = Math.max(4, Math.round((amount / peak) * 100));

              return (
                <li
                  className="flex min-w-8 flex-1 flex-col items-center gap-1.5"
                  key={row.date}
                >
                  <span className="flex h-32 w-full items-end">
                    <span
                      className="w-full rounded-t-mz-control bg-mz-accent"
                      style={{ height: `${height}%` }}
                      title={`${formatDay(row.date)}: ${formatMoney(row.amount)}`}
                    />
                  </span>
                  <span className="text-[13px] text-mz-text-muted">
                    {formatDay(row.date)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <table className="sr-only">
          <caption>Kunlar bo&apos;yicha tushum</caption>
          <thead>
            <tr>
              <th scope="col">Sana</th>
              <th scope="col">Tushum</th>
              <th scope="col">Buyurtma</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.date}>
                <td>{formatDay(row.date)}</td>
                <td>{formatMoney(row.amount)}</td>
                <td>{row.orderCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}

function TopProductsCard({
  products,
}: {
  products: SalesReport["topProducts"];
}) {
  const columns: DataTableColumn<SalesReport["topProducts"][number]>[] = [
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
      header: "Sotildi",
      align: "right",
      render: (row) => `${formatNumber(row.quantity)} ta`,
    },
    {
      key: "amount",
      header: "Tushum",
      align: "right",
      render: (row) => (
        <span className="font-semibold text-mz-primary-hover">
          {formatMoney(row.amount)}
        </span>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader
        actions={
          <ButtonLink href="/admin/reports" size="sm" variant="ghost">
            Batafsil hisobot
          </ButtonLink>
        }
        description="Tushum bo'yicha eng yaxshi 10 pozitsiya"
        title="Top mahsulotlar"
      />
      <DataTable
        caption="Top mahsulotlar"
        columns={columns}
        emptyDescription="Tanlangan davrda sotuv bo'lmagan."
        emptyTitle="Sotuv yo'q"
        getRowKey={(row) => row.productId ?? row.productName}
        rows={products}
        scrollHeightClass="max-h-80"
      />
    </Card>
  );
}

function PaymentMixCard({ rows }: { rows: SalesReport["paymentBreakdown"] }) {
  const columns: DataTableColumn<SalesReport["paymentBreakdown"][number]>[] = [
    {
      key: "method",
      header: "To'lov usuli",
      primary: true,
      render: (row) => (
        <span className="font-semibold text-mz-text">
          {paymentMethodLabel(row.paymentMethod.code)}
        </span>
      ),
    },
    {
      key: "count",
      header: "Soni",
      align: "right",
      render: (row) => `${row.count} ta`,
    },
    {
      key: "amount",
      header: "Summa",
      align: "right",
      render: (row) => (
        <span className="font-semibold text-mz-primary-hover">
          {formatMoney(row.amount)}
        </span>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader
        description="Tanlangan davrdagi tushumning usullar bo'yicha taqsimi"
        title="To'lov usullari"
      />
      <DataTable
        caption="To'lov usullari"
        columns={columns}
        emptyDescription="Tanlangan davrda to'lov qayd etilmagan."
        emptyTitle="To'lov yo'q"
        getRowKey={(row) => row.paymentMethod.id}
        rows={rows}
        scrollHeightClass="max-h-80"
      />
    </Card>
  );
}

function BranchBreakdownCard({
  rows,
}: {
  rows: SalesReport["branchBreakdown"];
}) {
  const columns: DataTableColumn<SalesReport["branchBreakdown"][number]>[] = [
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
      render: (row) => `${row.orderCount} ta`,
    },
    {
      key: "amount",
      header: "Tushum",
      align: "right",
      render: (row) => (
        <span className="font-semibold text-mz-primary-hover">
          {formatMoney(row.amount)}
        </span>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader
        actions={
          <ButtonLink href="/admin/branches" size="sm" variant="ghost">
            Filiallar
          </ButtonLink>
        }
        description="Tanlangan davrda filiallar bo'yicha tushum"
        title="Filiallar bo'yicha"
      />
      <DataTable
        caption="Filiallar bo'yicha tushum"
        columns={columns}
        emptyTitle="Ma'lumot yo'q"
        getRowKey={(row) => row.branch.id}
        rows={rows}
      />
    </Card>
  );
}

/**
 * Ochiq smenalar — menejer ko'rinishi.
 *
 * BIZNES QOIDASI (bu yerda ko'rinadigan holga keltirilgan): bitta xodimning
 * filialda BITTA ochiq smenasi bo'ladi va u xodimning barcha vazifalari
 * uchun umumiy kassa hisoblanadi. Backend `findFirst({ employeeId, status:
 * OPEN })` bilan aynan shuni ta'minlaydi — smena turi (kassa/kuryer) ikkinchi
 * smena ochish huquqini bermaydi.
 */
function OpenShiftsCard({ shifts }: { shifts: SalesReport["shiftBreakdown"] }) {
  const columns: DataTableColumn<SalesReport["shiftBreakdown"][number]>[] = [
    {
      key: "cashier",
      header: "Xodim",
      primary: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-mz-text">
            {[row.cashier.firstName, row.cashier.lastName]
              .filter(Boolean)
              .join(" ")}
          </p>
          <p className="truncate text-[13px] text-mz-text-muted">
            {row.cashier.employeeCode} · {row.branch.name}
          </p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Smena",
      render: (row) => (
        <Badge tone="info">
          №{row.shiftNumber}
          {row.type ? ` · ${shiftTypeLabel(row.type)}` : ""}
        </Badge>
      ),
    },
    {
      key: "orders",
      header: "Buyurtma",
      align: "right",
      render: (row) => `${row.orderCount} ta`,
    },
    {
      key: "cash",
      header: "Naqd",
      align: "right",
      hideOnMobile: true,
      render: (row) => (
        <span className="font-semibold text-mz-primary-hover">
          {formatMoney(row.cashSales)}
        </span>
      ),
    },
    {
      key: "gross",
      header: "Jami",
      align: "right",
      render: (row) => (
        <span className="font-semibold text-mz-primary-hover">
          {formatMoney(row.grossSales)}
        </span>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader
        actions={
          <ButtonLink href="/admin/shifts" size="sm" variant="ghost">
            Barcha smenalar
          </ButtonLink>
        }
        description="Har xodimda filial bo'yicha bitta umumiy kassa smenasi bo'ladi"
        title="Ochiq kassa smenalari"
      />
      <DataTable
        caption="Ochiq kassa smenalari"
        columns={columns}
        emptyDescription="Tanlangan davrda ochiq smena topilmadi. Kassir smenani kassa ekranidan ochadi."
        emptyIcon="clock"
        emptyTitle="Ochiq smena yo'q"
        getRowKey={(row) => row.id}
        rows={shifts}
        scrollHeightClass="max-h-80"
      />
    </Card>
  );
}

/**
 * Filial tayyorligi — menejer ko'rinishi.
 *
 * `/branches` javobidagi `_count` va `isOpen` maydonlari ilgari umuman
 * ishlatilmasdi. Menejer uchun eng muhim savol "filialim buyurtma
 * qabul qilyaptimi va kassa/printer joyidami" — javob shu yerda.
 */
function BranchReadinessCard({ branches }: { branches: Branch[] }) {
  const columns: DataTableColumn<Branch>[] = [
    {
      key: "name",
      header: "Filial",
      primary: true,
      render: (branch) => (
        <span className="font-semibold text-mz-text">{branch.name}</span>
      ),
    },
    {
      key: "state",
      header: "Holat",
      render: (branch) => (
        <div className="flex flex-wrap justify-end gap-1 md:justify-start">
          {branch.isActive ? null : <Badge tone="danger">Faol emas</Badge>}
          {branch.isTemporarilyClosed ? (
            <Badge tone="warning">Vaqtincha yopiq</Badge>
          ) : null}
          <Badge tone={branch.acceptsOrders ? "success" : "warning"}>
            {branch.acceptsOrders ? "Buyurtma oladi" : "Buyurtma olmaydi"}
          </Badge>
          {branch.isOpen === undefined ? null : (
            <Badge tone={branch.isOpen ? "success" : "neutral"}>
              {branch.isOpen ? "Ish vaqtida" : "Ish vaqtidan tashqari"}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "employees",
      header: "Xodim",
      align: "right",
      render: (branch) => `${branch._count?.employees ?? 0} ta`,
    },
    {
      key: "devices",
      header: "Kassa qurilmasi",
      align: "right",
      hideOnMobile: true,
      render: (branch) => `${branch._count?.devices ?? 0} ta`,
    },
    {
      key: "printers",
      header: "Printer",
      align: "right",
      hideOnMobile: true,
      render: (branch) => `${branch._count?.printers ?? 0} ta`,
    },
  ];

  return (
    <Card>
      <CardHeader
        actions={
          <ButtonLink href="/admin/branches" size="sm" variant="ghost">
            Filial sozlamalari
          </ButtonLink>
        }
        description="Buyurtma qabuli, xodim va qurilma soni"
        title="Filial tayyorligi"
      />
      <DataTable
        caption="Filial tayyorligi"
        columns={columns}
        emptyTitle="Filial topilmadi"
        getRowKey={(branch) => branch.id}
        rows={branches}
      />
    </Card>
  );
}

function CatalogCard({
  catalog,
}: {
  catalog: NonNullable<DashboardContext["catalog"]>;
}) {
  return (
    <Card>
      <CardHeader
        actions={
          <ButtonLink href="/admin/products" size="sm" variant="ghost">
            Mahsulotlar
          </ButtonLink>
        }
        description="Menyu tuzilmasining hozirgi holati"
        title="Katalog"
      />
      <CardBody>
        <StatGrid>
          <InfoBox
            description={catalogVisibilityLabel("CANONICAL")}
            icon="utensils"
            label="Ommaviy menyu"
            tone="brand"
            value={`${catalog.canonical} ta`}
          />
          <InfoBox
            description="Arxiv va ichki pozitsiyalar bilan"
            icon="boxes"
            label="Jami mahsulot"
            value={`${catalog.products} ta`}
          />
          <InfoBox
            icon="folder"
            label="Kategoriyalar"
            value={`${catalog.categories} ta`}
          />
        </StatGrid>
      </CardBody>
    </Card>
  );
}

/**
 * Yuklanish skeleti.
 *
 * MUHIM: shakl YUKLANADIGAN maketning o'zi — filtr qatori, 4 ta KPI, keyin
 * kartochkalar. Ilgari bu yerda oltita ro'yxat chizig'i turardi va har
 * yuklashda maket sakrab ketardi.
 */
function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="grid gap-5">
      <span className="sr-only">Yuklanmoqda</span>
      <Skeleton className="h-20 w-full" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton className="h-28 w-full" key={index} />
        ))}
      </div>
      <Skeleton className="h-56 w-full" />
      <div className="grid gap-5 xl:grid-cols-2">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  );
}

// --- Yuklovchilar ------------------------------------------------------------

async function loadCatalogCounts(): Promise<
  NonNullable<DashboardContext["catalog"]>
> {
  const [products, categories] = await Promise.all([
    apiFetch<CatalogProduct[]>("/menu/products?includeInactive=true"),
    apiFetch<unknown[]>("/menu/categories?includeInactive=true"),
  ]);

  return {
    products: products.length,
    canonical: products.filter((item) => item.catalogVisibility === "CANONICAL")
      .length,
    categories: categories.length,
  };
}

async function loadOpenOrders(): Promise<
  NonNullable<DashboardContext["openOrders"]>
> {
  const pages = await Promise.all(
    openOrderStatuses.map((status) =>
      apiFetch<unknown[]>(
        `/orders?status=${status}&limit=${openOrderPageSize}`,
      ),
    ),
  );

  return {
    count: pages.reduce((sum, page) => sum + page.length, 0),
    // Kamida bitta status sahifasi to'lgan bo'lsa haqiqiy son kattaroq.
    isCapped: pages.some((page) => page.length >= openOrderPageSize),
  };
}

// --- Formatlash --------------------------------------------------------------

const numberFormat = new Intl.NumberFormat("uz-UZ");

function toNumber(value: string | number | undefined): number {
  const numeric = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numeric) ? numeric : 0;
}

function formatMoney(value: string | number | undefined): string {
  if (value === undefined || value === null) {
    return "—";
  }

  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    return "—";
  }

  return `${numberFormat.format(Math.round(numeric))} so'm`;
}

function formatNumber(value: string | number): string {
  const numeric = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numeric) ? numberFormat.format(numeric) : "—";
}

/** `2026-09-12` → `12.09`. Uzun davrda ustun yorliqlari sig'ishi uchun. */
function formatDay(value: string): string {
  const parts = value.slice(0, 10).split("-");

  if (parts.length !== 3) {
    return value;
  }

  return `${parts[2]}.${parts[1]}`;
}
