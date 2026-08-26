"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion } from "framer-motion";
import { MediaImage } from "./media-image";
import { MotionArticle, MotionButton, buttonMotion, cardMotion, hapticTap, imageMotion } from "./motion-primitives";
import { formatMoney, useCart } from "../lib/cart";
import type { Product } from "../lib/types";

export function ProductCard({ product }: { product: Product }) {
  const imageRef = useRef<HTMLDivElement | null>(null);
  const { addItem, isFavorite, toggleFavorite, triggerCartFlight } = useCart();
  const variant = product.variants.find((candidate) => candidate.isDefault) ?? product.variants[0];
  const price = variant?.sellingPrice ?? product.sellingPrice;

  return (
    <MotionArticle
      {...cardMotion}
      className="mf-card group min-w-0 overflow-hidden shadow-[0_22px_70px_rgba(34,197,94,0.14)] [transform-style:preserve-3d]"
      initial={{ opacity: 0, y: 18 }}
      viewport={{ once: true, margin: "-48px" }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <div className="relative">
        <Link href={`/product/${product.id}`}>
          <MediaImage
            alt={product.name}
            aspectClassName="aspect-[4/3]"
            className="will-change-transform"
            imageClassName="group-hover:scale-[1.03]"
            motionProps={{
              ...imageMotion,
              layoutId: `product-image-${product.id}`,
            }}
            ref={imageRef}
            src={product.imageUrl}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </Link>
        <button
          aria-label="Sevimlilarga qo'shish"
          className={`pressable absolute right-3 top-3 h-10 w-10 rounded-full text-lg font-black shadow-lg ${isFavorite(product.id) ? "bg-[#22C55E] text-[#04130B]" : "bg-black/45 text-white backdrop-blur hover:bg-white/16"}`}
          onClick={() => {
            hapticTap(8);
            toggleFavorite(product.id);
          }}
          type="button"
        >
          ♥
        </button>
        {product.isCombo ? (
          <span className="absolute left-3 top-3 rounded-full bg-[#22C55E] px-3 py-1 text-xs font-black uppercase text-[#04130B]">
            Set
          </span>
        ) : null}
      </div>
      <div className="p-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <Link className="min-w-0 break-words text-lg font-black text-white transition hover:text-[#67E8F9]" href={`/product/${product.id}`}>
            {product.name}
          </Link>
          <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-black text-[#67E8F9]">
            {product.preparationTime ?? 10} daq
          </span>
        </div>
        <p className="mt-2 line-clamp-2 min-h-11 text-sm leading-5 text-white/58">
          {product.description ?? "Buyurtmadan keyin issiq tayyorlanadi."}
        </p>
        <div className="mt-4 flex min-w-0 items-center justify-between gap-3">
          <motion.span
            className="text-lg font-black text-white"
            layout
            transition={{ type: "spring", stiffness: 520, damping: 34 }}
          >
            {formatMoney(price)}
          </motion.span>
          <MotionButton
            {...buttonMotion}
            className="pressable ripple mf-button-primary shrink-0 px-4 py-3 text-sm font-black"
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
    </MotionArticle>
  );
}
