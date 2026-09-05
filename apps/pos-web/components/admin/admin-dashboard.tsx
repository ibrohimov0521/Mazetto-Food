"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { hasPermission } from "../../lib/auth";
import { useAuth } from "../auth/auth-provider";
import { Card, CardBody, CardHeader } from "../admin-ui/card";
import { ErrorState, SkeletonRows } from "../admin-ui/feedback";
import { StatBox, StatGrid } from "../admin-ui/stat-box";

/*
 * Admin dashboard.
 *
 * Eski versiya faqat katalogni sanardi; backend'dagi `/dashboard/summary`
 * (bugungi tushum, buyurtmalar, ochiq smenalar, o'rtacha chek) ishlatilmasdi.
 * Endi asosiy KPI'lar shu endpointdan keladi.
 */

type DashboardSummary = {
  todayRevenue: string | number;
  todayOrdersCount: number;
  activeShifts: number;
  averageOrderValue: string | number;
  branchId: string | null;
};

type CatalogCounts = {
  products: number;
  canonical: number;
  categories: number;
  activeBranches: number;
};

type CatalogProduct = { catalogVisibility?: string };
type CatalogBranch = { isActive: boolean };

export function AdminDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [catalog, setCatalog] = useState<CatalogCounts | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const canViewSummary = hasPermission(user, "DASHBOARD_VIEW");
  const canViewCatalog = hasPermission(user, "MENU_VIEW");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      if (canViewSummary) {
        setSummary(await apiFetch<DashboardSummary>("/dashboard/summary"));
      }

      if (canViewCatalog) {
        const [products, categories, branches] = await Promise.all([
          apiFetch<CatalogProduct[]>("/menu/products?includeInactive=true"),
          apiFetch<unknown[]>("/menu/categories?includeInactive=true"),
          apiFetch<CatalogBranch[]>("/branches"),
        ]);

        setCatalog({
          products: products.length,
          canonical: products.filter((item) => item.catalogVisibility === "CANONICAL").length,
          categories: categories.length,
          activeBranches: branches.filter((branch) => branch.isActive).length,
        });
      }
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        // AuthProvider login'ga yo'naltiradi.
        return;
      }

      setError(caught instanceof Error ? caught.message : "Ma'lumotlarni yuklab bo'lmadi.");
    } finally {
      setIsLoading(false);
    }
  }, [canViewCatalog, canViewSummary]);

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) {
    return <SkeletonRows rows={6} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void load()} />;
  }

  return (
    <div className="grid gap-5">
      {summary ? (
        <StatGrid>
          <StatBox
            label="Bugungi tushum"
            tone="brand"
            value={formatMoney(summary.todayRevenue)}
          />
          <StatBox
            label="Bugungi buyurtmalar"
            value={`${summary.todayOrdersCount} ta`}
          />
          <StatBox label="O'rtacha chek" value={formatMoney(summary.averageOrderValue)} />
          <StatBox
            label="Ochiq smenalar"
            tone={summary.activeShifts > 0 ? "success" : "neutral"}
            value={`${summary.activeShifts} ta`}
          />
        </StatGrid>
      ) : null}

      {catalog ? (
        <Card>
          <CardHeader description="Ichki katalog holati" title="Katalog" />
          <CardBody className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <CatalogCount label="Ommaviy menyu" value={catalog.canonical} />
            <CatalogCount label="Ichki mahsulotlar" value={catalog.products} />
            <CatalogCount label="Kategoriyalar" value={catalog.categories} />
            <CatalogCount label="Faol filiallar" value={catalog.activeBranches} />
          </CardBody>
        </Card>
      ) : null}

      <QuickLinks />
    </div>
  );
}

function CatalogCount({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-mz-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-mz-text">{value}</p>
    </div>
  );
}

function QuickLinks() {
  const { user } = useAuth();

  const links = [
    { href: "/admin/products", title: "Mahsulotlar", detail: "Narx, holat, set tarkibi", permission: "MENU_VIEW" },
    { href: "/admin/categories", title: "Kategoriyalar", detail: "Saralash va katalog tuzilmasi", permission: "MENU_VIEW" },
    { href: "/admin/staff", title: "Xodimlar", detail: "Rol, filial, parol, bloklash", permission: "STAFF_VIEW" },
    { href: "/admin/reports", title: "Hisobotlar", detail: "Sana bo'yicha sotuvlar", permission: "REPORT_SALES_VIEW" },
    { href: "/admin/branches", title: "Filiallar", detail: "Buyurtma holati va ish vaqti", permission: "BRANCH_VIEW" },
    { href: "/admin/tables", title: "Stollar", detail: "Zal va stol boshqaruvi", permission: "TABLE_VIEW" },
  ].filter((link) => hasPermission(user, link.permission));

  if (links.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {links.map((link) => (
        <Link
          className="rounded-mz-card border border-mz-border bg-mz-surface p-4 shadow-mz-card transition hover:border-mz-accent hover:shadow-mz-raised"
          href={link.href}
          key={link.href}
        >
          <p className="text-sm font-semibold text-mz-text">{link.title}</p>
          <p className="mt-1 text-xs text-mz-text-muted">{link.detail}</p>
        </Link>
      ))}
    </section>
  );
}

function formatMoney(value: string | number): string {
  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    return "—";
  }

  return `${new Intl.NumberFormat("uz-UZ").format(Math.round(numeric))} so'm`;
}
