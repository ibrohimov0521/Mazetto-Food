"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProductCard } from "../components/product-card";
import { SiteShell } from "../components/site-shell";
import { apiFetch } from "../lib/api";
import { formatMoney, productImage, useCart, type CustomerSession } from "../lib/cart";
import type { Branch, Category, Product } from "../lib/types";

export default function Home() {
  const { customer, setCustomer } = useCart();
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branchId, setBranchId] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [nextBranches, nextCategories, nextProducts] = await Promise.all([
      apiFetch<Branch[]>("/customer/branches"),
      apiFetch<Category[]>("/customer/menu/categories"),
      apiFetch<Product[]>("/customer/menu/products"),
    ]);
    setBranches(nextBranches);
    setCategories(nextCategories);
    setProducts(nextProducts);
    setBranchId((current) => current || nextBranches[0]?.id || "");
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const featured = useMemo(() => products.filter((product) => product.isRecommended).slice(0, 3), [products]);
  const combos = useMemo(() => products.filter((product) => product.isCombo).slice(0, 3), [products]);
  const popular = useMemo(() => products.filter((product) => !product.isCombo).slice(0, 6), [products]);
  const heroProduct = featured[0] ?? popular[0] ?? products[0];

  async function requestCode() {
    await apiFetch<{ challenge: { phone: string; expiresAt: string }; delivery: { status: string; message: string } }>("/customer/auth/request-code", {
      method: "POST",
      body: JSON.stringify({ phone }),
    });
    setPendingVerification(true);
    setMessage("Tasdiqlash kodi yaratildi. Kod Telegram bot orqali kelganda shu yerga kiriting.");
  }

  async function verifyCode() {
    const result = await apiFetch<{ customer: Omit<CustomerSession, "accessToken" | "refreshToken" | "tokenType">; tokens: { accessToken: string; refreshToken: string; tokenType: "Bearer" } }>("/customer/auth/verify-code", {
      method: "POST",
      body: JSON.stringify({ name, phone, code }),
    });
    setCustomer({ ...result.customer, ...result.tokens });
    setPendingVerification(false);
    setCode("");
    setMessage("Profil tasdiqlandi. Savat, sevimlilar va buyurtmalar profilingizga ulandi.");
  }

  return (
    <SiteShell>
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-10">
        <div className="py-4">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-emerald-700">Issiq fast-fud yetkazib berish</p>
          <h1 className="mt-3 max-w-3xl text-5xl font-black leading-tight text-neutral-950 sm:text-6xl">
            MAZETTO FOOD
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-8 text-neutral-600">
            Issiq lavash, burger, xrustik garnirlar, foydali setlar va ichimliklarni eng yaqin filialdan tez buyurtma qiling.
          </p>

          <div className="mt-6 grid max-w-xl gap-3 rounded-xl border border-emerald-100 bg-white p-3 shadow-[0_14px_45px_rgba(22,163,74,0.10)] sm:grid-cols-[1fr_auto]">
            <select
              className="rounded-xl border border-neutral-200 bg-white px-4 py-3 font-bold text-neutral-800 outline-none focus:border-emerald-500"
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
            <Link className="pressable rounded-xl bg-[#16A34A] px-6 py-3 text-center font-black text-white shadow-[0_12px_30px_rgba(22,163,74,0.25)]" href="/menu">
              Buyurtma berish
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold text-neutral-700">
            <span className="rounded-full bg-emerald-50 px-4 py-2 text-emerald-800">Tez oshxona jarayoni</span>
            <span className="rounded-full bg-neutral-100 px-4 py-2">Yetkazib berish yoki olib ketish</span>
            <span className="rounded-full bg-neutral-100 px-4 py-2">Bonusli profil</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl bg-white shadow-[0_24px_80px_rgba(17,24,39,0.12)]">
          {loading ? <div className="skeleton h-72 w-full sm:h-96" /> : <img alt={heroProduct?.name ?? "MAZETTO FOOD taomi"} className="h-72 w-full object-cover sm:h-96" src={productImage(heroProduct?.imageUrl)} />}
          <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="text-sm font-black uppercase text-emerald-700">Bugungi tavsiya</p>
              <h2 className="mt-1 text-2xl font-black text-neutral-950">{heroProduct?.name ?? "Issiq MAZETTO set"}</h2>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-500">
                {heroProduct?.description ?? "Tanlangan filialda buyurtmadan keyin issiq tayyorlanadi."}
              </p>
            </div>
            <span className="rounded-xl bg-emerald-50 px-4 py-3 text-lg font-black text-emerald-700">
              {formatMoney(heroProduct?.variants[0]?.sellingPrice ?? heroProduct?.sellingPrice ?? 0)}
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-8">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {loading ? Array.from({ length: 5 }, (_, index) => <div className="skeleton h-14 w-32 shrink-0 rounded-xl" key={index} />) : categories.map((category) => (
            <Link className="pressable shrink-0 rounded-xl border border-emerald-100 bg-white px-5 py-4 font-black text-neutral-900 shadow-[0_10px_30px_rgba(17,24,39,0.06)] hover:border-emerald-300 hover:text-emerald-700" href={`/menu?category=${category.id}`} key={category.id}>
              {category.name}
            </Link>
          ))}
        </div>
      </section>

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

      <section className="mx-auto max-w-6xl px-4 pb-12">
        <div className="grid gap-5 rounded-xl border border-emerald-100 bg-white p-5 shadow-[0_16px_55px_rgba(15,118,110,0.10)] lg:grid-cols-[1fr_360px]">
          <div>
            <p className="text-sm font-black uppercase text-emerald-700">Telefon orqali profil</p>
            <h2 className="mt-2 text-3xl font-black text-neutral-950">Sevimlilarni saqlang va buyurtmani kuzating.</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-500">Telefon raqamingizni kiriting, keyin MAZETTO Telegram boti yuborgan qisqa kodni tasdiqlang.</p>
          </div>
          <div className="grid gap-3">
            <input className="rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-emerald-500" placeholder="Ismingiz" value={name} onChange={(event) => setName(event.target.value)} />
            <input className="rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-emerald-500" placeholder="+998 telefon raqam" value={phone} onChange={(event) => setPhone(event.target.value)} />
            {pendingVerification ? (
              <>
                <input className="rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-emerald-500" placeholder="Telegram tasdiqlash kodi" value={code} onChange={(event) => setCode(event.target.value)} />
                <button className="pressable rounded-xl bg-[#16A34A] px-5 py-4 font-black text-white disabled:opacity-50" disabled={!phone || !code} onClick={() => void verifyCode()} type="button">
                  Kodni tasdiqlash
                </button>
              </>
            ) : (
              <button className="pressable rounded-xl bg-[#16A34A] px-5 py-4 font-black text-white disabled:opacity-50" disabled={!phone} onClick={() => void requestCode()} type="button">
                Kod olish
              </button>
            )}
            {message ? <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p> : null}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

function ProductSection({ products, title }: { products: Product[]; title: string }) {
  if (!products.length) {
    return null;
  }

  return (
    <section className="mx-auto max-w-6xl px-4 pb-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-black text-neutral-950">{title}</h2>
        <Link className="pressable text-sm font-black text-emerald-700" href="/menu">Menyuni ko'rish</Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => <ProductCard key={product.id} product={product} />)}
      </div>
    </section>
  );
}

function SkeletonProductSection({ title }: { title: string }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-black text-neutral-950">{title}</h2>
        <div className="skeleton h-5 w-24 rounded-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div className="overflow-hidden rounded-xl border border-neutral-100 bg-white shadow-[0_14px_42px_rgba(17,24,39,0.08)]" key={index}>
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
