"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
      className={`mf-product-card mf-product-card-locked mf-leaf-corner group min-w-0 overflow-hidden [transform-style:preserve-3d] ${compact ? "is-compact" : ""}`}
      initial={{ opacity: 0, y: 18 }}
      viewport={{ once: true, margin: "-48px" }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <div className="mf-product-media-shell relative">
        <Link href={`/product/${product.id}`}>
          <MediaImage
            alt={product.name}
            aspectClassName={compact ? "aspect-[1.22/1]" : "aspect-[4/3]"}
            className="mf-product-media will-change-transform"
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
          <span className="absolute left-2.5 top-2.5 rounded-full bg-[#F5CF00] px-2.5 py-1 text-[10px] font-black uppercase text-[#07373A] shadow-[0_10px_22px_rgba(245,207,0,0.28)]">
            Set
          </span>
        ) : null}
      </div>
      <div className={compact ? "grid min-h-0 grid-rows-[2.35rem_2.35rem_2.75rem] gap-1.5 p-2.5" : "grid gap-2 p-4"}>
        <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">
          <Link className={`${compact ? "line-clamp-2 text-[13px] sm:text-sm" : "text-lg"} mf-product-title min-w-0 break-words font-black leading-tight text-white transition hover:text-[#F5CF00]`} href={`/product/${product.id}`}>
            {product.name}
          </Link>
          <span className={`${compact ? "hidden min-[390px]:inline-flex" : "inline-flex"} mf-product-badge shrink-0 rounded-full bg-white/12 px-2 py-1 text-[10px] font-black text-[#DDFCF3] sm:px-3 sm:text-xs`}>
            {product.preparationTime ?? 10} daq
          </span>
        </div>
        <p className={`${compact ? "line-clamp-2 text-[10px] leading-4 sm:text-[11px]" : "line-clamp-2 min-h-11 text-sm leading-5"} mf-product-description text-white/64`}>
          {product.description ?? "Buyurtmadan keyin issiq tayyorlanadi."}
        </p>
        <div className="mf-product-price-row flex min-w-0 items-center justify-between gap-2 sm:gap-3">
          <motion.span
            className={`${compact ? "text-[14px] min-[390px]:text-[15px] sm:text-base" : "text-lg"} mf-product-price min-w-0 font-black text-[#F5CF00]`}
            layout
            transition={{ type: "spring", stiffness: 520, damping: 34 }}
          >
            {formatMoney(price)}
          </motion.span>
          <div className="mf-product-action-slot">
            {cartLine && !requiresConfiguration ? (
              <ProductQuantityControl
                onDecrease={() => {
                  hapticTap(8);
                  updateQuantity(cartLine.key, cartLine.quantity - 1);
                }}
                onIncrease={() => {
                  hapticTap(8);
                  updateQuantity(cartLine.key, cartLine.quantity + 1);
                }}
                productName={product.name}
                quantity={cartLine.quantity}
              />
            ) : requiresConfiguration ? (
              <Link className="pressable ripple mf-button-primary mf-product-plus justify-self-end text-center font-black" href={`/product/${product.id}`}>
                {compact ? "+" : "Tanlash"}
              </Link>
            ) : (
              <MotionButton
                {...buttonMotion}
                aria-label={`${product.name} savatga qo'shish`}
                className="pressable ripple mf-button-primary mf-product-plus justify-self-end font-black"
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
      </div>
    </MotionArticle>
  );
}

function ProductQuantityControl({
  onDecrease,
  onIncrease,
  productName,
  quantity,
}: {
  onDecrease: () => void;
  onIncrease: () => void;
  productName: string;
  quantity: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const collapseTimer = useRef<number | null>(null);

  const clearCollapseTimer = useCallback(() => {
    if (collapseTimer.current) {
      window.clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    }
  }, []);

  const scheduleCollapse = useCallback(() => {
    clearCollapseTimer();
    collapseTimer.current = window.setTimeout(() => {
      setExpanded(false);
      collapseTimer.current = null;
    }, 2000);
  }, [clearCollapseTimer]);

  const expand = useCallback(() => {
    setExpanded(true);
    scheduleCollapse();
  }, [scheduleCollapse]);

  useEffect(() => clearCollapseTimer, [clearCollapseTimer]);

  useEffect(() => {
    if (expanded) {
      scheduleCollapse();
    }
  }, [expanded, quantity, scheduleCollapse]);

  return (
    <motion.div
      animate={{ scale: expanded ? 1 : 0.98 }}
      className={`mf-product-stepper mf-button-primary ${expanded ? "is-expanded" : "is-collapsed"} items-center overflow-hidden rounded-full text-sm font-black`}
      initial={false}
      transition={{ type: "spring", stiffness: 520, damping: 38 }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {expanded ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="grid h-full w-full grid-cols-3 items-center"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key="expanded"
            transition={{ duration: 0.16 }}
          >
            <button
              aria-label={`${productName} kamaytirish`}
              className="pressable h-full w-full"
              onClick={() => {
                onDecrease();
                scheduleCollapse();
              }}
              type="button"
            >
              -
            </button>
            <motion.span
              animate={{ scale: [1, 1.16, 1] }}
              className="text-center"
              key={quantity}
              transition={{ duration: 0.22 }}
            >
              {quantity}
            </motion.span>
            <button
              aria-label={`${productName} qo'shish`}
              className="pressable h-full w-full"
              onClick={() => {
                onIncrease();
                scheduleCollapse();
              }}
              type="button"
            >
              +
            </button>
          </motion.div>
        ) : (
          <motion.button
            animate={{ opacity: 1, scale: 1 }}
            aria-label={`${productName} miqdori ${quantity}. O'zgartirish`}
            className="pressable grid h-full w-full place-items-center"
            exit={{ opacity: 0, scale: 0.92 }}
            initial={{ opacity: 0, scale: 0.92 }}
            key="collapsed"
            onClick={expand}
            transition={{ duration: 0.16 }}
            type="button"
          >
            {quantity}
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
