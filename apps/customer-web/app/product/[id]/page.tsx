"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { BrandLogo } from "../../../components/brand-logo";
import { CustomerMenuSections } from "../../../components/customer-menu-sections";
import { MediaImage } from "../../../components/media-image";
import { MotionButton, MotionDiv, buttonMotion, cardMotion, hapticTap, imageMotion, pageMotion } from "../../../components/motion-primitives";
import { SiteShell } from "../../../components/site-shell";
import { apiFetch } from "../../../lib/api";
import { displayProduct } from "../../../lib/customer-display";
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
        setProduct(displayProduct(nextProduct));
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
          <div className="skeleton aspect-[4/3] w-full" />
          <div className="grid grid-cols-3 gap-2 p-3 sm:gap-3 sm:p-5">
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
    <>
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 pt-4">
        <Link className="pressable grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-white/12 text-2xl font-black text-white backdrop-blur" href="/menu" aria-label="Menyuga qaytish">
          ‹
        </Link>
        <BrandLogo className="h-auto w-[min(15rem,56vw)]" priority sizes="240px" />
        <button
          aria-label="Sevimlilarga qo'shish"
          className={`pressable grid h-11 w-11 place-items-center rounded-full border border-white/20 text-lg font-black shadow ${isFavorite(product.id) ? "bg-[#F5CF00] text-[#07373A]" : "bg-white/12 text-white backdrop-blur"}`}
          onClick={() => {
            hapticTap(8);
            toggleFavorite(product.id);
          }}
          type="button"
        >
          ♥
        </button>
      </div>
      <MotionDiv {...pageMotion} className="mf-product-detail-stage mx-auto grid w-full max-w-6xl gap-4 px-3 py-5 sm:px-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <MotionDiv {...cardMotion} className="mf-product-media-panel min-w-0 overflow-hidden">
          <MediaImage
            alt={product.name}
            aspectClassName="aspect-[1.08/1] sm:aspect-[16/10] lg:aspect-[1.08/1]"
            className="floating-image rounded-[1.7rem] will-change-transform"
            fallbackLabel={product.name}
            fit="contain"
            motionProps={{
              ...imageMotion,
              layoutId: `product-detail-image-${product.id}`,
            }}
            priority
            imageClassName="p-4"
            ref={imageRef}
            sizes="(max-width: 1024px) 100vw, 45vw"
            src={product.imageUrl}
          />
          <div className="grid grid-cols-3 gap-2 p-2.5 sm:p-3">
            <Metric label="Tayyorlanish" value={`${product.preparationTime ?? 10} daq`} />
            <Metric label="Bo'lim" value={product.category?.name ?? "Menyu"} />
            <Metric label="Narx" value={formatMoney(product.sellingPrice)} />
          </div>
        </MotionDiv>
      <div className="mf-product-config min-w-0 p-4 sm:p-5 lg:p-6">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0B7F75]">MAZETTO tanlovi</p>
            <h1 className="mt-1 break-words text-[2.45rem] font-black leading-[0.98] text-[#0A4F55] sm:text-4xl lg:text-5xl">{product.name}</h1>
          </div>
          <div className="shrink-0 rounded-2xl bg-[#F5CF00] px-3 py-2 text-right text-sm font-black text-[#07373A] shadow-[0_12px_28px_rgba(245,207,0,0.24)]">
            {formatMoney(total)}
          </div>
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-[#17314A]/68 sm:text-base sm:leading-7">{product.description ?? "Buyurtmadan keyin issiq tayyorlanadi."}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {(ingredientHints.length ? ingredientHints : ["Yangi", "Buyurtma bilan tayyorlanadi", "Oshxonaga yuboriladi"]).map((item) => (
            <span className="rounded-full bg-[#0B8F83]/10 px-3 py-2 text-xs font-black text-[#0B7F75]" key={item}>{item}</span>
          ))}
        </div>

        <div className="mt-5 grid gap-4">
          <div>
            <h2 className="text-sm font-black uppercase text-[#0A4F55]/62">Turini tanlang</h2>
            <div className="mt-2 flex min-w-0 flex-wrap gap-2">
              {product.variants.map((item) => (
                <button className={pillClass(variantId === item.id)} key={item.id} onClick={() => setVariantId(item.id)} type="button">
                  {item.name} · {formatMoney(item.sellingPrice)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-black uppercase text-[#0A4F55]/62">Qo'shimchalar</h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {product.modifiers.map(({ modifier }) => (
                <label className="pressable mf-option-row flex min-w-0 items-center justify-between gap-3 px-3 py-2.5 text-sm font-semibold text-[#17314A]" key={modifier.id}>
                  <span className="min-w-0 break-words">{modifier.name}</span>
                  <span className="flex shrink-0 items-center gap-2 text-[#0B7F75]">
                    {formatMoney(modifier.price)}
                    <input checked={modifierIds.includes(modifier.id)} onChange={(event) => setModifierIds((current) => event.target.checked ? [...current, modifier.id] : current.filter((value) => value !== modifier.id))} type="checkbox" />
                  </span>
                </label>
              ))}
            </div>
          </div>

          <textarea className="mf-input min-h-24 px-4 py-3" placeholder="Oshxonaga izoh" value={notes} onChange={(event) => setNotes(event.target.value)} />

          <div className="mf-product-action sticky bottom-[calc(var(--mf-bottom-nav-space)+0.75rem)] z-10 flex min-w-0 flex-wrap items-center justify-between gap-3 p-3 shadow-[0_18px_45px_rgba(0,0,0,0.18)] backdrop-blur md:bottom-3">
            <div className="flex shrink-0 items-center gap-2">
              <button className="pressable mf-quantity-button h-11 w-11 rounded-full text-xl font-bold" onClick={() => setQuantity(Math.max(1, quantity - 1))} type="button">-</button>
              <span className="w-10 text-center text-lg font-black text-[#07373A]">{quantity}</span>
              <button className="pressable mf-quantity-button h-11 w-11 rounded-full text-xl font-bold" onClick={() => setQuantity(quantity + 1)} type="button">+</button>
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
              Savatchaga qo'shish · {formatMoney(total)}
            </MotionButton>
          </div>
        </div>
      </div>
      </MotionDiv>
      <section className="mf-product-menu-bridge mx-auto w-full max-w-6xl px-4 pb-2 pt-1">
        <div className="rounded-[1.5rem] border border-white/12 bg-white/8 px-4 py-3 text-center text-sm font-black text-[#F5CF00] backdrop-blur">
          To'liq menyudan davom eting
        </div>
      </section>
      <CustomerMenuSections compactTop intro={false} title="Yana nimalar buyurtma qilamiz?" />
    </>
  );
}

function pillClass(active: boolean): string {
  return `pressable ripple rounded-2xl px-3 py-2 text-sm font-bold ${active ? "mf-button-primary" : "mf-option-row text-[#17314A]"}`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="mf-card-soft min-w-0 p-2 sm:p-3">
      <p className="truncate text-[10px] font-black uppercase text-[#0B7F75] sm:text-xs">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-[#17314A] sm:text-base">{value}</p>
    </div>
  );
}
