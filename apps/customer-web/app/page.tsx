"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BrandLogo } from "../components/brand-logo";
import { BranchPicker } from "../components/branch-picker";
import { CustomerAuthPanel } from "../components/customer-auth-panel";
import { HomepageHeroSlider, PromotionSlider } from "../components/homepage-sliders";
import { MotionDiv, cardMotion, pageMotion, sectionMotion } from "../components/motion-primitives";
import { ProductCard } from "../components/product-card";
import { SiteShell } from "../components/site-shell";
import { apiFetch } from "../lib/api";
import { displayCategory, displayCustomerHome, displayProducts } from "../lib/customer-display";
import { formatMoney, useCart } from "../lib/cart";
import type { Branch, Category, CustomerHome, Product } from "../lib/types";

const branchStorageKey = "mazetto.customer.branchId";

export default function Home() {
  const { customer } = useCart();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [home, setHome] = useState<CustomerHome>({ heroSlides: [], promotions: [] });
  const [branchId, setBranchId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const nextBranches = await apiFetch<Branch[]>("/customer/branches");
      const storedBranchId = window.localStorage.getItem(branchStorageKey);
      const nextBranchId =
        nextBranches.find((branch) => branch.id === storedBranchId && branch.acceptsOrders !== false)?.id ??
        nextBranches.find((branch) => branch.acceptsOrders !== false)?.id ??
        nextBranches[0]?.id ??
        "";
      const branchQuery = nextBranchId ? `?branchId=${encodeURIComponent(nextBranchId)}` : "";
      const [nextCategories, nextProducts, nextHome] = await Promise.all([
        apiFetch<Category[]>(`/customer/menu/categories${branchQuery}`),
        apiFetch<Product[]>(`/customer/menu/products${branchQuery}`),
        apiFetch<CustomerHome>(`/customer/home${branchQuery}`),
      ]);
      setBranches(nextBranches);
      setCategories(sortSetsFirst(nextCategories.map(displayCategory)));
      setProducts(displayProducts(nextProducts));
      setHome(displayCustomerHome(nextHome));
      setBranchId((current) => current || nextBranchId);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Ma'lumotlarni yuklab bo'lmadi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const featured = useMemo(() => products.filter((product) => product.isRecommended).slice(0, 3), [products]);
  const combos = useMemo(() => products.filter((product) => product.isCombo).slice(0, 3), [products]);
  const popular = useMemo(() => products.filter((product) => !product.isCombo).slice(0, 6), [products]);

  function selectBranch(nextBranchId: string) {
    setBranchId(nextBranchId);
    window.localStorage.setItem(branchStorageKey, nextBranchId);
    void loadBranchContent(nextBranchId);
  }

  async function loadBranchContent(nextBranchId: string) {
    const branchQuery = nextBranchId ? `?branchId=${encodeURIComponent(nextBranchId)}` : "";
    setLoadError(null);
    try {
      const [nextCategories, nextProducts, nextHome] = await Promise.all([
        apiFetch<Category[]>(`/customer/menu/categories${branchQuery}`),
        apiFetch<Product[]>(`/customer/menu/products${branchQuery}`),
        apiFetch<CustomerHome>(`/customer/home${branchQuery}`),
      ]);
      setCategories(sortSetsFirst(nextCategories.map(displayCategory)));
      setProducts(displayProducts(nextProducts));
      setHome(displayCustomerHome(nextHome));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Filial ma'lumotlari yuklanmadi.");
    }
  }

  return (
    <SiteShell>
      <MotionDiv {...pageMotion} className="mx-auto w-full max-w-6xl px-4 pb-3 pt-5 lg:pt-7">
        <section className="mf-hero-shell mf-organic grid min-w-0 overflow-hidden rounded-[2rem] border border-white/14 bg-[linear-gradient(135deg,rgba(245,245,239,0.96),rgba(245,245,239,0.86))] shadow-[0_24px_70px_rgba(0,0,0,0.26)] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center">
          <div className="min-w-0 p-5 py-7 sm:p-8 lg:p-10">
            <div className="mb-4 w-[min(15rem,70vw)] lg:hidden">
              <BrandLogo className="h-auto w-full" priority sizes="240px" />
            </div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0B7F75]">Issiq fast-fud yetkazib berish</p>
            <h1 className="mt-3 max-w-2xl text-4xl font-black leading-tight text-[#17314A] sm:text-5xl lg:text-6xl">
              Mazali taom,
              <span className="block text-[#0B8F83]">qulay buyurtma!</span>
            </h1>
            <p className="mt-4 max-w-xl text-base font-semibold leading-7 text-[#17314A]/70 sm:text-lg">
              Lavash, burger, setlar va ichimliklarni eng yaqin filialdan tez buyurtma qiling.
            </p>

            <div className="mt-6 grid max-w-xl min-w-0 gap-2 rounded-[1.6rem] border border-[#0B7F75]/12 bg-white/78 p-2.5 shadow-[0_18px_45px_rgba(0,79,85,0.14)] sm:grid-cols-[minmax(0,1fr)_auto]">
            <BranchPicker branches={branches} disabled={loading} onChange={selectBranch} value={branchId} />
            <Link className="pressable ripple mf-button-primary px-5 py-3 text-center font-black" href={branchId ? `/menu?branchId=${branchId}` : "/menu"}>
              Buyurtma berish
            </Link>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-[#17314A]/76 sm:text-sm">
              <span className="rounded-full bg-[#0B8F83]/10 px-3 py-2 text-[#0B7F75]">Tez oshxona jarayoni</span>
              <span className="rounded-full bg-[#F5CF00]/24 px-3 py-2">Yetkazib berish yoki olib ketish</span>
              <span className="rounded-full bg-[#B9B8F0]/24 px-3 py-2">Bonusli profil</span>
            </div>
          </div>
          <MotionDiv {...cardMotion} className="relative min-h-[19rem] overflow-hidden bg-[radial-gradient(circle_at_50%_32%,rgba(245,207,0,0.22),transparent_17rem),linear-gradient(135deg,rgba(8,104,106,0.92),rgba(11,143,131,0.72))] p-5 lg:min-h-[28rem]">
            <div className="absolute right-5 top-5 hidden w-[min(22rem,44vw)] lg:block">
              <BrandLogo className="h-auto w-full drop-shadow-[0_18px_42px_rgba(0,0,0,0.24)]" priority sizes="360px" />
            </div>
            <div className="absolute inset-x-6 bottom-6 rounded-[1.6rem] border border-white/16 bg-white/14 p-4 text-white shadow-[0_20px_54px_rgba(0,0,0,0.18)] backdrop-blur-md">
              <p className="text-sm font-black uppercase text-[#F5CF00]">Bugungi ritm</p>
              <h2 className="mt-2 text-3xl font-black">Tez, issiq, qulay.</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-white/74">Menyudan tanlang, savatga qo'shing va buyurtmani bir necha bosishda yuboring.</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Metric value={formatMoney(featured[0]?.sellingPrice ?? popular[0]?.sellingPrice ?? 0)} label="Boshlang'ich narx" />
                <Metric value={`${featured[0]?.preparationTime ?? popular[0]?.preparationTime ?? 10} daq`} label="Tayyorlanish" />
              </div>
            </div>
          </MotionDiv>
        </section>
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

      {loading ? <HeroSkeleton /> : <HomepageHeroSlider slides={home.heroSlides} />}
      <PromotionSlider promotions={home.promotions} />

      <MotionDiv {...sectionMotion} className="mx-auto w-full max-w-6xl px-4 pb-8">
        <div className="no-scrollbar flex max-w-full gap-3 overflow-x-auto pb-2">
          {loading ? Array.from({ length: 5 }, (_, index) => <div className="skeleton h-14 w-32 shrink-0 rounded-xl" key={index} />) : categories.map((category) => (
            <Link className="pressable ripple mazetto-glass-chip shrink-0 rounded-2xl px-5 py-4 font-black text-white hover:border-[#22C55E]/60 hover:text-[#67E8F9]" href={`/menu?category=${category.id}`} key={category.id}>
              {category.name}
            </Link>
          ))}
        </div>
      </MotionDiv>

      {loading ? (
        <>
          <SkeletonProductSection title="Tavsiya qilamiz" />
          <SkeletonProductSection title="Ko'p buyurtma qilinadi" />
        </>
      ) : (
        <>
          <ProductSection products={featured.length ? featured : popular.slice(0, 3)} title="Tavsiya qilamiz" />
          <ProductSection products={popular} title="Ko'p buyurtma qilinadi" />
          <ProductSection products={combos} title="Foydali setlar" />
        </>
      )}

      <MotionDiv {...sectionMotion} className="mx-auto max-w-6xl px-4 pb-12">
        <div className="mf-card mazetto-liquid-surface grid min-w-0 gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,360px)]">
          <div className="min-w-0">
            <p className="text-sm font-black uppercase text-[#67E8F9]">Telefon orqali profil</p>
            <h2 className="mt-2 text-3xl font-black text-white">Sevimlilarni saqlang va buyurtmani kuzating.</h2>
            <p className="mt-2 text-sm leading-6 text-white/60">Telefon raqamingizni kiriting, keyin MAZETTO Telegram boti yuborgan qisqa kodni tasdiqlang.</p>
          </div>
          <div className="grid min-w-0 gap-3">
            {customer ? (
              <CustomerAuthPanel />
            ) : (
              <CustomerAuthPanel />
            )}
          </div>
        </div>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="mazetto-glass-chip rounded-2xl p-3">
      <p className="text-xs font-black uppercase text-white/50">{label}</p>
      <p className="mt-1 font-black text-[#67E8F9]">{value}</p>
    </div>
  );
}

function HeroSkeleton() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-6 lg:py-10">
      <div className="mazetto-liquid-surface grid min-h-[33rem] min-w-0 overflow-hidden rounded-[2rem] lg:min-h-[30rem] lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="p-5 sm:p-7 lg:p-9">
          <div className="skeleton h-9 w-28 rounded-full" />
          <div className="skeleton mt-6 h-12 w-4/5 rounded-full" />
          <div className="skeleton mt-3 h-12 w-3/5 rounded-full" />
          <div className="skeleton mt-5 h-5 w-full rounded-full" />
          <div className="skeleton mt-2 h-5 w-2/3 rounded-full" />
        </div>
        <div className="skeleton min-h-[19rem] lg:min-h-[30rem]" />
      </div>
    </section>
  );
}

function ProductSection({ products, title }: { products: Product[]; title: string }) {
  if (!products.length) {
    return null;
  }

  return (
    <MotionDiv {...sectionMotion} className="mx-auto max-w-6xl px-4 pb-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-black text-white">{title}</h2>
        <Link className="pressable text-sm font-black text-[#67E8F9]" href="/menu">Menyuni ko'rish</Link>
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => <ProductCard compact key={product.id} product={product} />)}
      </div>
    </MotionDiv>
  );
}

function SkeletonProductSection({ title }: { title: string }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-black text-white">{title}</h2>
        <div className="skeleton h-5 w-24 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 3 }, (_, index) => (
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
