"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CustomerAuthPanel } from "../components/customer-auth-panel";
import { HomepageHeroSlider, PromotionSlider } from "../components/homepage-sliders";
import { MediaImage } from "../components/media-image";
import { MotionDiv, pageMotion, sectionMotion } from "../components/motion-primitives";
import { ProductCard } from "../components/product-card";
import { SiteShell } from "../components/site-shell";
import { apiFetch } from "../lib/api";
import { displayCategory, displayCustomerHome, displayProducts } from "../lib/customer-display";
import type { Category, CustomerHome, Product } from "../lib/types";

export default function Home({ initial }: { initial?: { categories: Category[]; products: Product[]; home: CustomerHome } }) {
  const [categories, setCategories] = useState<Category[]>(() => sortSetsFirst((initial?.categories ?? []).map(displayCategory)));
  const [products, setProducts] = useState<Product[]>(() => displayProducts(initial?.products ?? []));
  const [home, setHome] = useState<CustomerHome>(() => displayCustomerHome(initial?.home ?? { heroSlides: [], promotions: [] }));
  const [loading, setLoading] = useState(!initial);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadVersion = useRef(0);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    if (!initial) setLoading(true);
    setLoadError(null);
    try {
      const [nextCategories, nextProducts, nextHome] = await Promise.all([
        apiFetch<Category[]>("/customer/menu/categories"),
        apiFetch<Product[]>("/customer/menu/products"),
        apiFetch<CustomerHome>("/customer/home"),
      ]);
      if (version !== loadVersion.current) return;
      setCategories(sortSetsFirst(nextCategories.map(displayCategory)));
      setProducts(displayProducts(nextProducts));
      setHome(displayCustomerHome(nextHome));
    } catch (error) {
      if (version !== loadVersion.current) return;
      setLoadError(error instanceof Error ? error.message : "Ma'lumotlarni yuklab bo'lmadi.");
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [initial]);

  useEffect(() => {
    void load();
    return () => { loadVersion.current++; };
  }, [load]);

  const featured = useMemo(() => products.filter((product) => product.isRecommended).slice(0, 4), [products]);
  const combos = useMemo(() => products.filter((product) => product.isCombo).slice(0, 4), [products]);
  const popular = useMemo(() => products.filter((product) => !product.isCombo).slice(0, 6), [products]);
  const primaryHero = home.heroSlides[0];
  const heroProduct = products.find((product) => product.id === primaryHero?.product?.id) ?? featured[0] ?? popular[0] ?? products[0];

  return (
    <SiteShell>
      <MotionDiv {...pageMotion} className="mx-auto w-full max-w-6xl px-3 pb-3 pt-4 sm:px-4 lg:pt-5">
        <HomepageHeroSlider fallbackProduct={heroProduct} loading={loading} menuHref="/menu" slides={home.heroSlides} />
      </MotionDiv>

      {loadError ? (
        <section className="mx-auto max-w-6xl px-4 pb-6">
          <div className="mf-card p-6 text-center">
            <h2 className="text-2xl font-black text-white">Ma'lumotlar yuklanmadi</h2>
            <p className="mt-2 text-sm font-semibold text-white/60">{loadError}</p>
            <button className="pressable ripple mf-button-primary mt-5 px-5 py-3 font-black" onClick={() => void load()} type="button">
              Qayta urinish
            </button>
          </div>
        </section>
      ) : null}

      <PromotionSlider promotions={home.promotions} />

      {loading ? <SkeletonProductSection title="Tavsiya qilamiz" /> : <ProductSection priority products={featured.length ? featured : popular.slice(0, 4)} title="Tavsiya qilamiz" />}

      <MotionDiv {...sectionMotion} className="mx-auto w-full max-w-6xl px-4 pb-8">
        <div className="no-scrollbar mf-home-category-row flex max-w-full gap-2.5 overflow-x-auto pb-2 sm:gap-3">
          {loading ? Array.from({ length: 5 }, (_, index) => <div className="skeleton h-24 w-24 shrink-0 rounded-[1.35rem]" key={index} />) : categories.map((category) => (
            <Link className="pressable ripple mf-home-category-card shrink-0" href={`/menu?category=${category.id}`} key={category.id}>
              <MediaImage
                alt={category.name}
                aspectClassName="h-14 w-14"
                className="rounded-full"
                fallbackLabel={category.name}
                sizes="56px"
                src={category.imageUrl}
              />
              <span>{category.name}</span>
            </Link>
          ))}
        </div>
      </MotionDiv>

      {loading ? (
        <>
          <SkeletonProductSection title="Ko'p buyurtma qilinadi" />
        </>
      ) : (
        <>
          <ProductSection products={popular} title="Ko'p buyurtma qilinadi" />
          <ProductSection products={combos} title="Foydali setlar" />
        </>
      )}

      <MotionDiv {...sectionMotion} className="mx-auto max-w-6xl px-4 pb-12">
        <section className="mx-auto max-w-lg border-t border-[#0B7F75]/15 pt-6"><CustomerAuthPanel /></section>
      </MotionDiv>
    </SiteShell>
  );
}

function sortSetsFirst(categories: Category[]): Category[] {
  return [...categories].sort((a, b) => getCategoryRank(a) - getCategoryRank(b));
}

function getCategoryRank(category: Category): number {
  if (category.code?.toUpperCase() === "SETS") {
    return -1;
  }

  return 0;
}

function ProductSection({ products, title, priority = false }: { products: Product[]; title: string; priority?: boolean }) {
  if (!products.length) {
    return null;
  }

  return (
    <MotionDiv {...sectionMotion} className="mf-home-products mx-auto max-w-6xl px-4 pb-7">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="mf-section-heading">{title}</h2>
        <Link className="pressable mf-section-link text-sm font-black" href="/menu">Menyuni ko'rish</Link>
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {products.map((product, index) => <ProductCard compact key={product.id} priority={priority && index < 4} product={product} />)}
      </div>
    </MotionDiv>
  );
}

function SkeletonProductSection({ title }: { title: string }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="mf-section-heading">{title}</h2>
        <div className="skeleton h-5 w-24 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="mf-card overflow-hidden" key={index}>
            <div className="skeleton aspect-square w-full" />
            <div className="grid gap-2 p-3">
              <div className="skeleton h-5 w-3/4 rounded-full" />
              <div className="skeleton h-3 w-full rounded-full" />
              <div className="skeleton h-3 w-2/3 rounded-full" />
              <div className="flex items-center justify-between">
                <div className="skeleton h-5 w-20 rounded-full" />
                <div className="skeleton h-10 w-10 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
