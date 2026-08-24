"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ProductCard } from "../../components/product-card";
import { SiteShell } from "../../components/site-shell";
import { apiFetch } from "../../lib/api";
import type { Category, Product } from "../../lib/types";

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

  const load = useCallback(async () => {
    const [nextCategories, nextProducts] = await Promise.all([
      apiFetch<Category[]>("/customer/menu/categories"),
      apiFetch<Product[]>("/customer/menu/products"),
    ]);
    setCategories(nextCategories);
    setProducts(nextProducts);
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
    <section className="mx-auto max-w-6xl px-4 py-6">
      <div className="rounded-xl border border-emerald-100 bg-white p-5 shadow-[0_16px_55px_rgba(15,118,110,0.10)]">
        <div className="grid gap-4 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <p className="text-sm font-black uppercase text-emerald-700">MAZETTO FOOD catalog</p>
            <h1 className="mt-2 text-4xl font-black text-neutral-950">Choose something fresh</h1>
            <p className="mt-2 text-sm leading-6 text-neutral-500">Browse lavash, burgers, chicken favorites, combos, sauces, and drinks prepared by the selected branch.</p>
          </div>
          <input
            className="rounded-xl border border-neutral-200 px-4 py-3 font-semibold outline-none focus:border-emerald-500"
            placeholder="Search menu"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="mt-5 flex gap-2 overflow-auto pb-1">
          <button className={tabClass(categoryId === "all")} onClick={() => setCategoryId("all")} type="button">All</button>
          {categories.map((category) => (
            <button className={tabClass(categoryId === category.id)} key={category.id} onClick={() => setCategoryId(category.id)} type="button">
              {category.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleProducts.map((product) => <ProductCard key={product.id} product={product} />)}
      </div>

      {!visibleProducts.length ? (
        <div className="mt-5 rounded-xl bg-white p-8 text-center text-sm font-bold text-neutral-500 shadow-[0_14px_45px_rgba(17,24,39,0.08)]">
          No products found for this selection.
        </div>
      ) : null}
    </section>
  );
}

function tabClass(active: boolean): string {
  return `shrink-0 rounded-xl px-4 py-3 text-sm font-black transition ${active ? "bg-[#16A34A] text-white shadow-[0_10px_24px_rgba(22,163,74,0.20)]" : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"}`;
}
