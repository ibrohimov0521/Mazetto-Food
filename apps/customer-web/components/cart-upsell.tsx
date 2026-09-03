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

type CartUpsellProps = {
  categories?: Category[];
  loading?: boolean;
  products?: Product[];
};

export function CartUpsell({ categories: providedCategories, loading: providedLoading, products: providedProducts }: CartUpsellProps = {}) {
  const { addItem, items, triggerCartFlight } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const activeProducts = providedProducts ?? products;
  const activeCategories = providedCategories ?? categories;
  const activeLoading = providedLoading ?? loading;
  const shouldLoadCatalog = !providedProducts || !providedCategories;

  const loadUpsell = useCallback(async () => {
    if (!shouldLoadCatalog) {
      return;
    }

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
  }, [items.length, shouldLoadCatalog]);

  useEffect(() => {
    void loadUpsell();
  }, [loadUpsell]);

  const recommended = useMemo(() => {
    const categoryRank = new Map(activeCategories.map((category) => [category.id, getUpsellRank(category)]));
    const cartProductIds = new Set(items.map((item) => item.productId));

    return activeProducts
      .filter((product) => !cartProductIds.has(product.id))
      .map((product) => ({ product, rank: categoryRank.get(product.categoryId) ?? getUpsellRank(product.category) }))
      .filter(({ rank }) => rank < Number.POSITIVE_INFINITY)
      .sort((a, b) => a.rank - b.rank || Number(a.product.sellingPrice) - Number(b.product.sellingPrice) || a.product.name.localeCompare(b.product.name))
      .slice(0, 8)
      .map(({ product }) => product);
  }, [activeCategories, activeProducts, items]);

  if (!items.length) {
    return null;
  }

  if (activeLoading) {
    return (
      <section className="mt-5">
        <div className="skeleton h-6 w-56 rounded-full" />
        <div className="no-scrollbar mt-3 flex max-w-full snap-x gap-2.5 overflow-x-auto overflow-y-visible overscroll-x-contain pb-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="skeleton h-36 min-w-[9.5rem] rounded-[1.2rem]" key={index} />
          ))}
        </div>
      </section>
    );
  }

  if (!recommended.length) {
    return null;
  }

  return (
    <MotionDiv {...sectionMotion} className="mt-5">
      <div className="mb-2.5 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#17314A] sm:text-2xl">Hech narsa qolib ketmadimi?</h2>
          <p className="mt-0.5 text-xs font-semibold text-[#17314A]/58 sm:text-sm">Sous, ichimlik yoki gazak qo'shing.</p>
        </div>
        <Link className="hidden text-sm font-black text-[#0B7F75] sm:inline" href="/menu">Menyu</Link>
      </div>
      <div
        className="no-scrollbar -mx-1 flex max-w-full snap-x gap-2.5 overflow-x-auto overflow-y-visible overscroll-x-contain px-1 pb-5 pt-1"
        data-upsell-rail
      >
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
  const canQuickAdd = product.variants.length <= 1 && !product.modifiers.length;

  return (
    <article className="mf-cart-upsell-card grid w-[9.6rem] shrink-0 snap-start overflow-hidden rounded-[1.15rem] sm:w-[10.5rem]">
      <MediaImage
        alt={product.name}
        aspectClassName="h-24 sm:h-[6.5rem]"
        imageClassName="transition-transform duration-300 hover:scale-[1.04]"
        ref={imageRef}
        sizes="168px"
        src={product.imageUrl}
      />
      <div className="grid min-w-0 gap-2 p-2.5">
        <h3 className="line-clamp-2 min-h-[2.25rem] text-sm font-black leading-tight text-[#17314A]">{product.name}</h3>
        <div className="flex min-w-0 items-center justify-between gap-1.5">
          <span className="min-w-0 truncate text-xs font-black text-[#0B7F75]">{formatMoney(price)}</span>
          {canQuickAdd ? (
            <MotionButton
              {...buttonMotion}
              aria-label={`${product.name} savatga qo'shish`}
              className="pressable ripple mf-button-primary grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base font-black"
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
              +
            </MotionButton>
          ) : (
            <Link
              aria-label={`${product.name} tanlash`}
              className="mf-button-primary grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-black"
              href={`/product/${product.id}`}
            >
              →
            </Link>
          )}
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
