"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CustomerMenuSections } from "../../../components/customer-menu-sections";
import { MediaImage } from "../../../components/media-image";
import { hapticTap } from "../../../components/motion-primitives";
import { SiteShell } from "../../../components/site-shell";
import { apiFetch } from "../../../lib/api";
import { displayProduct } from "../../../lib/customer-display";
import { formatMoney, useCart } from "../../../lib/cart";
import type { Product } from "../../../lib/types";

export default function ProductPage({
  id, initialProduct,
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

function ProductDetails({ id, initialProduct }: { id: string; initialProduct: Product }) {
  const imageRef = useRef<HTMLDivElement | null>(null);
  const { addItem, isFavorite, toggleFavorite, triggerCartFlight } = useCart();
  const [product, setProduct] = useState<Product | null>(() => displayProduct(initialProduct));
  const [variantId, setVariantId] = useState<string | undefined>(() => initialProduct.variants.find((variant) => variant.isDefault)?.id ?? initialProduct.variants[0]?.id);
  const [modifierIds, setModifierIds] = useState<string[]>(() => initialProduct.modifiers.filter((link) => link.isRequired).map((link) => link.modifier.id));
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
        setProduct(displayProduct(data));
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
        if (active)
          setError(
            caught instanceof Error ? caught.message : "Mahsulot topilmadi.",
          );
      });
    return () => {
      active = false;
    };
  }, [attempt, id]);

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
          <h1 className="text-2xl font-black">Mahsulot ochilmadi</h1>
          <p className="mt-3 text-sm">{error}</p>
          <button
            className="mf-button-primary mt-5 px-5 py-3 font-bold"
            onClick={() => setAttempt((value) => value + 1)}
            type="button"
          >
            Qayta urinish
          </button>
          <Link className="mt-4 block font-bold" href="/menu">
            Menyuga qaytish
          </Link>
        </div>
      </section>
    );

  if (!product)
    return (
      <section
        aria-busy="true"
        aria-label="Mahsulot yuklanmoqda"
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
        <div className="mf-product-config p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Link
              aria-label="Menyuga qaytish"
              className="mf-button-secondary grid h-11 w-11 place-items-center text-2xl"
              href="/menu"
            >
              &#8249;
            </Link>
            <button
              aria-label={
                favorite
                  ? "Sevimlilardan olib tashlash"
                  : "Sevimlilarga qo'shish"
              }
              aria-pressed={favorite}
              title={
                favorite
                  ? "Sevimlilardan olib tashlash"
                  : "Sevimlilarga qo'shish"
              }
              className={`mf-favorite-button grid h-11 w-11 place-items-center rounded-xl text-xl ${favorite ? "is-active" : ""}`}
              onClick={() => toggleFavorite(product.id)}
              type="button"
            >
              &#9829;
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
              sizes="(max-width: 639px) 45vw, (max-width: 1152px) 48vw, 520px"
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
                {formatMoney(unitTotal)}
              </p>
              {product.preparationTime != null ? (
                <p className="mt-2 text-xs font-semibold text-[#07373a]/70">
                  {product.preparationTime} daq
                </p>
              ) : null}
            </div>
          </div>
          <div className="mt-5 grid gap-5">
            {product.variants.length ? (
              <fieldset>
                <legend className="text-sm font-bold">Turini tanlang</legend>
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
                          {formatMoney(item.sellingPrice)}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
            {product.modifiers.length ? (
              <fieldset>
                <legend className="text-sm font-bold">Qo'shimchalar</legend>
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
                          {isRequired ? " (majburiy)" : ""}
                        </span>
                        <span className="mt-1 block text-xs text-[#087d78]">
                          +{formatMoney(modifier.price)}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
            <label className="grid gap-2 text-sm font-bold">
              Izoh (ixtiyoriy)
              <textarea
                className="mf-input min-h-20 resize-y px-3 py-3 font-normal"
                placeholder="Oshxonaga izoh"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
            <div className="mf-product-action">
              <div aria-label="Mahsulot miqdori" className="mf-detail-quantity">
                <button
                  aria-label="Miqdorni kamaytirish"
                  className="mf-quantity-button"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  type="button"
                >
                  -
                </button>
                <output aria-live="polite">{quantity}</output>
                <button
                  aria-label="Miqdorni oshirish"
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
                <span>Savatchaga qo'shish</span>
                <span>{formatMoney(total)}</span>
              </button>
            </div>
          </div>
        </div>
      </section>
      <CustomerMenuSections
        compactTop
        intro={false}
        title="Yana nimalar buyurtma qilamiz?"
      />
    </>
  );
}
