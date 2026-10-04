"use client";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { useEffect, useMemo, useState } from "react";
import { CartUpsell } from "@/components/cart-upsell";
import { OrderActionBar } from "@/components/order-action-bar";
import { MapPin, Pencil, ShoppingBag } from "lucide-react";
import "../checkout/checkout.css";
import { AnimatedMoney, MotionDiv, hapticTap, pageMotion, sectionMotion } from "@/components/motion-primitives";
import { MediaImage } from "@/components/media-image";
import { SiteShell } from "@/components/site-shell";
import { apiFetch } from "@/lib/api";
import { displayCategory, displayProducts, localizeMenuName } from "@/lib/customer-display";
import { localizeCustomerCopy } from "@/lib/customer-copy.mjs";
import { useCart } from "@/lib/cart";
import type { Category, Product } from "@/lib/types";

export default function CartPage() {
  return (
    <SiteShell>
      <CartReview />
    </SiteShell>
  );
}

function CartReview() {
  const locale = useLocale();
  const meta = useTranslations("CustomerMeta");
  const t = useTranslations("Customer");
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

        setCatalogCategories(nextCategories.map((category) => displayCategory(category, locale)));
        setCatalogProducts(displayProducts(nextProducts, locale));
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
  }, [cartProductKey, items.length, locale]);

  return (
    <MotionDiv {...pageMotion} className="mf-cart-page mx-auto grid w-full max-w-6xl gap-5 px-4 pt-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,360px)]">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-black text-[#17314A]">{t("savatcha_7a2af186")}</h1>
          </div>
          <span className="text-sm font-bold text-[#087d78]">{items.reduce((count, item) => count + item.quantity, 0)} {t("ta_mahsulot_27250bf2")}</span>
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
                      <h2 className="break-words font-bold leading-snug text-[#17314A]">{localizeMenuName(item.productName, locale)}</h2>
                      <p className="text-sm text-[#586B7D]">{localizeMenuName(item.variantName, locale) || t("oddiy_fcb3a5e4")}</p>
                    </div>
                    <button aria-label={localizeCustomerCopy(item.productName + " savatdan olib tashlash", locale)} title={t("savatdan_olib_tashlash_5e8a59da")} className="pressable grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl text-[#087d78]" onClick={() => removeItem(item.key)} type="button">
                      &#215;
                    </button>
                  </div>
                  {item.modifiers.length ? <p className="mt-1 break-words text-sm font-semibold text-[#0A7168]">{item.modifiers.map((modifier) => localizeMenuName(modifier.name, locale)).join(", ")}</p> : null}
                  {item.notes ? <p className="mt-1 break-words text-xs font-semibold text-[#586B7D]">{t("izoh_70aacec3")}{" "}{item.notes}</p> : null}
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
            <p className="font-bold text-[#17314A]">{t("savatchangiz_hozircha_bo_sh_44282cb8")}</p>
            <Link className="pressable ripple mf-button-primary mt-4 inline-flex px-5 py-3 font-bold" href="/menu">
              {t("menyuga_o_tish_cd33f01c")}</Link>
          </div>
        )}

      {items.length ? <section className="mf-cart-summary min-w-0 h-fit" aria-label={t("buyurtma_xulosasi_db1cafac")}>
        <h2 className="text-2xl font-black text-[#17314A]">{t("xulosa_39195b11")}</h2>
        {!customer?.accessToken ? (
          <div className="mf-surface-note mt-4 rounded-2xl px-4 py-3 text-sm font-bold">
            {t("buyurtma_berish_uchun_telefon_raqaming_9bc83fb6")}</div>
        ) : null}
        <div className="mt-5 grid gap-3 py-4">
          <div className="flex min-w-0 justify-between gap-3 text-sm font-bold text-[#586B7D]">
            <span>{t("mahsulotlar_66e73a67")}</span>
            <span className="min-w-0 break-words text-right"><AnimatedMoney value={subtotal} /></span>
          </div>
          <div className="flex min-w-0 justify-between gap-3 text-sm font-bold text-[#586B7D]">
            <span>{t("yetkazib_berish_199c427a")}</span>
            <span className="min-w-0 break-words text-right">{t("rasmiylashtirishda_9ad46ffa")}</span>
          </div>
          <div className="h-px bg-[#0A7168]/12" />
          <div className="flex min-w-0 justify-between gap-3 text-lg font-black text-[#17314A]">
            <span>{t("jami_52cea6a5")}</span>
            <span className="min-w-0 break-words text-right"><AnimatedMoney value={total} /></span>
          </div>
        </div>
        <div className="mf-cart-destination">
          {fulfillment?.type === "PICKUP" ? <ShoppingBag size={22} /> : <MapPin size={22} />}
          <div>
            <strong>{fulfillment?.type === "PICKUP" ? t("olib_ketish_903d19bf") : t("yetkazish_manzili_1de1c8d6")}</strong>
            <p>{fulfillment?.type === "PICKUP" ? fulfillment.branchAddress : fulfillment?.location ? `${fulfillment.location.address}, ${fulfillment.location.house}` : t("manzil_hali_tanlanmagan_f53fd2a0")}</p>
          </div>
          <button className="mf-icon-control" type="button" onClick={openFulfillment} title={t("manzilni_o_zgartirish_928ae6cc")} aria-label={t("manzilni_o_zgartirish_928ae6cc")}><Pencil size={18} /></button>
        </div>
      </section> : null}
      </div>

      {items.length ? <aside className="mf-cart-recommendations min-w-0" aria-label={t("tavsiyalar_71b5be55")}>
        <CartUpsell categories={catalogCategories} loading={catalogLoading} products={catalogProducts} />
      </aside> : null}

      {items.length ? <OrderActionBar total={total} label={meta("checkout")} href={customer?.accessToken ? "/checkout" : "/checkout?auth=1"} /> : null}
    </MotionDiv>
  );
}
