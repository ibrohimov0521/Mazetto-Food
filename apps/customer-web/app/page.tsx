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

  const load = useCallback(async () => {
    const [nextBranches, nextCategories, nextProducts] = await Promise.all([
      apiFetch<Branch[]>("/customer/branches"),
      apiFetch<Category[]>("/customer/menu/categories"),
      apiFetch<Product[]>("/customer/menu/products"),
    ]);
    setBranches(nextBranches);
    setCategories(nextCategories);
    setProducts(nextProducts);
    setBranchId((current) => current || nextBranches[0]?.id || "");
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
    setMessage("Verification challenge created. Telegram bot delivery is the next integration step; enter the Telegram code here when available.");
  }

  async function verifyCode() {
    const result = await apiFetch<{ customer: Omit<CustomerSession, "accessToken" | "refreshToken" | "tokenType">; tokens: { accessToken: string; refreshToken: string; tokenType: "Bearer" } }>("/customer/auth/verify-code", {
      method: "POST",
      body: JSON.stringify({ name, phone, code }),
    });
    setCustomer({ ...result.customer, ...result.tokens });
    setPendingVerification(false);
    setCode("");
    setMessage("Account verified. Your cart, favorites, and orders are connected.");
  }

  return (
    <SiteShell>
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-10">
        <div className="py-4">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-emerald-700">Fresh restaurant delivery</p>
          <h1 className="mt-3 max-w-3xl text-5xl font-black leading-tight text-neutral-950 sm:text-6xl">
            MAZETTO FOOD
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-8 text-neutral-600">
            Hot lavash, burgers, crispy sides, combos, and drinks from the closest branch. Built for fast mobile ordering and smooth pickup or delivery.
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
            <Link className="rounded-xl bg-[#16A34A] px-6 py-3 text-center font-black text-white shadow-[0_12px_30px_rgba(22,163,74,0.25)]" href="/menu">
              Order now
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold text-neutral-700">
            <span className="rounded-full bg-emerald-50 px-4 py-2 text-emerald-800">Fast kitchen flow</span>
            <span className="rounded-full bg-neutral-100 px-4 py-2">Pickup or delivery</span>
            <span className="rounded-full bg-neutral-100 px-4 py-2">Bonus profile</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl bg-white shadow-[0_24px_80px_rgba(17,24,39,0.12)]">
          <img alt={heroProduct?.name ?? "MAZETTO FOOD meal"} className="h-72 w-full object-cover sm:h-96" src={productImage(heroProduct?.imageUrl)} />
          <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="text-sm font-black uppercase text-emerald-700">Today&apos;s pick</p>
              <h2 className="mt-1 text-2xl font-black text-neutral-950">{heroProduct?.name ?? "Fresh MAZETTO combo"}</h2>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-500">
                {heroProduct?.description ?? "Prepared warm after checkout from your selected branch."}
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
          {categories.map((category) => (
            <Link className="shrink-0 rounded-xl border border-emerald-100 bg-white px-5 py-4 font-black text-neutral-900 shadow-[0_10px_30px_rgba(17,24,39,0.06)] transition hover:border-emerald-300 hover:text-emerald-700" href={`/menu?category=${category.id}`} key={category.id}>
              {category.name}
            </Link>
          ))}
        </div>
      </section>

      <ProductSection products={featured.length ? featured : popular.slice(0, 3)} title="Featured Products" />
      <ProductSection products={popular} title="Popular Now" />
      <ProductSection products={combos} title="Combo Offers" />

      <section className="mx-auto max-w-6xl px-4 pb-12">
        <div className="grid gap-5 rounded-xl border border-emerald-100 bg-white p-5 shadow-[0_16px_55px_rgba(15,118,110,0.10)] lg:grid-cols-[1fr_360px]">
          <div>
            <p className="text-sm font-black uppercase text-emerald-700">Phone profile</p>
            <h2 className="mt-2 text-3xl font-black text-neutral-950">Save favorites and track every order.</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-500">Enter your phone number, then confirm the short-lived code delivered through the MAZETTO Telegram bot.</p>
          </div>
          <div className="grid gap-3">
            <input className="rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-emerald-500" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
            <input className="rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-emerald-500" placeholder="+998 phone number" value={phone} onChange={(event) => setPhone(event.target.value)} />
            {pendingVerification ? (
              <>
                <input className="rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-emerald-500" placeholder="Telegram verification code" value={code} onChange={(event) => setCode(event.target.value)} />
                <button className="rounded-xl bg-[#16A34A] px-5 py-4 font-black text-white disabled:opacity-50" disabled={!phone || !code} onClick={() => void verifyCode()} type="button">
                  Verify code
                </button>
              </>
            ) : (
              <button className="rounded-xl bg-[#16A34A] px-5 py-4 font-black text-white disabled:opacity-50" disabled={!phone} onClick={() => void requestCode()} type="button">
                Request code
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
        <Link className="text-sm font-black text-emerald-700" href="/menu">View menu</Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => <ProductCard key={product.id} product={product} />)}
      </div>
    </section>
  );
}
