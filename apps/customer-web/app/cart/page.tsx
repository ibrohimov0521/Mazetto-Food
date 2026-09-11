"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CartUpsell } from "../../components/cart-upsell";
import { OrderActionBar } from "../../components/order-action-bar";
import { MapPin, Pencil, ShoppingBag } from "lucide-react";
import "../checkout/checkout.css";
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
  const { customer, items, removeItem, subtotal, updateQuantity, fulfillment, openFulfillment } = useCart();
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
    const branchId = window.localStorage.getItem("mazetto.customer.branchId");
    const branchQuery = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";

    Promise.all([
      apiFetch<Category[]>(`/customer/menu/categories${branchQuery}`),
      apiFetch<Product[]>(`/customer/menu/products${branchQuery}`),
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
    <MotionDiv {...pageMotion} className="mf-cart-page mx-auto grid w-full max-w-6xl gap-5 px-4 pt-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,360px)]">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-black text-[#17314A]">Savatcha</h1>
          </div>
          <span className="text-sm font-bold text-[#087d78]">{items.reduce((count, item) => count + item.quantity, 0)} ta mahsulot</span>
        </div>

        {items.length ? (
          <MotionDiv {...sectionMotion} className="mt-5 grid gap-3">
            {items.map((item) => (
              <div className="mf-cart-row grid min-w-0 grid-cols-[80px_minmax(0,1fr)] gap-3 py-3 sm:grid-cols-[96px_minmax(0,1fr)]" key={item.key}>
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
                      <h2 className="break-words font-bold leading-snug text-[#17314A]">{localizeMenuName(item.productName)}</h2>
                      <p className="text-sm text-[#586B7D]">{localizeMenuName(item.variantName) || "Oddiy"}</p>
                    </div>
                    <button aria-label={`${item.productName} savatdan olib tashlash`} title="Savatdan olib tashlash" className="pressable grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl text-[#087d78]" onClick={() => removeItem(item.key)} type="button">
                      &#215;
                    </button>
                  </div>
                  {item.modifiers.length ? <p className="mt-1 break-words text-sm font-semibold text-[#0A7168]">{item.modifiers.map((modifier) => localizeMenuName(modifier.name)).join(", ")}</p> : null}
                  {item.notes ? <p className="mt-1 break-words text-xs font-semibold text-[#586B7D]">Izoh: {item.notes}</p> : null}
                  <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-3">
                    <div className="flex shrink-0 items-center gap-2">
                      <button aria-label={`${item.productName} kamaytirish`} className="pressable mf-quantity-button h-9 w-9 rounded-full font-bold" onClick={() => { hapticTap(8); updateQuantity(item.key, item.quantity - 1); }} type="button">-</button>
                      <span className="mf-count-pop w-8 text-center font-bold text-[#17314A]" key={item.quantity}>{item.quantity}</span>
                      <button aria-label={`${item.productName} qo'shish`} className="pressable mf-quantity-button h-9 w-9 rounded-full font-bold" onClick={() => { hapticTap(8); updateQuantity(item.key, item.quantity + 1); }} type="button">+</button>
                    </div>
                    <span className="min-w-0 break-words text-right font-black text-[#0A7168]"><AnimatedMoney value={(Number(item.unitPrice) + item.modifiers.reduce((sum, modifier) => sum + Number(modifier.price), 0)) * item.quantity} /></span>
                  </div>
                </div>
              </div>
            ))}
          </MotionDiv>
        ) : (
          <div className="mt-5 py-8 text-center">
            <p className="font-bold text-[#17314A]">Savatchangiz hozircha bo'sh.</p>
            <Link className="pressable ripple mf-button-primary mt-4 inline-flex px-5 py-3 font-bold" href="/menu">
              Menyuga o'tish
            </Link>
          </div>
        )}

      {items.length ? <section className="mf-cart-summary min-w-0 h-fit" aria-label="Buyurtma xulosasi">
        <h2 className="text-2xl font-black text-[#17314A]">Xulosa</h2>
        {!customer?.accessToken ? (
          <div className="mf-surface-note mt-4 rounded-2xl px-4 py-3 text-sm font-bold">
            Buyurtma berish uchun telefon raqamingizni tasdiqlang.
          </div>
        ) : null}
        <div className="mt-5 grid gap-3 py-4">
          <div className="flex min-w-0 justify-between gap-3 text-sm font-bold text-[#586B7D]">
            <span>Mahsulotlar</span>
            <span className="min-w-0 break-words text-right"><AnimatedMoney value={subtotal} /></span>
          </div>
          <div className="flex min-w-0 justify-between gap-3 text-sm font-bold text-[#586B7D]">
            <span>Yetkazib berish</span>
            <span className="min-w-0 break-words text-right">Rasmiylashtirishda</span>
          </div>
          <div className="h-px bg-[#0A7168]/12" />
          <div className="flex min-w-0 justify-between gap-3 text-lg font-black text-[#17314A]">
            <span>Jami</span>
            <span className="min-w-0 break-words text-right"><AnimatedMoney value={total} /></span>
          </div>
        </div>
        <div className="mf-cart-destination">
          {fulfillment?.type === "PICKUP" ? <ShoppingBag size={22} /> : <MapPin size={22} />}
          <div>
            <strong>{fulfillment?.type === "PICKUP" ? "Olib ketish" : "Yetkazish manzili"}</strong>
            <p>{fulfillment?.type === "PICKUP" ? fulfillment.branchAddress : fulfillment?.location ? `${fulfillment.location.address}, ${fulfillment.location.house}` : "Manzil hali tanlanmagan"}</p>
          </div>
          <button className="mf-icon-control" type="button" onClick={openFulfillment} title="Manzilni o'zgartirish" aria-label="Manzilni o'zgartirish"><Pencil size={18} /></button>
        </div>
      </section> : null}
      </div>

      {items.length ? <aside className="mf-cart-recommendations min-w-0" aria-label="Tavsiyalar">
        <CartUpsell categories={catalogCategories} loading={catalogLoading} products={catalogProducts} />
      </aside> : null}

      {items.length ? <OrderActionBar total={total} label="Rasmiylashtirish" href={customer?.accessToken ? "/checkout" : "/checkout?auth=1"} /> : null}
    </MotionDiv>
  );
}
