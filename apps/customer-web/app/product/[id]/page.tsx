"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { MediaImage } from "../../../components/media-image";
import { MotionButton, MotionDiv, buttonMotion, cardMotion, hapticTap, imageMotion, pageMotion } from "../../../components/motion-primitives";
import { SiteShell } from "../../../components/site-shell";
import { apiFetch } from "../../../lib/api";
import { formatMoney, useCart } from "../../../lib/cart";
import type { Product } from "../../../lib/types";

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <SiteShell>
      <ProductDetails id={id} />
    </SiteShell>
  );
}

function ProductDetails({ id }: { id: string }) {
  const imageRef = useRef<HTMLDivElement | null>(null);
  const { addItem, isFavorite, toggleFavorite, triggerCartFlight } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [variantId, setVariantId] = useState<string | undefined>();
  const [modifierIds, setModifierIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setError(null);
      try {
        const nextProduct = await apiFetch<Product>(`/customer/menu/products/${id}`);
        setProduct(nextProduct);
        setVariantId(nextProduct.variants.find((variant) => variant.isDefault)?.id ?? nextProduct.variants[0]?.id);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Mahsulot topilmadi.");
      }
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

  if (error) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-10 text-center">
        <div className="mf-card p-8">
          <h1 className="text-3xl font-black text-white">Mahsulot ochilmadi</h1>
          <p className="mt-3 text-white/60">{error}</p>
          <Link className="pressable ripple mf-button-primary mt-5 inline-flex px-5 py-3 font-black" href="/menu">
            Menyuga qaytish
          </Link>
        </div>
      </section>
    );
  }

  if (!product) {
    return (
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="mf-card overflow-hidden">
          <div className="skeleton h-96 w-full" />
          <div className="grid gap-3 p-5 sm:grid-cols-3">
            <div className="skeleton h-20 rounded-xl" />
            <div className="skeleton h-20 rounded-xl" />
            <div className="skeleton h-20 rounded-xl" />
          </div>
        </div>
        <div className="mf-card p-5">
          <div className="skeleton h-5 w-32 rounded-full" />
          <div className="skeleton mt-5 h-12 w-4/5 rounded-full" />
          <div className="skeleton mt-4 h-5 w-full rounded-full" />
          <div className="skeleton mt-2 h-5 w-2/3 rounded-full" />
        </div>
      </main>
    );
  }

  return (
    <MotionDiv {...pageMotion} className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <MotionDiv {...cardMotion} className="mf-card min-w-0 overflow-hidden">
        <MediaImage
          alt={product.name}
          aspectClassName="aspect-[4/3] min-h-[18rem] sm:aspect-[16/11] lg:min-h-[24rem]"
          className="floating-image will-change-transform"
          motionProps={{
            ...imageMotion,
            layoutId: `product-image-${product.id}`,
          }}
          priority
          ref={imageRef}
          sizes="(max-width: 1024px) 100vw, 45vw"
          src={product.imageUrl}
        />
        <div className="grid gap-3 p-5 sm:grid-cols-3">
          <Metric label="Tayyorlanish" value={`${product.preparationTime ?? 10} daq`} />
          <Metric label="Bo'lim" value={product.category?.name ?? "Menyu"} />
          <Metric label="Narx" value={formatMoney(product.sellingPrice)} />
        </div>
      </MotionDiv>
      <div className="mf-card min-w-0 p-5">
        <div className="flex items-center justify-between gap-3">
          <Link className="pressable text-sm font-bold text-[#67E8F9]" href="/menu">Menyuga qaytish</Link>
          <button
            aria-label="Sevimlilarga qo'shish"
            className={`pressable h-11 w-11 rounded-full text-lg font-black shadow ${isFavorite(product.id) ? "bg-[#22C55E] text-[#04130B]" : "bg-white/10 text-white"}`}
            onClick={() => {
              hapticTap(8);
              toggleFavorite(product.id);
            }}
            type="button"
          >
            ♥
          </button>
        </div>
        <h1 className="mt-3 break-words text-4xl font-black text-white">{product.name}</h1>
        <p className="mt-3 text-base leading-7 text-white/64">{product.description ?? "Buyurtmadan keyin issiq tayyorlanadi."}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {(ingredientHints.length ? ingredientHints : ["Yangi", "Buyurtma bilan tayyorlanadi", "Oshxonaga yuboriladi"]).map((item) => (
            <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-black text-white/76" key={item}>{item}</span>
          ))}
        </div>

        <div className="mt-6 grid gap-5">
          <div>
            <h2 className="text-sm font-black uppercase text-white/50">Turini tanlang</h2>
            <div className="mt-2 flex min-w-0 flex-wrap gap-2">
              {product.variants.map((item) => (
                <button className={pillClass(variantId === item.id)} key={item.id} onClick={() => setVariantId(item.id)} type="button">
                  {item.name} · {formatMoney(item.sellingPrice)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-black uppercase text-white/50">Qo'shimchalar</h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {product.modifiers.map(({ modifier }) => (
                <label className="pressable mf-card-soft flex min-w-0 items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-white" key={modifier.id}>
                  <span className="min-w-0 break-words">{modifier.name}</span>
                  <span className="flex shrink-0 items-center gap-2 text-[#67E8F9]">
                    {formatMoney(modifier.price)}
                    <input checked={modifierIds.includes(modifier.id)} onChange={(event) => setModifierIds((current) => event.target.checked ? [...current, modifier.id] : current.filter((value) => value !== modifier.id))} type="checkbox" />
                  </span>
                </label>
              ))}
            </div>
          </div>

          <textarea className="mf-input min-h-24 px-4 py-3" placeholder="Oshxonaga izoh" value={notes} onChange={(event) => setNotes(event.target.value)} />

          <div className="sticky bottom-3 z-10 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-[1.6rem] border border-[#22C55E]/24 bg-[#181818]/92 p-3 shadow-[0_18px_45px_rgba(0,0,0,0.34)] backdrop-blur">
            <div className="flex shrink-0 items-center gap-2">
              <button className="pressable h-11 w-11 rounded-full bg-white/10 text-xl font-bold text-white" onClick={() => setQuantity(Math.max(1, quantity - 1))} type="button">-</button>
              <span className="w-10 text-center text-lg font-black text-white">{quantity}</span>
              <button className="pressable h-11 w-11 rounded-full bg-white/10 text-xl font-bold text-white" onClick={() => setQuantity(quantity + 1)} type="button">+</button>
            </div>
            <MotionButton
              {...buttonMotion}
              className="pressable ripple mf-button-primary min-w-0 rounded-2xl px-5 py-4 text-sm font-bold sm:text-base"
              onClick={() => {
                const rect = imageRef.current?.getBoundingClientRect();
                if (rect) {
                  triggerCartFlight(product.imageUrl, rect);
                }

                hapticTap([10, 24, 10]);
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
                });
              }}
              type="button"
            >
              Savatga qo'shish · {formatMoney(total)}
            </MotionButton>
          </div>
        </div>
      </div>
    </MotionDiv>
  );
}

function pillClass(active: boolean): string {
  return `pressable ripple rounded-2xl px-4 py-3 text-sm font-bold ${active ? "mf-button-primary" : "bg-white/10 text-white/76"}`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="mf-card-soft p-3">
      <p className="text-xs font-black uppercase text-[#67E8F9]">{label}</p>
      <p className="mt-1 font-black text-white">{value}</p>
    </div>
  );
}
