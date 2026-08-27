"use client";

import Link from "next/link";
import { useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { MediaImage } from "./media-image";
import { MotionArticle, MotionButton, buttonMotion, cardMotion, hapticTap, imageMotion } from "./motion-primitives";
import { cartItemKey, formatMoney, useCart } from "../lib/cart";
import type { Product } from "../lib/types";

export function ProductCard({ compact = false, product }: { compact?: boolean; product: Product }) {
  const imageRef = useRef<HTMLDivElement | null>(null);
  const { addItem, isFavorite, items, toggleFavorite, triggerCartFlight, updateQuantity } = useCart();
  const variant = product.variants.find((candidate) => candidate.isDefault) ?? product.variants[0];
  const price = variant?.sellingPrice ?? product.sellingPrice;
  const requiresConfiguration = product.modifiers.some((link) => link.isRequired) || !variant;
  const quickCartKey = useMemo(
    () =>
      cartItemKey({
        productId: product.id,
        variantId: variant?.id,
        modifiers: [],
      }),
    [product.id, variant?.id],
  );
  const cartLine = items.find((item) => item.key === quickCartKey);

  return (
    <MotionArticle
      {...cardMotion}
      data-product-card="true"
      className="mf-card mf-leaf-corner group min-w-0 overflow-hidden shadow-[0_14px_34px_rgba(34,197,94,0.12)] [transform-style:preserve-3d]"
      initial={{ opacity: 0, y: 18 }}
      viewport={{ once: true, margin: "-48px" }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <div className="relative">
        <Link href={`/product/${product.id}`}>
          <MediaImage
            alt={product.name}
            aspectClassName={compact ? "aspect-[4/3]" : "aspect-[4/3]"}
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
          className={`pressable absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full text-sm font-black shadow-lg ${isFavorite(product.id) ? "bg-[#22C55E] text-[#04130B]" : "bg-black/45 text-white backdrop-blur hover:bg-white/16"}`}
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
      <div className={compact ? "p-2.5" : "p-4"}>
        <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">
          <Link className={`${compact ? "line-clamp-2 text-[13px] sm:text-sm" : "text-lg"} min-w-0 break-words font-black leading-tight text-white transition hover:text-[#67E8F9]`} href={`/product/${product.id}`}>
            {product.name}
          </Link>
          <span className={`${compact ? "hidden min-[390px]:inline-flex" : "inline-flex"} shrink-0 rounded-full bg-white/10 px-2 py-1 text-[10px] font-black text-[#67E8F9] sm:px-3 sm:text-xs`}>
            {product.preparationTime ?? 10} daq
          </span>
        </div>
        <p className={`${compact ? "mt-1 line-clamp-2 min-h-8 text-[10px] leading-4 sm:text-[11px]" : "mt-2 line-clamp-2 min-h-11 text-sm leading-5"} text-white/64`}>
          {product.description ?? "Buyurtmadan keyin issiq tayyorlanadi."}
        </p>
        <div className={`${compact ? "mt-3" : "mt-4"} flex min-w-0 items-center justify-between gap-2 sm:gap-3`}>
          <motion.span
            className={`${compact ? "text-[13px] sm:text-sm" : "text-lg"} min-w-0 break-words font-black text-white`}
            layout
            transition={{ type: "spring", stiffness: 520, damping: 34 }}
          >
            {formatMoney(price)}
          </motion.span>
          {cartLine && !requiresConfiguration ? (
            <div className="mf-button-primary grid h-9 shrink-0 grid-cols-3 items-center overflow-hidden rounded-full text-sm font-black">
              <button aria-label={`${product.name} kamaytirish`} className="pressable h-9 w-8" onClick={() => { hapticTap(8); updateQuantity(cartLine.key, cartLine.quantity - 1); }} type="button">-</button>
              <motion.span animate={{ scale: [1, 1.16, 1] }} className="w-7 text-center" key={cartLine.quantity} transition={{ duration: 0.22 }}>{cartLine.quantity}</motion.span>
              <button aria-label={`${product.name} qo'shish`} className="pressable h-9 w-8" onClick={() => { hapticTap(8); updateQuantity(cartLine.key, cartLine.quantity + 1); }} type="button">+</button>
            </div>
          ) : requiresConfiguration ? (
            <Link className={`${compact ? "grid h-9 w-9 place-items-center rounded-full px-0 py-0 text-lg" : "px-4 py-3 text-sm"} pressable ripple mf-button-primary shrink-0 text-center font-black`} href={`/product/${product.id}`}>
              {compact ? "+" : "Tanlash"}
            </Link>
          ) : (
            <MotionButton
              {...buttonMotion}
              aria-label={`${product.name} savatga qo'shish`}
              className={`${compact ? "grid h-9 w-9 place-items-center rounded-full px-0 py-0 text-lg" : "px-4 py-3 text-sm"} pressable ripple mf-button-primary shrink-0 font-black`}
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
          )}
        </div>
      </div>
    </MotionArticle>
  );
}
