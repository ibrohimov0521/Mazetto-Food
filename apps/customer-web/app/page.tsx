"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { HomepageHeroSlider, PromotionSlider } from "../components/homepage-sliders";
import { MotionDiv, cardMotion, pageMotion, sectionMotion } from "../components/motion-primitives";
import { ProductCard } from "../components/product-card";
import { SiteShell } from "../components/site-shell";
import { apiFetch } from "../lib/api";
import { formatMoney, useCart, type CustomerSession } from "../lib/cart";
import type { Branch, Category, CustomerHome, Product } from "../lib/types";

const branchStorageKey = "mazetto.customer.branchId";
type CustomerAuthDelivery = {
  status: "SENT" | "TELEGRAM_LINK_REQUIRED" | "PENDING_INTEGRATION" | string;
  message: string;
  botUrl?: string;
};

export default function Home() {
  const { customer, setCustomer, showToast } = useCart();
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [telegramBotUrl, setTelegramBotUrl] = useState<string | null>(null);
  const [requestingCode, setRequestingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
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
      setCategories(sortSetsFirst(nextCategories));
      setProducts(nextProducts);
      setHome(nextHome);
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

  async function requestCode() {
    setRequestingCode(true);
    setMessage(null);
    try {
      const result = await apiFetch<{ challenge: { phone: string; expiresAt: string }; delivery: CustomerAuthDelivery }>("/customer/auth/request-code", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      setPendingVerification(true);
      setCode("");
      setTelegramBotUrl(result.delivery.botUrl ?? null);

      if (result.delivery.status === "TELEGRAM_LINK_REQUIRED") {
        setMessage("Telefon raqamingizni Telegram orqali bir marta tasdiqlashingiz kerak. Botda telefon raqamingizni yuboring va bu yerga qayting.");
        return;
      }

      if (result.delivery.status === "PENDING_INTEGRATION") {
        setMessage("Telegram orqali kod yuborish hozircha sozlanmagan. Keyinroq qayta urinib ko'ring.");
        return;
      }

      setMessage(result.delivery.message || "Tasdiqlash kodi Telegram orqali yuborildi. Kodni shu yerga kiriting.");
    } catch (error) {
      const text = error instanceof Error ? error.message : "Kod yuborib bo'lmadi";
      setMessage(text.includes("Too many") ? "Juda ko'p urinish bo'ldi. Bir oz kutib qayta urinib ko'ring." : text);
      showToast("Kod yuborilmadi");
    } finally {
      setRequestingCode(false);
    }
  }

  async function verifyCode() {
    setVerifyingCode(true);
    setMessage(null);
    try {
      const result = await apiFetch<{ customer: Omit<CustomerSession, "accessToken" | "refreshToken" | "tokenType">; tokens: { accessToken: string; refreshToken: string; tokenType: "Bearer" } }>("/customer/auth/verify-code", {
        method: "POST",
        body: JSON.stringify({ name, phone, code }),
      });
      setCustomer({ ...result.customer, ...result.tokens });
      setPendingVerification(false);
      setCode("");
      setTelegramBotUrl(null);
      setMessage("Profil tasdiqlandi. Savat, sevimlilar va buyurtmalar profilingizga ulandi.");
      showToast("Telefon tasdiqlandi");
    } catch (error) {
      const text = error instanceof Error ? error.message : "Kodni tasdiqlab bo'lmadi";
      setMessage(text.includes("expired") || text.includes("Invalid") ? "Kod noto'g'ri yoki muddati tugagan. Qayta kod oling." : text);
      showToast("Kod tasdiqlanmadi");
    } finally {
      setVerifyingCode(false);
    }
  }

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
      setCategories(sortSetsFirst(nextCategories));
      setProducts(nextProducts);
      setHome(nextHome);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Filial ma'lumotlari yuklanmadi.");
    }
  }

  return (
    <SiteShell>
      <MotionDiv {...pageMotion} className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-3 pt-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:pt-10">
        <div className="min-w-0 py-4">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-[#67E8F9]">Issiq fast-fud yetkazib berish</p>
          <h1 className="mt-3 max-w-3xl text-5xl font-black leading-tight text-white sm:text-6xl">
            MAZETTO FOOD
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-8 text-white/68">
            Issiq lavash, burger, xrustik garnirlar, foydali setlar va ichimliklarni eng yaqin filialdan tez buyurtma qiling.
          </p>

          <div className="mf-card mazetto-liquid-surface mt-6 grid max-w-xl min-w-0 gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <select
              className="mf-input px-4 py-3 font-bold"
              value={branchId}
              onChange={(event) => selectBranch(event.target.value)}
            >
              {branches.map((branch) => (
                <option disabled={branch.acceptsOrders === false} key={branch.id} value={branch.id}>
                  {branch.name}{branch.acceptsOrders === false ? " - hozir yopiq" : ""}
                </option>
              ))}
            </select>
            <Link className="pressable ripple mf-button-primary px-6 py-3 text-center font-black" href={branchId ? `/menu?branchId=${branchId}` : "/menu"}>
              Buyurtma berish
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold text-white/76">
            <span className="mazetto-glass-chip rounded-full px-4 py-2 text-[#67E8F9]">Tez oshxona jarayoni</span>
            <span className="mazetto-glass-chip rounded-full px-4 py-2">Yetkazib berish yoki olib ketish</span>
            <span className="mazetto-glass-chip rounded-full px-4 py-2">Bonusli profil</span>
          </div>
        </div>

        <MotionDiv {...cardMotion} className="mf-card mazetto-liquid-surface min-w-0 p-5">
          <p className="text-sm font-black uppercase text-[#67E8F9]">Bugungi ritm</p>
          <h2 className="mt-2 text-3xl font-black text-white">Tez, issiq, qulay.</h2>
          <p className="mt-3 text-sm leading-6 text-white/60">Menyudan tanlang, savatga qo'shing va buyurtmani bir necha bosishda yuboring.</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Metric value={formatMoney(featured[0]?.sellingPrice ?? popular[0]?.sellingPrice ?? 0)} label="Boshlang'ich narx" />
            <Metric value={`${featured[0]?.preparationTime ?? popular[0]?.preparationTime ?? 10} daq`} label="Tayyorlanish" />
          </div>
        </MotionDiv>
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
              <div className="mf-card-soft p-4">
                <p className="text-sm font-black text-white">Profil ulangan</p>
                <p className="mt-1 text-sm font-semibold text-white/60">{customer.name} · {customer.phone}</p>
                <Link className="pressable ripple mf-button-secondary mt-4 inline-flex px-4 py-3 text-sm font-black" href="/orders">
                  Buyurtmalarim
                </Link>
              </div>
            ) : (
              <>
                <input className="mf-input px-4 py-3" placeholder="Ismingiz" value={name} onChange={(event) => setName(event.target.value)} />
                <input className="mf-input px-4 py-3" placeholder="+998 telefon raqam" value={phone} onChange={(event) => setPhone(event.target.value)} />
                {pendingVerification ? (
                  <>
                    <input className="mf-input px-4 py-3" inputMode="numeric" placeholder="Telegram tasdiqlash kodi" value={code} onChange={(event) => setCode(event.target.value)} />
                    <button className="pressable ripple mf-button-primary px-5 py-4 font-black disabled:opacity-50" disabled={!phone || !code || verifyingCode} onClick={() => void verifyCode()} type="button">
                      {verifyingCode ? "Tekshirilmoqda..." : "Kodni tasdiqlash"}
                    </button>
                    {telegramBotUrl ? (
                      <Link className="pressable ripple mazetto-glass-chip rounded-2xl px-5 py-4 text-center font-black text-[#67E8F9]" href={telegramBotUrl} target="_blank">
                        Telegram botga o'tish
                      </Link>
                    ) : null}
                    <button className="pressable ripple mf-button-secondary px-5 py-3 text-sm font-black disabled:opacity-50" disabled={!phone || requestingCode} onClick={() => void requestCode()} type="button">
                      {requestingCode ? "Yuborilmoqda..." : "Kodni qayta yuborish"}
                    </button>
                  </>
                ) : (
                  <button className="pressable ripple mf-button-primary px-5 py-4 font-black disabled:opacity-50" disabled={!phone || requestingCode} onClick={() => void requestCode()} type="button">
                    {requestingCode ? "Yuborilmoqda..." : "Kod olish"}
                  </button>
                )}
              </>
            )}
            {message ? <p className="rounded-2xl bg-[#22C55E]/14 px-4 py-3 text-sm font-bold text-[#67E8F9]">{message}</p> : null}
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
      <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => <ProductCard key={product.id} product={product} />)}
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div className="mf-card overflow-hidden" key={index}>
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
        ))}
      </div>
    </section>
  );
}
