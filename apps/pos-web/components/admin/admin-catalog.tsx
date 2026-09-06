"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { Badge as UiBadge } from "../admin-ui/badge";
import { ButtonLink } from "../admin-ui/button";
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
      const matchesCategory =
        categoryId === "ALL" || product.categoryId === categoryId;
      const matchesVisibility =
        visibility === "ALL" || product.catalogVisibility === visibility;

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
            {!product.isAvailable ? (
              <UiBadge tone="danger">Yopiq</UiBadge>
            ) : null}
            {product.isRecommended ? (
              <UiBadge tone="warning">Tavsiya</UiBadge>
            ) : null}
            {!product.imageUrl ? (
              <UiBadge tone="neutral">Rasmsiz</UiBadge>
            ) : null}
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
        <span className="font-semibold text-mz-text">
          {formatMoney(product.sellingPrice)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (product) => (
        <ButtonLink
          href={`/admin/products/${product.id}`}
          size="sm"
          variant="ghost"
        >
          Tahrir
        </ButtonLink>
      ),
    },
  ];

  return (
    <div className="grid gap-5">
      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}

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
