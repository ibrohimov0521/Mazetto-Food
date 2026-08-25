"use client";

import Link from "next/link";
import { formatMoney, productImage, useCart } from "../lib/cart";
import type { Product } from "../lib/types";

export function ProductCard({ product }: { product: Product }) {
  const { addItem, isFavorite, toggleFavorite } = useCart();
  const variant = product.variants.find((candidate) => candidate.isDefault) ?? product.variants[0];
  const price = variant?.sellingPrice ?? product.sellingPrice;

  return (
    <article className="group overflow-hidden rounded-xl border border-neutral-100 bg-white shadow-[0_14px_42px_rgba(17,24,39,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_60px_rgba(22,163,74,0.18)]">
      <div className="relative">
        <Link href={`/product/${product.id}`}>
          <img alt={product.name} className="h-48 w-full object-cover transition duration-500 group-hover:scale-105" src={productImage(product.imageUrl)} />
        </Link>
        <button
          aria-label="Sevimlilarga qo'shish"
          className={`pressable absolute right-3 top-3 h-10 w-10 rounded-full text-lg font-black shadow-lg ${isFavorite(product.id) ? "bg-emerald-600 text-white" : "bg-white/90 text-neutral-700 hover:bg-emerald-50"}`}
          onClick={() => toggleFavorite(product.id)}
          type="button"
        >
          ♥
        </button>
        {product.isCombo ? (
          <span className="absolute left-3 top-3 rounded-full bg-emerald-600 px-3 py-1 text-xs font-black uppercase text-white">
            Set
          </span>
        ) : null}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <Link className="text-lg font-black text-neutral-950 transition hover:text-emerald-700" href={`/product/${product.id}`}>
            {product.name}
          </Link>
          <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
            {product.preparationTime ?? 10} daq
          </span>
        </div>
        <p className="mt-2 line-clamp-2 min-h-11 text-sm leading-5 text-neutral-500">
          {product.description ?? "Buyurtmadan keyin issiq tayyorlanadi."}
        </p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-lg font-black text-neutral-950">{formatMoney(price)}</span>
          <button
            className="pressable rounded-xl bg-[#16A34A] px-4 py-3 text-sm font-black text-white shadow-[0_10px_24px_rgba(22,163,74,0.24)] hover:bg-emerald-700"
            onClick={() =>
              addItem({
                productId: product.id,
                productName: product.name,
                imageUrl: product.imageUrl,
                variantId: variant?.id,
                variantName: variant?.name,
                unitPrice: price,
                quantity: 1,
                modifiers: [],
              })
            }
            type="button"
          >
            Qo'shish
          </button>
        </div>
      </div>
    </article>
  );
}
