"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MotionDiv, pageMotion, sectionMotion } from "../../components/motion-primitives";
import { ProductCard } from "../../components/product-card";
import { SiteShell } from "../../components/site-shell";
import { apiFetch } from "../../lib/api";
import type { Category, Product } from "../../lib/types";

const branchStorageKey = "mazetto.customer.branchId";

export default function MenuPage() {
  return (
    <SiteShell>
      <MenuCatalog />
    </SiteShell>
  );
}

function MenuCatalog() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryId, setCategoryId] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(window.location.search);
      const nextBranchId = params.get("branchId") ?? window.localStorage.getItem(branchStorageKey) ?? "";
      const branchQuery = nextBranchId ? `?branchId=${encodeURIComponent(nextBranchId)}` : "";
      const [nextCategories, nextProducts] = await Promise.all([
        apiFetch<Category[]>(`/customer/menu/categories${branchQuery}`),
        apiFetch<Product[]>(`/customer/menu/products${branchQuery}`),
      ]);
      if (nextBranchId) {
        window.localStorage.setItem(branchStorageKey, nextBranchId);
      }
      setCategories(sortSetsFirst(nextCategories));
      setProducts(nextProducts);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Menyuni yuklab bo'lmadi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextCategory = params.get("category");
    if (nextCategory) {
      setCategoryId(nextCategory);
    }
  }, []);

  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return products.filter((product) => {
      const categoryMatch = categoryId === "all" || product.categoryId === categoryId;
      const searchMatch = !normalized || `${product.name} ${product.description ?? ""}`.toLowerCase().includes(normalized);
      return categoryMatch && searchMatch;
    });
  }, [categoryId, products, query]);

  return (
    <MotionDiv {...pageMotion} className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mf-card mazetto-liquid-surface p-5">
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,360px)] lg:items-end">
          <div className="min-w-0">
            <p className="text-sm font-black uppercase text-[#67E8F9]">MAZETTO FOOD menyusi</p>
            <h1 className="mt-2 text-4xl font-black text-white">Bugun nima buyurtma qilamiz?</h1>
            <p className="mt-2 text-sm leading-6 text-white/60">Lavash, burger, tovuqli taomlar, setlar, souslar va ichimliklarni tez toping.</p>
          </div>
          <input
            className="mf-input px-4 py-3 font-semibold"
            placeholder="Menyudan qidirish"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="no-scrollbar mt-5 flex max-w-full gap-2 overflow-x-auto overflow-y-hidden pb-1">
          <button className={tabClass(categoryId === "all")} onClick={() => setCategoryId("all")} type="button">Barchasi</button>
          {categories.map((category) => (
            <button className={tabClass(categoryId === category.id)} key={category.id} onClick={() => setCategoryId(category.id)} type="button">
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="mf-card mt-5 p-8 text-center">
          <h2 className="text-2xl font-black text-white">Menyu yuklanmadi</h2>
          <p className="mt-2 text-sm font-semibold text-white/60">{error}</p>
          <button className="pressable ripple mf-button-primary mt-5 px-5 py-3 font-black" onClick={() => void load()} type="button">
            Qayta urinish
          </button>
        </div>
      ) : null}

      <MotionDiv {...sectionMotion} className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }, (_, index) => <ProductSkeleton key={index} />)
          : !error && visibleProducts.map((product) => <ProductCard key={product.id} product={product} />)}
      </MotionDiv>

      {!loading && !error && !visibleProducts.length ? (
        <div className="mf-card mt-5 p-8 text-center text-sm font-bold text-white/60">
          Bu tanlov bo'yicha mahsulot topilmadi.
        </div>
      ) : null}
    </MotionDiv>
  );
}

function sortSetsFirst(categories: Category[]): Category[] {
  return [...categories].sort((a, b) => getCategoryRank(a) - getCategoryRank(b));
}

function getCategoryRank(category: Category): number {
  return category.code?.toUpperCase() === "SETS" ? -1 : 0;
}

function tabClass(active: boolean): string {
  return `pressable ripple shrink-0 rounded-2xl px-4 py-3 text-sm font-black ${active ? "mf-button-primary" : "mazetto-glass-chip text-white/76 hover:text-white"}`;
}

function ProductSkeleton() {
  return (
    <div className="mf-card overflow-hidden">
      <div className="skeleton h-48 w-full" />
      <div className="grid gap-3 p-4">
        <div className="skeleton h-5 w-3/4 rounded-full" />
        <div className="skeleton h-4 w-full rounded-full" />
        <div className="skeleton h-4 w-2/3 rounded-full" />
        <div className="flex items-center justify-between">
          <div className="skeleton h-6 w-24 rounded-full" />
          <div className="skeleton h-11 w-24 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
