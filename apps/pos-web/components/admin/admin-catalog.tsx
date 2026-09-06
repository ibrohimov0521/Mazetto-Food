"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { Badge as UiBadge } from "../admin-ui/badge";
import { Button, ButtonLink } from "../admin-ui/button";
import { Card } from "../admin-ui/card";
import { DataTable, type DataTableColumn } from "../admin-ui/data-table";
import { ErrorState } from "../admin-ui/feedback";
import { FilterBar, TextInput } from "../admin-ui/form";

type CatalogVisibility = "CANONICAL" | "LEGACY" | "INTERNAL";

type Category = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  isActive?: boolean;
  sortOrder: number;
  _count?: { products: number };
};

type ProductVariant = {
  id?: string;
  code?: string;
  name: string;
  sellingPrice: string;
  costPrice?: string | null;
  isDefault: boolean;
  isAvailable?: boolean;
  sortOrder?: number;
};

type BundleItem = {
  id: string;
  componentCode: string;
  componentName: string;
  quantity: string;
  unitLabel?: string | null;
};

type Product = {
  id: string;
  categoryId: string;
  code: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  preparationTime?: number | null;
  sellingPrice: string;
  isAvailable: boolean;
  isRecommended: boolean;
  isCombo: boolean;
  sortOrder: number;
  catalogVisibility: CatalogVisibility;
  category: { id: string; code: string; name: string };
  variants: ProductVariant[];
  bundleItems?: BundleItem[];
};

type Branch = {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  isActive: boolean;
  acceptsOrders: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  workingHours?: { dayOfWeek: string; opensAt?: string | null; closesAt?: string | null; isClosed: boolean }[];
};

const formatter = new Intl.NumberFormat("uz-UZ");

export function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("ALL");
  const [visibility, setVisibility] = useState("ALL");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [nextProducts, nextCategories] = await Promise.all([
        apiFetch<Product[]>("/menu/products?includeInactive=true"),
        apiFetch<Category[]>("/menu/categories?includeInactive=true"),
      ]);
      setProducts(nextProducts);
      setCategories(nextCategories);
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      setError("Mahsulotlar ro'yxatini yuklab bo'lmadi.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !needle ||
        product.name.toLowerCase().includes(needle) ||
        product.code.toLowerCase().includes(needle);
      const matchesCategory = categoryId === "ALL" || product.categoryId === categoryId;
      const matchesVisibility = visibility === "ALL" || product.catalogVisibility === visibility;

      return matchesSearch && matchesCategory && matchesVisibility;
    });
  }, [categoryId, products, query, visibility]);

  const columns: DataTableColumn<Product>[] = [
    {
      key: "product",
      header: "Mahsulot",
      primary: true,
      render: (product) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-mz-text">{product.name}</p>
          <p className="truncate text-xs text-mz-text-muted">{product.code}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <UiBadge
              tone={
                product.catalogVisibility === "CANONICAL"
                  ? "success"
                  : product.catalogVisibility === "LEGACY"
                    ? "warning"
                    : "neutral"
              }
            >
              {product.catalogVisibility}
            </UiBadge>
            {product.isCombo ? <UiBadge tone="info">SET</UiBadge> : null}
            {!product.isAvailable ? <UiBadge tone="danger">Yopiq</UiBadge> : null}
            {product.isRecommended ? <UiBadge tone="warning">Tavsiya</UiBadge> : null}
            {!product.imageUrl ? <UiBadge tone="neutral">Rasmsiz</UiBadge> : null}
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Kategoriya",
      render: (product) => product.category.name,
    },
    {
      key: "variants",
      header: "Variant",
      hideOnMobile: true,
      render: (product) => `${product.variants.length || 1} ta`,
    },
    {
      key: "price",
      header: "Narx",
      align: "right",
      render: (product) => (
        <span className="font-semibold text-mz-text">{formatMoney(product.sellingPrice)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (product) => (
        <ButtonLink href={`/admin/products/${product.id}`} size="sm" variant="ghost">
          Tahrir
        </ButtonLink>
      ),
    },
  ];

  return (
    <div className="grid gap-5">
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      <Card>
        <FilterBar>
          <div className="min-w-52 flex-1">
            <TextInput
              aria-label="Mahsulot qidirish"
              placeholder="Mahsulot nomi yoki kodi"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="w-52">
            <Select
              aria-label="Kategoriya bo'yicha filtr"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="ALL">Barcha kategoriyalar</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-44">
            <Select
              aria-label="Katalog ko'rinishi bo'yicha filtr"
              value={visibility}
              onChange={(event) => setVisibility(event.target.value)}
            >
              <option value="ALL">Barcha holatlar</option>
              <option value="CANONICAL">Canonical</option>
              <option value="LEGACY">Legacy</option>
              <option value="INTERNAL">Internal</option>
            </Select>
          </div>
          <ButtonLink href="/admin/products/new">Yangi mahsulot</ButtonLink>
        </FilterBar>

        <DataTable
          caption="Mahsulotlar ro'yxati"
          columns={columns}
          emptyDescription="Qidiruv yoki filtrni o'zgartirib ko'ring."
          emptyTitle="Mos mahsulot topilmadi"
          getRowKey={(product) => product.id}
          isLoading={isLoading}
          rows={filtered}
        />
      </Card>
    </div>
  );
}

export function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", description: "", image: "", sortOrder: "0" });

  async function load() {
    setCategories(await apiFetch<Category[]>("/menu/categories?includeInactive=true"));
  }

  useEffect(() => {
    void load().catch(() => setError("Kategoriyalarni yuklab bo'lmadi."));
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      await apiFetch("/menu/categories", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          image: form.image || undefined,
          sortOrder: Number(form.sortOrder) || 0,
        }),
      });
      setForm({ name: "", description: "", image: "", sortOrder: "0" });
      await load();
    } catch {
      setError("Kategoriya yaratilmadi. Maydonlarni tekshiring.");
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <form className="grid content-start gap-4 rounded-mz-card border border-mz-border bg-mz-surface p-5 shadow-mz-card" onSubmit={create}>
        <h3 className="text-xl font-black text-mz-text">Yangi kategoriya</h3>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <TextInput placeholder="Nomi" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        <TextInput placeholder="Tavsif" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <TextInput placeholder="/categories/lavash.webp" value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} />
        <TextInput min="0" placeholder="Saralash" type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} />
        <Button type="submit">Qo'shish</Button>
      </form>
      <section className="grid gap-3">
        {categories.map((category) => (
          <article className="rounded-mz-card border border-mz-border bg-mz-surface p-5 shadow-mz-card" key={category.id}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-black text-mz-text">{category.name}</h3>
                <p className="text-sm font-semibold text-mz-text-muted">{category.code} · {category._count?.products ?? 0} mahsulot</p>
                <p className="mt-2 text-sm text-mz-text-muted">{category.description ?? "Tavsif yo'q"}</p>
              </div>
              <Badge tone={category.isActive === false ? "red" : "green"}>{category.isActive === false ? "Yopiq" : "Faol"}</Badge>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

export function AdminBranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void apiFetch<Branch[]>("/branches").then(setBranches).catch(() => setError("Filiallarni yuklab bo'lmadi."));
  }, []);

  return (
    <div className="grid gap-4">
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {branches.map((branch) => (
        <article className="rounded-mz-card border border-mz-border bg-mz-surface p-5 shadow-mz-card" key={branch.id}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-xl font-black text-mz-text">{branch.name}</h3>
              <p className="mt-1 text-sm font-semibold text-mz-text-muted">{branch.code} · {branch.address ?? "Manzil kiritilmagan"}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone={branch.isActive ? "green" : "red"}>{branch.isActive ? "Faol" : "Yopiq"}</Badge>
                <Badge tone={branch.acceptsOrders ? "green" : "amber"}>{branch.acceptsOrders ? "Buyurtma oladi" : "Buyurtma yopiq"}</Badge>
                <Badge tone={branch.deliveryEnabled ? "teal" : "slate"}>Yetkazish</Badge>
                <Badge tone={branch.pickupEnabled ? "teal" : "slate"}>Olib ketish</Badge>
              </div>
            </div>
            <div className="grid gap-1 text-sm font-semibold text-mz-text-muted">
              {(branch.workingHours ?? []).slice(0, 7).map((hour) => (
                <span key={hour.dayOfWeek}>
                  {hour.dayOfWeek}: {hour.isClosed ? "Yopiq" : `${hour.opensAt ?? "--"}-${hour.closesAt ?? "--"}`}
                </span>
              ))}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}



function Badge({ children, tone }: { children: React.ReactNode; tone: "green" | "amber" | "slate" | "red" | "teal" | "gold" }) {
  const tones = {
    green: "bg-mz-info-bg text-mz-info",
    amber: "bg-mz-warning-bg text-mz-warning",
    slate: "bg-mz-surface-sunken text-mz-text",
    red: "bg-mz-danger-bg text-mz-danger",
    teal: "bg-mz-info-bg text-mz-info",
    gold: "bg-mz-gold-100 text-mz-warning",
  };

  return <span className={`rounded-full px-3 py-1 text-xs font-black ${tones[tone]}`}>{children}</span>;
}

function Notice({ children, tone = "success" }: { children: React.ReactNode; tone?: "success" | "danger" }) {
  return (
    <div className={`rounded-mz-control px-4 py-3 text-sm font-bold ${tone === "danger" ? "bg-mz-danger-bg text-mz-danger" : "bg-mz-info-bg text-mz-info"}`}>
      {children}
    </div>
  );
}



function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full rounded-mz-control border border-mz-border bg-mz-surface px-4 py-3 text-sm font-bold text-mz-text outline-none transition focus:border-mz-accent focus:ring-4 focus:ring-mz-info-bg"
    />
  );
}

function formatMoney(value: string) {
  return `${formatter.format(Number(value))} so'm`;
}
