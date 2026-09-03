"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { CartUpsell } from "../../components/cart-upsell";
import { AnimatedMoney, MotionDiv, hapticTap, pageMotion, sectionMotion } from "../../components/motion-primitives";
import { MediaImage } from "../../components/media-image";
import { SiteShell } from "../../components/site-shell";
import { apiFetch } from "../../lib/api";
import { displayCategory, displayProducts, localizeMenuName } from "../../lib/customer-display";
import { useCart } from "../../lib/cart";
import type { Category, Product } from "../../lib/types";

export default function CartPage() {
  return (
    <SiteShell>
      <CartReview />
    </SiteShell>
  );
}

function CartReview() {
  const { customer, items, removeItem, subtotal, updateQuantity } = useCart();
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [catalogCategories, setCatalogCategories] = useState<Category[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const total = subtotal;
  const cartProductKey = useMemo(() => items.map((item) => item.productId).sort().join("|"), [items]);
  const catalogImageByProductId = useMemo(
    () => new Map(catalogProducts.map((product) => [product.id, product.imageUrl])),
    [catalogProducts],
  );

  useEffect(() => {
    if (!items.length) {
      setCatalogProducts([]);
      setCatalogCategories([]);
      setCatalogLoading(false);
      return;
    }

    let cancelled = false;
    setCatalogLoading(true);

    Promise.all([
      apiFetch<Category[]>("/customer/menu/categories"),
      apiFetch<Product[]>("/customer/menu/products"),
    ])
      .then(([nextCategories, nextProducts]) => {
        if (cancelled) {
          return;
        }

        setCatalogCategories(nextCategories.map(displayCategory));
        setCatalogProducts(displayProducts(nextProducts));
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setCatalogCategories([]);
        setCatalogProducts([]);
      })
      .finally(() => {
        if (!cancelled) {
          setCatalogLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cartProductKey, items.length]);

  return (
    <MotionDiv {...pageMotion} className="mx-auto grid w-full max-w-6xl gap-4 px-3 pb-[calc(9.25rem+env(safe-area-inset-bottom))] pt-4 sm:px-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,380px)] lg:pb-6">
      <div className="mf-checkout-card min-w-0 p-5">
        <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black uppercase text-[#0B7F75]">Savat</p>
            <h1 className="mt-1 text-3xl font-black text-[#17314A]">Savatcha</h1>
          </div>
          <span className="basis-full rounded-2xl bg-[#F5CF00]/26 px-4 py-2 text-sm font-black text-[#0A4F55] sm:basis-auto">{items.length} ta mahsulot</span>
        </div>

        {items.length ? (
          <MotionDiv {...sectionMotion} className="mt-5 grid gap-3">
            {items.map((item) => (
              <div className="mf-cart-row grid min-w-0 grid-cols-[76px_minmax(0,1fr)] gap-3 p-3 sm:grid-cols-[96px_minmax(0,1fr)]" key={item.key}>
                <MediaImage
                  alt={item.productName}
                  aspectClassName="h-20 w-20 sm:h-24 sm:w-24"
                  className="rounded-2xl"
                  sizes="96px"
                  src={item.imageUrl || catalogImageByProductId.get(item.productId)}
                />
                <div className="min-w-0">
                  <div className="flex min-w-0 justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-bold text-[#17314A]">{localizeMenuName(item.productName)}</h2>
                      <p className="text-sm text-[#17314A]/52">{localizeMenuName(item.variantName) || "Oddiy"}</p>
                    </div>
                    <button className="pressable shrink-0 text-sm font-bold text-red-400" onClick={() => removeItem(item.key)} type="button">
                      O'chirish
                    </button>
                  </div>
                  {item.modifiers.length ? <p className="mt-1 break-words text-sm font-semibold text-[#0B7F75]">{item.modifiers.map((modifier) => localizeMenuName(modifier.name)).join(", ")}</p> : null}
                  {item.notes ? <p className="mt-1 break-words text-xs font-semibold text-[#17314A]/50">Izoh: {item.notes}</p> : null}
                  <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-3">
                    <div className="flex shrink-0 items-center gap-2">
                      <button aria-label={`${item.productName} kamaytirish`} className="pressable mf-quantity-button h-9 w-9 rounded-full font-bold" onClick={() => { hapticTap(8); updateQuantity(item.key, item.quantity - 1); }} type="button">-</button>
                      <motion.span animate={{ scale: [1, 1.22, 1] }} className="w-8 text-center font-bold text-[#17314A]" key={item.quantity} transition={{ duration: 0.28, ease: "easeOut" }}>{item.quantity}</motion.span>
                      <button aria-label={`${item.productName} qo'shish`} className="pressable mf-quantity-button h-9 w-9 rounded-full font-bold" onClick={() => { hapticTap(8); updateQuantity(item.key, item.quantity + 1); }} type="button">+</button>
                    </div>
                    <span className="min-w-0 break-words text-right font-black text-[#0B7F75]"><AnimatedMoney value={(Number(item.unitPrice) + item.modifiers.reduce((sum, modifier) => sum + Number(modifier.price), 0)) * item.quantity} /></span>
                  </div>
                </div>
              </div>
            ))}
          </MotionDiv>
        ) : (
          <div className="mf-card-soft mt-5 p-8 text-center">
            <p className="font-bold text-[#17314A]">Savatchangiz hozircha bo'sh.</p>
            <Link className="pressable ripple mf-button-primary mt-4 inline-flex px-5 py-3 font-bold" href="/menu">
              Menyuga o'tish
            </Link>
          </div>
        )}

        <CartUpsell categories={catalogCategories} loading={catalogLoading} products={catalogProducts} />
      </div>

      <aside className="mf-checkout-card min-w-0 h-fit p-5">
        <h2 className="text-2xl font-black text-[#17314A]">Xulosa</h2>
        {!customer?.accessToken ? (
          <div className="mf-surface-note mt-4 rounded-2xl px-4 py-3 text-sm font-bold">
            Buyurtma berish uchun telefon raqamingizni tasdiqlang.
          </div>
        ) : null}
        <div className="mf-card-soft mt-5 grid gap-3 p-4">
          <div className="flex min-w-0 justify-between gap-3 text-sm font-bold text-[#17314A]/62">
            <span>Mahsulotlar</span>
            <span className="min-w-0 break-words text-right"><AnimatedMoney value={subtotal} /></span>
          </div>
          <div className="flex min-w-0 justify-between gap-3 text-sm font-bold text-[#17314A]/62">
            <span>Yetkazib berish</span>
            <span className="min-w-0 break-words text-right">Rasmiylashtirishda</span>
          </div>
          <div className="h-px bg-[#0B7F75]/12" />
          <div className="flex min-w-0 justify-between gap-3 text-lg font-black text-[#17314A]">
            <span>Jami</span>
            <span className="min-w-0 break-words text-right"><AnimatedMoney value={total} /></span>
          </div>
        </div>
        {customer?.accessToken ? (
          <Link className={`pressable ripple mt-4 flex w-full justify-center rounded-2xl px-5 py-4 font-black ${items.length ? "mf-button-primary" : "pointer-events-none bg-white/10 text-white/40"}`} href="/checkout">
            Rasmiylashtirish
          </Link>
        ) : (
          <Link className="pressable ripple mf-button-primary mt-4 flex w-full justify-center px-5 py-4 font-black" href="/checkout?auth=1">
            Telefonni tasdiqlash
          </Link>
        )}
      </aside>

      <div className="mf-mobile-action-bar fixed inset-x-3 z-30 rounded-[1.2rem] p-2.5 lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2.5">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wide text-[#0B7F75]">Jami</p>
            <p className="truncate text-base font-black text-[#17314A]"><AnimatedMoney value={total} /></p>
          </div>
          <Link className={`pressable ripple grid h-11 shrink-0 place-items-center rounded-[1.05rem] px-4 text-sm font-black ${items.length ? "mf-button-primary" : "pointer-events-none bg-[#07373A]/10 text-[#07373A]/40"}`} href={customer?.accessToken ? "/checkout" : "/checkout?auth=1"}>
            {customer?.accessToken ? "Davom etish" : "Tasdiqlash"}
          </Link>
        </div>
      </div>
    </MotionDiv>
  );
}
