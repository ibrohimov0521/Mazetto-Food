"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion } from "framer-motion";
import { MediaImage } from "./media-image";
import { MotionArticle, MotionButton, buttonMotion, cardMotion, hapticTap, imageMotion } from "./motion-primitives";
import { formatMoney, useCart } from "../lib/cart";
import type { Product } from "../lib/types";

export function ProductCard({ compact = false, product }: { compact?: boolean; product: Product }) {
  const imageRef = useRef<HTMLDivElement | null>(null);
  const { addItem, isFavorite, toggleFavorite, triggerCartFlight } = useCart();
  const variant = product.variants.find((candidate) => candidate.isDefault) ?? product.variants[0];
  const price = variant?.sellingPrice ?? product.sellingPrice;

  return (
    <MotionArticle
      {...cardMotion}
      data-product-card="true"
      className="mf-card mf-leaf-corner group min-w-0 overflow-hidden shadow-[0_18px_54px_rgba(34,197,94,0.13)] [transform-style:preserve-3d]"
      initial={{ opacity: 0, y: 18 }}
      viewport={{ once: true, margin: "-48px" }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <div className="relative">
        <Link href={`/product/${product.id}`}>
          <MediaImage
            alt={product.name}
            aspectClassName={compact ? "aspect-[5/4]" : "aspect-[4/3]"}
            className="will-change-transform"
            imageClassName="group-hover:scale-[1.03]"
            motionProps={{
              ...imageMotion,
              layoutId: `product-image-${product.id}`,
            }}
            ref={imageRef}
            src={product.imageUrl}
            sizes={compact ? "(max-width: 767px) 50vw, (max-width: 1280px) 33vw, 25vw" : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"}
          />
        </Link>
        <button
          aria-label="Sevimlilarga qo'shish"
          className={`pressable absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full text-sm font-black shadow-lg sm:right-3 sm:top-3 sm:h-10 sm:w-10 sm:text-lg ${isFavorite(product.id) ? "bg-[#22C55E] text-[#04130B]" : "bg-black/45 text-white backdrop-blur hover:bg-white/16"}`}
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
      <div className={compact ? "p-3" : "p-4"}>
        <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">
          <Link className={`${compact ? "line-clamp-2 text-sm sm:text-base" : "text-lg"} min-w-0 break-words font-black leading-tight text-white transition hover:text-[#67E8F9]`} href={`/product/${product.id}`}>
            {product.name}
          </Link>
          <span className={`${compact ? "hidden min-[390px]:inline-flex" : "inline-flex"} shrink-0 rounded-full bg-white/10 px-2 py-1 text-[10px] font-black text-[#67E8F9] sm:px-3 sm:text-xs`}>
            {product.preparationTime ?? 10} daq
          </span>
        </div>
        <p className={`${compact ? "mt-1 line-clamp-2 min-h-8 text-[11px] leading-4 sm:text-xs" : "mt-2 line-clamp-2 min-h-11 text-sm leading-5"} text-white/64`}>
          {product.description ?? "Buyurtmadan keyin issiq tayyorlanadi."}
        </p>
        <div className={`${compact ? "mt-3" : "mt-4"} flex min-w-0 items-center justify-between gap-2 sm:gap-3`}>
          <motion.span
            className={`${compact ? "text-sm sm:text-base" : "text-lg"} min-w-0 break-words font-black text-white`}
            layout
            transition={{ type: "spring", stiffness: 520, damping: 34 }}
          >
            {formatMoney(price)}
          </motion.span>
          <MotionButton
            {...buttonMotion}
            aria-label={`${product.name} savatga qo'shish`}
            className={`${compact ? "grid h-10 w-10 place-items-center rounded-full px-0 py-0 text-xl" : "px-4 py-3 text-sm"} pressable ripple mf-button-primary shrink-0 font-black`}
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
            {compact ? "+" : "Qo'shish"}
          </MotionButton>
        </div>
      </div>
    </MotionArticle>
  );
}
