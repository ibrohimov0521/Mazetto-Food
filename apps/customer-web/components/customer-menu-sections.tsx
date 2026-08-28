"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ProductCard } from "./product-card";
import { MotionDiv, pageMotion } from "./motion-primitives";
import { BrandLogo } from "./brand-logo";
import { apiFetch } from "../lib/api";
import { displayCategory, displayProducts } from "../lib/customer-display";
import type { Category, Product } from "../lib/types";

const branchStorageKey = "mazetto.customer.branchId";

export function CustomerMenuSections({
  compactTop = false,
  intro = true,
  title = "Bugun nima buyurtma qilamiz?",
}: {
  compactTop?: boolean;
  intro?: boolean;
  title?: string;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const tabScrollerRef = useRef<HTMLDivElement | null>(null);
  const initialCategoryHandledRef = useRef(false);
  const manualScrollRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

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
      const localizedCategories = sortSetsFirst(nextCategories.map(displayCategory));
      setCategories(localizedCategories);
      setProducts(displayProducts(nextProducts));
      setActiveCategoryId((current) => current || localizedCategories[0]?.id || "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Menyuni yuklab bo'lmadi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const menuSections = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return categories
      .map((category) => ({
        category,
        products: products.filter((product) => {
          const searchMatch = !normalized || `${product.name} ${product.description ?? ""}`.toLowerCase().includes(normalized);
          return product.categoryId === category.id && searchMatch;
        }),
      }))
      .filter((section) => !normalized || section.products.length);
  }, [categories, products, query]);

  useEffect(() => {
    if (!menuSections.length) {
      return;
    }

    if (!activeCategoryId || !menuSections.some((section) => section.category.id === activeCategoryId)) {
      setActiveCategoryId(menuSections[0]?.category.id ?? "");
    }
  }, [activeCategoryId, menuSections]);

  useEffect(() => {
    if (initialCategoryHandledRef.current || loading || !menuSections.length) {
      return;
    }

    initialCategoryHandledRef.current = true;
    const nextCategory = new URLSearchParams(window.location.search).get("category");

    if (nextCategory && menuSections.some((section) => section.category.id === nextCategory)) {
      window.requestAnimationFrame(() => scrollToCategory(nextCategory, "auto"));
    }
  }, [loading, menuSections]);

  useEffect(() => {
    if (!menuSections.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (manualScrollRef.current && Date.now() < manualScrollRef.current) {
          return;
        }

        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => Math.abs(a.boundingClientRect.top - 84) - Math.abs(b.boundingClientRect.top - 84));
        const nextId = visible[0]?.target.getAttribute("data-category-id");
        if (nextId) {
          setActiveCategoryId(nextId);
        }
      },
      { rootMargin: "-84px 0px -62% 0px", threshold: [0, 0.2, 0.45] },
    );

    for (const section of menuSections) {
      const element = sectionRefs.current.get(section.category.id);
      if (element) {
        observer.observe(element);
      }
    }

    return () => observer.disconnect();
  }, [menuSections]);

  useEffect(() => {
    const scroller = tabScrollerRef.current;
    const tab = tabRefs.current.get(activeCategoryId);

    if (!activeCategoryId || !scroller || !tab) {
      return;
    }

    const nextLeft = tab.offsetLeft - scroller.clientWidth / 2 + tab.clientWidth / 2;
    scroller.scrollTo({
      behavior: "smooth",
      left: Math.max(0, nextLeft),
    });
  }, [activeCategoryId]);

  const setSectionRef = useCallback((id: string, element: HTMLElement | null) => {
    if (element) {
      sectionRefs.current.set(id, element);
    } else {
      sectionRefs.current.delete(id);
    }
  }, []);

  const setTabRef = useCallback((id: string, element: HTMLButtonElement | null) => {
    if (element) {
      tabRefs.current.set(id, element);
    } else {
      tabRefs.current.delete(id);
    }
  }, []);

  function clearSearch() {
    setQuery("");
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }

  function scrollToCategory(
    nextCategoryId: string,
    behavior: ScrollBehavior = "smooth",
  ) {
    const target = sectionRefs.current.get(nextCategoryId);
    if (!target) {
      setActiveCategoryId(nextCategoryId);
      return;
    }

    manualScrollRef.current = Date.now() + 650;
    setActiveCategoryId(nextCategoryId);
    const stickyOffset = window.matchMedia("(min-width: 768px)").matches ? 120 : 76;
    const top = target.getBoundingClientRect().top + window.scrollY - stickyOffset;
    window.scrollTo({ behavior, top: Math.max(0, top) });
  }

  return (
    <div className={`mx-auto w-full max-w-6xl px-4 pb-8 ${compactTop ? "pt-1" : "pt-3 md:pt-5"}`}>
      {intro ? (
        <MotionDiv {...pageMotion} className="mf-menu-intro mf-organic px-4 pb-4 pt-3 sm:p-5">
          <div className="mx-auto mb-2 flex max-w-[20rem] justify-center md:hidden">
            <BrandLogo className="h-auto w-full drop-shadow-[0_18px_34px_rgba(0,0,0,0.26)]" priority sizes="320px" />
          </div>
          <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,360px)] lg:items-end">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wide text-[#F5CF00]">MAZETTO FOOD menyusi</p>
              <h1 className="mt-1 text-[1.65rem] font-black leading-[1.02] text-white sm:text-4xl">{title}</h1>
              <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-white/70">Lavash, burger, setlar va ichimliklar. Tez tanlang, issiq holda buyurtma qiling.</p>
            </div>
            <SearchBox inputRef={searchInputRef} onClear={clearSearch} query={query} setQuery={setQuery} />
          </div>
        </MotionDiv>
      ) : (
        <div className={`${compactTop ? "mb-3" : "mb-4"} grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(16rem,320px)] sm:items-end`}>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase text-[#F5CF00]">To'liq menyu</p>
            <h2 className="mt-1 text-2xl font-black text-white">{title}</h2>
          </div>
          <SearchBox inputRef={searchInputRef} onClear={clearSearch} query={query} setQuery={setQuery} />
        </div>
      )}

      {!loading && !error && menuSections.length ? (
        <div className="sticky top-[env(safe-area-inset-top)] z-20 -mx-4 mt-3 min-w-0 px-4 py-2 md:top-24" data-menu-category-nav="true">
          <div className="no-scrollbar mf-category-strip flex w-full min-w-0 max-w-full gap-2 overflow-x-auto rounded-[1.25rem] p-1.5" ref={tabScrollerRef}>
            {menuSections.map(({ category }) => (
              <button
                className={tabClass(activeCategoryId === category.id)}
                key={category.id}
                onClick={() => scrollToCategory(category.id)}
                ref={(element) => setTabRef(category.id, element)}
                type="button"
              >
                {categoryLabel(category)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mf-card mt-5 p-6 text-center">
          <h2 className="text-2xl font-black text-white">Menyu yuklanmadi</h2>
          <p className="mt-2 text-sm font-semibold text-white/60">{error}</p>
          <button className="pressable ripple mf-button-primary mt-5 px-5 py-3 font-black" onClick={() => void load()} type="button">
            Qayta urinish
          </button>
        </div>
      ) : null}

      <div className="mt-4 grid min-w-0 gap-5">
        {loading
          ? (
              <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-3 md:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }, (_, index) => <ProductSkeleton key={index} />)}
              </div>
            )
          : !error && menuSections.map(({ category, products }) => (
              <section
                className="scroll-mt-20 md:scroll-mt-32"
                data-category-id={category.id}
                key={category.id}
                ref={(element) => setSectionRef(category.id, element)}
              >
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-wide text-[#F5CF00]">{products.length} ta mahsulot</p>
                    <h2 className="mf-menu-section-heading text-2xl font-black text-white">{categoryLabel(category)}</h2>
                  </div>
                  {category.description ? <p className="mf-menu-section-description hidden max-w-md text-right text-sm font-semibold text-white/56 md:block">{category.description}</p> : null}
                </div>
                <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-3 md:grid-cols-3 xl:grid-cols-4">
                  {products.map((product) => <ProductCard compact key={product.id} product={product} />)}
                </div>
              </section>
            ))}
      </div>

      {!loading && !error && !menuSections.length ? (
        <div className="mf-card mt-5 p-6 text-center text-sm font-bold text-white/60">
          Bu tanlov bo'yicha mahsulot topilmadi.
        </div>
      ) : null}
    </div>
  );
}

function SearchBox({
  onClear,
  inputRef,
  query,
  setQuery,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  onClear: () => void;
  query: string;
  setQuery: (value: string) => void;
}) {
  return (
    <div className="relative min-w-0">
      <input
        className="mf-input w-full px-12 py-3.5 font-semibold"
        placeholder="Taom yoki ichimlik qidiring..."
        ref={inputRef}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-2xl leading-none text-white/70">
        ⌕
      </span>
      {query ? (
        <button
          aria-label="Qidiruvni tozalash"
          className="pressable absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-lg font-black text-[#F5CF00]"
          onClick={onClear}
          type="button"
        >
          x
        </button>
      ) : null}
    </div>
  );
}

function sortSetsFirst(categories: Category[]): Category[] {
  return [...categories].sort((a, b) => getCategoryRank(a) - getCategoryRank(b));
}

function getCategoryRank(category: Category): number {
  return category.code?.toUpperCase() === "SETS" ? -1 : 0;
}

function categoryLabel(category: Category): string {
  if (category.code?.toUpperCase() === "SETS") {
    return "Setlar";
  }

  return category.name;
}

function tabClass(active: boolean): string {
  return `pressable ripple shrink-0 rounded-full px-4 py-2 text-sm font-black ${active ? "mf-button-primary" : "mf-category-tab text-white/82 hover:text-white"}`;
}

function ProductSkeleton() {
  return (
    <div className="mf-product-card mf-product-card-locked is-compact overflow-hidden">
      <div className="skeleton aspect-[1.22/1] w-full" />
      <div className="grid grid-rows-[2.35rem_2.35rem_2.75rem] gap-1.5 p-2.5">
        <div className="skeleton h-5 w-3/4 rounded-full" />
        <div className="skeleton h-3 w-full rounded-full" />
        <div className="flex items-center justify-between">
          <div className="skeleton h-5 w-20 rounded-full" />
          <div className="skeleton h-10 w-[5.65rem] rounded-full" />
        </div>
      </div>
    </div>
  );
}
