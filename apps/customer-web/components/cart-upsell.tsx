"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MediaImage } from "./media-image";
import { MotionButton, MotionDiv, buttonMotion, hapticTap, sectionMotion } from "./motion-primitives";
import { apiFetch } from "../lib/api";
import { displayCategory, displayProducts } from "../lib/customer-display";
import { formatMoney, useCart } from "../lib/cart";
import type { Category, Product } from "../lib/types";

const upsellCategoryCodes = ["SAUCES", "DRINKS", "FAST_FOOD"];

export function CartUpsell() {
  const { addItem, items, triggerCartFlight } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  const loadUpsell = useCallback(async () => {
    if (!items.length) {
      setProducts([]);
      setCategories([]);
      return;
    }

    setLoading(true);
    try {
      const [nextCategories, nextProducts] = await Promise.all([
        apiFetch<Category[]>("/customer/menu/categories"),
        apiFetch<Product[]>("/customer/menu/products"),
      ]);
      setCategories(nextCategories.map(displayCategory));
      setProducts(displayProducts(nextProducts));
    } catch {
      setProducts([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [items.length]);

  useEffect(() => {
    void loadUpsell();
  }, [loadUpsell]);

  const recommended = useMemo(() => {
    const categoryRank = new Map(categories.map((category) => [category.id, getUpsellRank(category)]));
    const cartProductIds = new Set(items.map((item) => item.productId));

    return products
      .filter((product) => !cartProductIds.has(product.id))
      .map((product) => ({ product, rank: categoryRank.get(product.categoryId) ?? getUpsellRank(product.category) }))
      .filter(({ rank }) => rank < Number.POSITIVE_INFINITY)
      .sort((a, b) => a.rank - b.rank || Number(a.product.sellingPrice) - Number(b.product.sellingPrice) || a.product.name.localeCompare(b.product.name))
      .slice(0, 8)
      .map(({ product }) => product);
  }, [categories, items, products]);

  if (!items.length) {
    return null;
  }

  if (loading) {
    return (
      <section className="mt-5">
        <div className="skeleton h-6 w-56 rounded-full" />
        <div className="no-scrollbar mt-3 flex max-w-full gap-3 overflow-x-auto pb-1">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="skeleton h-36 min-w-[13rem] rounded-[1.5rem]" key={index} />
          ))}
        </div>
      </section>
    );
  }

  if (!recommended.length) {
    return null;
  }

  return (
    <MotionDiv {...sectionMotion} className="mt-6">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-white">Hech narsa qolib ketmadimi?</h2>
          <p className="mt-1 text-sm font-semibold text-white/56">Sous yoki ichimlik qo'shamizmi?</p>
        </div>
        <Link className="hidden text-sm font-black text-[#67E8F9] sm:inline" href="/menu">Menyu</Link>
      </div>
      <div className="no-scrollbar flex max-w-full snap-x gap-3 overflow-x-auto pb-2">
        {recommended.map((product) => (
          <UpsellCard addItem={addItem} key={product.id} product={product} triggerCartFlight={triggerCartFlight} />
        ))}
      </div>
    </MotionDiv>
  );
}

function UpsellCard({
  addItem,
  product,
  triggerCartFlight,
}: {
  addItem: ReturnType<typeof useCart>["addItem"];
  product: Product;
  triggerCartFlight: ReturnType<typeof useCart>["triggerCartFlight"];
}) {
  const imageRef = useRef<HTMLDivElement | null>(null);
  const variant = product.variants.find((candidate) => candidate.isDefault) ?? product.variants[0];
  const price = variant?.sellingPrice ?? product.sellingPrice;

  return (
    <article className="mazetto-liquid-surface grid w-[min(13.5rem,78vw)] shrink-0 snap-start overflow-hidden rounded-[1.5rem]">
      <MediaImage
        alt={product.name}
        aspectClassName="h-28"
        imageClassName="transition-transform duration-300 hover:scale-[1.04]"
        ref={imageRef}
        sizes="216px"
        src={product.imageUrl}
      />
      <div className="grid min-w-0 gap-2 p-3">
        <h3 className="line-clamp-1 font-black text-white">{product.name}</h3>
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="text-sm font-black text-[#67E8F9]">{formatMoney(price)}</span>
          <MotionButton
            {...buttonMotion}
            className="pressable ripple mf-button-primary rounded-xl px-3 py-2 text-xs font-black"
            onClick={() => {
              const rect = imageRef.current?.getBoundingClientRect();
              if (rect) {
                triggerCartFlight(product.imageUrl, rect);
              }

              hapticTap([8, 20, 8]);
              addItem({
                productId: product.id,
                productName: product.name,
                imageUrl: product.imageUrl,
                variantId: variant?.id,
                variantName: variant?.name,
                unitPrice: price,
                quantity: 1,
                modifiers: [],
              });
            }}
            type="button"
          >
            Qo'shish
          </MotionButton>
        </div>
      </div>
    </article>
  );
}

function getUpsellRank(category?: Pick<Category, "code" | "name"> | null): number {
  const normalizedCode = category?.code?.toUpperCase();

  if (normalizedCode && upsellCategoryCodes.includes(normalizedCode)) {
    return upsellCategoryCodes.indexOf(normalizedCode);
  }

  const normalizedName = category?.name.toLowerCase() ?? "";

  if (normalizedName.includes("sauce") || normalizedName.includes("sous")) {
    return 0;
  }

  if (normalizedName.includes("drink") || normalizedName.includes("ichimlik")) {
    return 1;
  }

  if (normalizedName.includes("fast") || normalizedName.includes("fries") || normalizedName.includes("fri")) {
    return 2;
  }

  return Number.POSITIVE_INFINITY;
}
