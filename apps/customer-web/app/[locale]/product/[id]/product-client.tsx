"use client";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Heart } from "lucide-react";
import styles from "./product-detail.module.css";
import { CustomerMenuSections } from "@/components/customer-menu-sections";
import { MediaImage } from "@/components/media-image";
import { hapticTap } from "@/components/motion-primitives";
import { SiteShell } from "@/components/site-shell";
import { apiFetch } from "@/lib/api";
import { displayProduct } from "@/lib/customer-display";
import { localizeCustomerCopy } from "@/lib/customer-copy.mjs";
import { formatMoney, useCart } from "@/lib/cart";
import type { Product } from "@/lib/types";

export default function ProductPage({
  id,
  initialProduct,
}: {
  id: string;
  initialProduct: Product;
}) {
  return (
    <SiteShell>
      <ProductDetails id={id} key={id} initialProduct={initialProduct} />
    </SiteShell>
  );
}

function ProductDetails({
  id,
  initialProduct,
}: {
  id: string;
  initialProduct: Product;
}) {
  const locale = useLocale();
  const t = useTranslations("Customer");
  const imageRef = useRef<HTMLDivElement | null>(null);
  const { addItem, isFavorite, toggleFavorite, triggerCartFlight } = useCart();
  const [product, setProduct] = useState<Product | null>(() =>
    displayProduct(initialProduct, locale),
  );
  const [variantId, setVariantId] = useState<string | undefined>(
    () =>
      initialProduct.variants.find((variant) => variant.isDefault)?.id ??
      initialProduct.variants[0]?.id,
  );
  const [modifierIds, setModifierIds] = useState<string[]>(() =>
    initialProduct.modifiers
      .filter((link) => link.isRequired)
      .map((link) => link.modifier.id),
  );
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setError(null);
    const branchId = window.localStorage.getItem("mazetto.customer.branchId");
    const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
    void apiFetch<Product>(`/customer/menu/products/${id}${query}`)
      .then((data) => {
        if (!active) return;
        setProduct(displayProduct(data, locale));
        setVariantId(
          data.variants.find((variant) => variant.isDefault)?.id ??
            data.variants[0]?.id,
        );
        setModifierIds(
          data.modifiers
            .filter((link) => link.isRequired)
            .map((link) => link.modifier.id),
        );
      })
      .catch((caught: unknown) => {
        if (active && !initialProduct)
          setError(
            caught instanceof Error ? caught.message : "Mahsulot topilmadi.",
          );
      });
    return () => {
      active = false;
    };
  }, [attempt, id, initialProduct, locale]);

  const variant = useMemo(
    () => product?.variants.find((item) => item.id === variantId),
    [product, variantId],
  );
  const selectedModifiers =
    product?.modifiers.filter((link) =>
      modifierIds.includes(link.modifier.id),
    ) ?? [];
  const unitTotal =
    Number(variant?.sellingPrice ?? product?.sellingPrice ?? 0) +
    selectedModifiers.reduce(
      (sum, link) => sum + Number(link.modifier.price),
      0,
    );
  const total = unitTotal * quantity;

  if (error)
    return (
      <section className="mx-auto max-w-3xl px-4 py-6">
        <div className="mf-card p-6 text-center" role="alert">
          <h1 className="text-2xl font-black">{t("mahsulot_ochilmadi_6468bdee")}</h1>
          <p className="mt-3 text-sm">{localizeCustomerCopy(error, locale)}</p>
          <button
            className="mf-button-primary mt-5 px-5 py-3 font-bold"
            onClick={() => setAttempt((value) => value + 1)}
            type="button"
          >
            {t("qayta_urinish_422d2790")}</button>
          <Link className="mt-4 block font-bold" href="/menu">
            {t("menyuga_qaytish_1bc4a9f0")}</Link>
        </div>
      </section>
    );

  if (!product)
    return (
      <section
        aria-busy="true"
        aria-label={t("mahsulot_yuklanmoqda_ab5f42c8")}
        className="mf-product-detail-stage mx-auto w-full max-w-6xl px-3 py-4 sm:px-4"
      >
        <div className="mf-product-config p-4 sm:p-6">
          <div className="mf-product-overview">
            <div className="skeleton aspect-square rounded-2xl" />
            <div className="grid content-center gap-4">
              <div className="skeleton h-12 rounded-lg" />
              <div className="skeleton h-16 rounded-lg" />
              <div className="skeleton h-8 w-24 rounded-lg" />
            </div>
          </div>
          <div className="skeleton mt-5 h-36 rounded-xl" />
        </div>
      </section>
    );

  const favorite = isFavorite(product.id);
  return (
    <>
      <section className="mf-product-detail-stage mx-auto w-full max-w-6xl px-3 py-4 sm:px-4">
        <div className={`mf-product-config ${styles.layout}`}>
          <div className={styles.toolbar}>
            <Link
              aria-label={t("menyuga_qaytish_1bc4a9f0")}
              className={styles.backButton}
              href="/menu"
            >
              <ArrowLeft aria-hidden="true" size={20} />
              <span>{t("menyu_e4bc6451")}</span>
            </Link>
            <button
              aria-label={
                favorite
                  ? localizeCustomerCopy("Sevimlilardan olib tashlash", locale)
                  : localizeCustomerCopy("Sevimlilarga qo'shish", locale)
              }
              aria-pressed={favorite}
              title={
                favorite
                  ? localizeCustomerCopy("Sevimlilardan olib tashlash", locale)
                  : localizeCustomerCopy("Sevimlilarga qo'shish", locale)
              }
              className={styles.favoriteButton}
              onClick={() => toggleFavorite(product.id)}
              type="button"
            >
              <Heart
                aria-hidden="true"
                size={21}
                fill={favorite ? "currentColor" : "none"}
              />
            </button>
          </div>
          <div className="mf-product-overview">
            <MediaImage
              alt={product.name}
              aspectClassName="aspect-square"
              className="mf-product-detail-image rounded-2xl"
              fallbackLabel={product.name}
              fit="contain"
              priority
              ref={imageRef}
              sizes="(max-width: 767px) 40vw, 360px"
              src={product.imageUrl}
            />
            <div className="mf-product-summary min-w-0">
              {product.category?.name ? (
                <p className="text-xs font-bold text-[#087d78]">
                  {product.category.name}
                </p>
              ) : null}
              <h1 className="mt-2 font-black text-[#07373a]">{product.name}</h1>
              {product.description?.trim() ? (
                <p className="mf-product-detail-description mt-3 text-sm leading-6 text-[#07373a]/75">
                  {product.description}
                </p>
              ) : null}
              <p className="mf-product-detail-price mt-4 font-black text-[#087d78]">
                {formatMoney(unitTotal, locale)}
              </p>
              {product.preparationTime != null ? (
                <p className="mt-2 text-xs font-semibold text-[#07373a]/70">
                  {product.preparationTime} {t("daq_0ff9d687")}</p>
              ) : null}
            </div>
          </div>
          <div className={styles.options}>
            {product.variants.length ? (
              <fieldset>
                <legend className="text-sm font-bold">{t("turini_tanlang_93395dc9")}</legend>
                <div className="mf-product-variants mt-2">
                  {product.variants.map((item) => (
                    <label
                      className={`mf-option-row mf-variant-option ${variantId === item.id ? "is-selected" : ""}`}
                      key={item.id}
                    >
                      <input
                        checked={variantId === item.id}
                        name={`variant-${product.id}`}
                        onChange={() => setVariantId(item.id)}
                        type="radio"
                        value={item.id}
                      />
                      <span className="min-w-0">
                        <span className="block font-bold">{item.name}</span>
                        <span className="mt-1 block text-xs text-[#087d78]">
                          {formatMoney(item.sellingPrice, locale)}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
            {product.modifiers.length ? (
              <fieldset>
                <legend className="text-sm font-bold">{t("qo_shimchalar_1fe8c7f3")}</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {product.modifiers.map(({ modifier, isRequired }) => (
                    <label
                      className="mf-option-row flex min-w-0 items-center gap-3 px-3 py-3 text-sm"
                      key={modifier.id}
                    >
                      <input
                        checked={modifierIds.includes(modifier.id)}
                        disabled={isRequired}
                        onChange={(event) =>
                          setModifierIds((current) =>
                            event.target.checked
                              ? [...current, modifier.id]
                              : current.filter(
                                  (value) => value !== modifier.id,
                                ),
                          )
                        }
                        type="checkbox"
                      />
                      <span className="min-w-0">
                        <span className="block break-words font-semibold">
                          {modifier.name}
                          {isRequired ? t("majburiy_bb39de69") : ""}
                        </span>
                        <span className="mt-1 block text-xs text-[#087d78]">
                          +{formatMoney(modifier.price, locale)}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
            <label className="grid gap-2 text-sm font-bold">
              {t("izoh_ixtiyoriy_18cf5a79")}<textarea
                className="mf-input min-h-20 resize-y px-3 py-3 font-normal"
                placeholder={t("oshxonaga_izoh_36b0eaf6")}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
            <div className="mf-product-action">
              <div aria-label={t("mahsulot_miqdori_40e73cc3")} className="mf-detail-quantity">
                <button
                  aria-label={t("miqdorni_kamaytirish_41a2d3d1")}
                  className="mf-quantity-button"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  type="button"
                >
                  -
                </button>
                <output aria-live="polite">{quantity}</output>
                <button
                  aria-label={t("miqdorni_oshirish_9159d17d")}
                  className="mf-quantity-button"
                  onClick={() => setQuantity((value) => value + 1)}
                  type="button"
                >
                  +
                </button>
              </div>
              <button
                className="mf-button-primary mf-detail-add"
                onClick={() => {
                  const rect = imageRef.current?.getBoundingClientRect();
                  hapticTap([10, 24, 10]);
                  const added = addItem({
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
                  if (added && rect) triggerCartFlight(product.imageUrl, rect);
                }}
                type="button"
              >
                <span>{t("savatchaga_qo_shish_87a3b40d")}</span>
                <span>{formatMoney(total, locale)}</span>
              </button>
            </div>
          </div>
        </div>
      </section>
      <CustomerMenuSections
        compactTop
        intro={false}
        title={t("yana_nimalar_buyurtma_qilamiz_009c8887")}
      />
    </>
  );
}
