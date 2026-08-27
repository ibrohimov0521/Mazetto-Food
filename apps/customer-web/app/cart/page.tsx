"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CartUpsell } from "../../components/cart-upsell";
import { AnimatedMoney, MotionDiv, hapticTap, pageMotion, sectionMotion } from "../../components/motion-primitives";
import { MediaImage } from "../../components/media-image";
import { SiteShell } from "../../components/site-shell";
import { localizeMenuName } from "../../lib/customer-display";
import { useCart } from "../../lib/cart";

export default function CartPage() {
  return (
    <SiteShell>
      <CartReview />
    </SiteShell>
  );
}

function CartReview() {
  const { customer, items, removeItem, subtotal, updateQuantity } = useCart();
  const deliveryFee = subtotal > 0 ? 12000 : 0;
  const total = subtotal + deliveryFee;

  return (
    <MotionDiv {...pageMotion} className="mx-auto grid w-full max-w-6xl gap-6 px-4 pb-[calc(11rem+env(safe-area-inset-bottom))] pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,380px)] lg:pb-6">
      <div className="mf-card min-w-0 p-5">
        <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black uppercase text-[#67E8F9]">Savat</p>
            <h1 className="mt-1 text-3xl font-black text-white">Buyurtmangiz</h1>
          </div>
          <span className="basis-full rounded-2xl bg-[#22C55E]/16 px-4 py-2 text-sm font-black text-[#67E8F9] sm:basis-auto">{items.length} ta mahsulot</span>
        </div>

        {items.length ? (
          <MotionDiv {...sectionMotion} className="mt-5 grid gap-3">
            {items.map((item) => (
              <div className="mf-card-soft grid min-w-0 grid-cols-[96px_minmax(0,1fr)] gap-3 p-3" key={item.key}>
                <MediaImage
                  alt={item.productName}
                  aspectClassName="h-24 w-24"
                  className="rounded-2xl"
                  sizes="96px"
                  src={item.imageUrl}
                />
                <div className="min-w-0">
                  <div className="flex min-w-0 justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-bold text-white">{localizeMenuName(item.productName)}</h2>
                      <p className="text-sm text-white/52">{localizeMenuName(item.variantName) || "Oddiy"}</p>
                    </div>
                    <button className="pressable shrink-0 text-sm font-bold text-red-400" onClick={() => removeItem(item.key)} type="button">
                      O'chirish
                    </button>
                  </div>
                  {item.modifiers.length ? <p className="mt-1 break-words text-sm font-semibold text-[#67E8F9]">{item.modifiers.map((modifier) => localizeMenuName(modifier.name)).join(", ")}</p> : null}
                  {item.notes ? <p className="mt-1 break-words text-xs font-semibold text-white/50">Izoh: {item.notes}</p> : null}
                  <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-3">
                    <div className="flex shrink-0 items-center gap-2">
                      <button className="pressable mf-quantity-button h-9 w-9 rounded-full font-bold" onClick={() => { hapticTap(8); updateQuantity(item.key, item.quantity - 1); }} type="button">-</button>
                      <motion.span animate={{ scale: [1, 1.22, 1] }} className="w-8 text-center font-bold text-white" key={item.quantity} transition={{ duration: 0.28, ease: "easeOut" }}>{item.quantity}</motion.span>
                      <button className="pressable mf-quantity-button h-9 w-9 rounded-full font-bold" onClick={() => { hapticTap(8); updateQuantity(item.key, item.quantity + 1); }} type="button">+</button>
                    </div>
                    <span className="min-w-0 break-words text-right font-black text-[#67E8F9]"><AnimatedMoney value={(Number(item.unitPrice) + item.modifiers.reduce((sum, modifier) => sum + Number(modifier.price), 0)) * item.quantity} /></span>
                  </div>
                </div>
              </div>
            ))}
          </MotionDiv>
        ) : (
          <div className="mf-card-soft mt-5 p-8 text-center">
            <p className="font-bold text-white">Savatingiz hozircha bo'sh.</p>
            <Link className="pressable ripple mf-button-primary mt-4 inline-flex px-5 py-3 font-bold" href="/menu">
              Menyuni ochish
            </Link>
          </div>
        )}

        <CartUpsell />
      </div>

      <aside className="mf-card min-w-0 h-fit p-5">
        <h2 className="text-2xl font-black text-white">Xulosa</h2>
        {!customer?.accessToken ? (
          <div className="mt-4 rounded-2xl bg-[#67E8F9]/14 px-4 py-3 text-sm font-bold text-[#67E8F9]">
            Buyurtma berish uchun telefon raqamingizni tasdiqlang.
          </div>
        ) : null}
        <div className="mf-card-soft mt-5 grid gap-3 p-4">
          <div className="flex min-w-0 justify-between gap-3 text-sm font-bold text-white/60">
            <span>Mahsulotlar</span>
            <span className="min-w-0 break-words text-right"><AnimatedMoney value={subtotal} /></span>
          </div>
          <div className="flex min-w-0 justify-between gap-3 text-sm font-bold text-white/60">
            <span>Taxminiy yetkazish</span>
            <span className="min-w-0 break-words text-right">{deliveryFee ? <AnimatedMoney value={deliveryFee} /> : "Bepul"}</span>
          </div>
          <div className="h-px bg-white/10" />
          <div className="flex min-w-0 justify-between gap-3 text-lg font-black text-white">
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

      <div className="mf-mobile-action-bar mazetto-glass fixed inset-x-3 z-30 rounded-[1.5rem] p-3 lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-white/50">Jami</p>
            <p className="text-lg font-black text-white"><AnimatedMoney value={total} /></p>
          </div>
          <Link className={`pressable ripple rounded-2xl px-5 py-4 font-black ${items.length ? "mf-button-primary" : "pointer-events-none bg-white/10 text-white/40"}`} href={customer?.accessToken ? "/checkout" : "/checkout?auth=1"}>
            {customer?.accessToken ? "Davom etish" : "Tasdiqlash"}
          </Link>
        </div>
      </div>
    </MotionDiv>
  );
}
