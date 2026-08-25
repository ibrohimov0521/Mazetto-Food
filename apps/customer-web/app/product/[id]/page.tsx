"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SiteShell } from "../../../components/site-shell";
import { apiFetch } from "../../../lib/api";
import { formatMoney, productImage, useCart } from "../../../lib/cart";
import type { Product } from "../../../lib/types";

export default function ProductPage({ params }: { params: { id: string } }) {
  return (
    <SiteShell>
      <ProductDetails id={params.id} />
    </SiteShell>
  );
}

function ProductDetails({ id }: { id: string }) {
  const { addItem, isFavorite, toggleFavorite } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [variantId, setVariantId] = useState<string | undefined>();
  const [modifierIds, setModifierIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    async function load() {
      const nextProduct = await apiFetch<Product>(`/customer/menu/products/${id}`);
      setProduct(nextProduct);
      setVariantId(nextProduct.variants.find((variant) => variant.isDefault)?.id ?? nextProduct.variants[0]?.id);
    }

    void load();
  }, [id]);

  const variant = useMemo(
    () => product?.variants.find((candidate) => candidate.id === variantId) ?? product?.variants[0],
    [product, variantId],
  );
  const selectedModifiers = product?.modifiers.filter((link) => modifierIds.includes(link.modifier.id)) ?? [];
  const ingredientHints = useMemo(() => {
    const words = (product?.description ?? "")
      .split(/[,.+]/)
      .map((value) => value.trim())
      .filter((value) => value.length > 2)
      .slice(0, 4);
    const options = product?.modifiers.map((link) => link.modifier.name).slice(0, 4) ?? [];
    return [...words, ...options].slice(0, 6);
  }, [product]);
  const total =
    ((Number(variant?.sellingPrice ?? product?.sellingPrice ?? 0) +
      selectedModifiers.reduce((sum, link) => sum + Number(link.modifier.price), 0)) *
      quantity);

  if (!product) {
    return (
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="overflow-hidden rounded-xl bg-white shadow-[0_18px_60px_rgba(15,118,110,0.14)]">
          <div className="skeleton h-96 w-full" />
          <div className="grid gap-3 p-5 sm:grid-cols-3">
            <div className="skeleton h-20 rounded-xl" />
            <div className="skeleton h-20 rounded-xl" />
            <div className="skeleton h-20 rounded-xl" />
          </div>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-[0_16px_55px_rgba(15,118,110,0.12)]">
          <div className="skeleton h-5 w-32 rounded-full" />
          <div className="skeleton mt-5 h-12 w-4/5 rounded-full" />
          <div className="skeleton mt-4 h-5 w-full rounded-full" />
          <div className="skeleton mt-2 h-5 w-2/3 rounded-full" />
        </div>
      </main>
    );
  }

  return (
    <section className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="overflow-hidden rounded-xl bg-white shadow-[0_18px_60px_rgba(15,118,110,0.14)]">
        <img alt={product.name} className="h-96 w-full object-cover" src={productImage(product.imageUrl)} />
        <div className="grid gap-3 p-5 sm:grid-cols-3">
          <Metric label="Tayyorlanish" value={`${product.preparationTime ?? 10} daq`} />
          <Metric label="Bo'lim" value={product.category?.name ?? "Menyu"} />
          <Metric label="Narx" value={formatMoney(product.sellingPrice)} />
        </div>
      </div>
      <div className="rounded-xl bg-white p-5 shadow-[0_16px_55px_rgba(15,118,110,0.12)]">
        <div className="flex items-center justify-between gap-3">
          <Link className="pressable text-sm font-bold text-emerald-700" href="/menu">Menyuga qaytish</Link>
          <button
            aria-label="Sevimlilarga qo'shish"
            className={`pressable h-11 w-11 rounded-full text-lg font-black shadow ${isFavorite(product.id) ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-800"}`}
            onClick={() => toggleFavorite(product.id)}
            type="button"
          >
            ♥
          </button>
        </div>
        <h1 className="mt-3 text-4xl font-black text-neutral-950">{product.name}</h1>
        <p className="mt-3 text-base leading-7 text-neutral-600">{product.description ?? "Buyurtmadan keyin issiq tayyorlanadi."}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {(ingredientHints.length ? ingredientHints : ["Yangi", "Buyurtma bilan tayyorlanadi", "Oshxonaga yuboriladi"]).map((item) => (
            <span className="rounded-full bg-neutral-100 px-3 py-2 text-xs font-black text-neutral-700" key={item}>{item}</span>
          ))}
        </div>

        <div className="mt-6 grid gap-5">
          <div>
            <h2 className="text-sm font-black uppercase text-neutral-500">Turini tanlang</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {product.variants.map((item) => (
                <button className={pillClass(variantId === item.id)} key={item.id} onClick={() => setVariantId(item.id)} type="button">
                  {item.name} · {formatMoney(item.sellingPrice)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-black uppercase text-neutral-500">Qo'shimchalar</h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {product.modifiers.map(({ modifier }) => (
                <label className="pressable flex items-center justify-between rounded-2xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm font-semibold" key={modifier.id}>
                  <span>{modifier.name}</span>
                  <span className="flex items-center gap-2 text-emerald-700">
                    {formatMoney(modifier.price)}
                    <input checked={modifierIds.includes(modifier.id)} onChange={(event) => setModifierIds((current) => event.target.checked ? [...current, modifier.id] : current.filter((value) => value !== modifier.id))} type="checkbox" />
                  </span>
                </label>
              ))}
            </div>
          </div>

          <textarea className="min-h-24 rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-emerald-500" placeholder="Oshxonaga izoh" value={notes} onChange={(event) => setNotes(event.target.value)} />

          <div className="sticky bottom-3 z-10 flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/95 p-3 shadow-[0_18px_45px_rgba(17,24,39,0.14)] backdrop-blur">
            <div className="flex items-center gap-2">
              <button className="pressable h-11 w-11 rounded-full bg-white text-xl font-bold" onClick={() => setQuantity(Math.max(1, quantity - 1))} type="button">-</button>
              <span className="w-10 text-center text-lg font-black">{quantity}</span>
              <button className="pressable h-11 w-11 rounded-full bg-white text-xl font-bold" onClick={() => setQuantity(quantity + 1)} type="button">+</button>
            </div>
            <button
              className="pressable rounded-2xl bg-emerald-600 px-5 py-4 font-bold text-white"
              onClick={() =>
                addItem({
                  productId: product.id,
                  productName: product.name,
                  imageUrl: product.imageUrl,
                  variantId: variant?.id,
                  variantName: variant?.name,
                  unitPrice: variant?.sellingPrice ?? product.sellingPrice,
                  quantity,
                  notes,
                  modifiers: selectedModifiers.map(({ modifier }) => ({
                    modifierId: modifier.id,
                    name: modifier.name,
                    price: modifier.price,
                  })),
                })
              }
              type="button"
            >
              Savatga qo'shish · {formatMoney(total)}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function pillClass(active: boolean): string {
  return `pressable rounded-xl px-4 py-3 text-sm font-bold ${active ? "bg-[#16A34A] text-white shadow-[0_10px_24px_rgba(22,163,74,0.18)]" : "bg-neutral-100 text-neutral-800"}`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-emerald-50 p-3">
      <p className="text-xs font-black uppercase text-emerald-700">{label}</p>
      <p className="mt-1 font-black text-neutral-950">{value}</p>
    </div>
  );
}
