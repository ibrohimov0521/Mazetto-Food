"use client";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MediaImage } from "./media-image";
import { hapticTap } from "./motion-primitives";
import { cartItemKey, formatMoney, useCart } from "../lib/cart";
import type { Product } from "../lib/types";
import { localizeMenuName } from "../lib/customer-display";

export function ProductCard({ compact = false, eager = false, product }: { compact?: boolean; eager?: boolean; product: Product }) {
  const locale = useLocale();
  const t = useTranslations("Customer");
  const meta = useTranslations("CustomerMeta");
  const displayName = localizeMenuName(product.name, locale);
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
  const actionControl = cartLine && !requiresConfiguration ? (
    <ProductQuantityControl
      onDecrease={() => {
        hapticTap(8);
        updateQuantity(cartLine.key, cartLine.quantity - 1);
      }}
      onIncrease={() => {
        hapticTap(8);
        updateQuantity(cartLine.key, cartLine.quantity + 1);
      }}
      productName={displayName}
      quantity={cartLine.quantity}
    />
  ) : requiresConfiguration ? (
    <Link aria-label={meta("chooseVariant", { product: displayName })} className="pressable ripple mf-button-primary mf-product-plus justify-self-end text-center font-black" href={`/product/${product.id}`}>
      {compact ? "+" : t("tanlash_9c8e93d8")}
    </Link>
  ) : (
    <button
      aria-label={meta("addToCart", { product: displayName })}
      className="pressable ripple mf-button-primary mf-product-plus justify-self-end font-black"
      onClick={() => {
        const rect = imageRef.current?.getBoundingClientRect();

        hapticTap([10, 24, 10]);
        const added = addItem({
          productId: product.id,
          productName: product.name,
          imageUrl: product.imageUrl,
          variantId: variant?.id,
          variantName: variant?.name,
          unitPrice: price,
          quantity: 1,
          modifiers: [],
        });
        if (added && rect) triggerCartFlight(product.imageUrl, rect);
      }}
      type="button"
    >
      {compact ? "+" : t("qo_shish_50bbede6")}
    </button>
  );

  return (
    <article
      // Lift without scaling/tilting the text and image's rasterized layer.
      data-product-card="true"
      className={`mf-product-card mf-product-card-locked mf-product-card-lift mf-leaf-corner group min-w-0 overflow-hidden ${compact ? "is-compact" : ""}`}
    >
      <div className="mf-product-media-shell relative">
        <Link href={`/product/${product.id}`}>
          <MediaImage
            alt={displayName}
            aspectClassName={compact ? "aspect-[1.22/1]" : "aspect-[4/3]"}
            className="mf-product-media"
            ref={imageRef}
            eager={eager}
            src={product.imageUrl}
            sizes={compact ? "(max-width: 767px) 50vw, (max-width: 1152px) 33vw, (max-width: 1279px) 360px, 270px" : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"}
          />
        </Link>
        <button
          aria-label={isFavorite(product.id) ? meta("removeFavorite", { product: displayName }) : meta("addFavorite", { product: displayName })}
          aria-pressed={isFavorite(product.id)}
          title={isFavorite(product.id) ? meta("removeFavorite", { product: displayName }) : meta("addFavorite", { product: displayName })}
          className={`pressable mf-favorite-button absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-xl text-lg ${isFavorite(product.id) ? "is-active" : ""}`}
          onClick={() => {
            hapticTap(8);
            toggleFavorite(product.id);
          }}
          type="button"
        >
          ♥
        </button>
        {product.isCombo ? (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-[#F5CF00] px-2.5 py-1 text-[11px] font-black uppercase text-[#07373A] shadow-[0_10px_22px_rgba(245,207,0,0.28)]">
            {t("set_448ab73b")}</span>
        ) : null}
        <div className="mf-product-action-slot">
          {actionControl}
        </div>
      </div>
      <div className={compact ? "mf-product-copy grid min-h-0 gap-1.5 p-2.5" : "grid gap-2 p-4"}>
        <div className="relative min-w-0">
          <Link className={`${compact ? "line-clamp-2 text-[13px] sm:text-sm" : "text-lg"} mf-product-title min-w-0 break-words font-black leading-tight text-white transition hover:text-[#F5CF00]`} href={`/product/${product.id}`}>
            {displayName}
          </Link>
          <span className={`${compact ? "hidden" : "inline-flex mt-1"} mf-product-badge shrink-0 rounded-full bg-white/12 px-2 py-1 text-[11px] font-black text-[#DDFCF3] sm:px-3 sm:text-xs`}>
            {product.preparationTime != null ? meta("minutes", { minutes: product.preparationTime }) : ""}
          </span>
        </div>
        <p className={`${compact ? "line-clamp-2 text-[12px] leading-4" : "line-clamp-2 min-h-11 text-sm leading-5"} mf-product-description text-white/80`}>
          {product.description?.trim() || t("buyurtmadan_keyin_issiq_tayyorlanadi_7d962529")}
        </p>
        <div className="mf-product-price-row flex min-w-0 items-center justify-between gap-2 sm:gap-3">
          <span className={`${compact ? "text-[14px] min-[390px]:text-[15px] sm:text-base" : "text-lg"} mf-product-price min-w-0 font-black text-[#F5CF00]`}>
            {formatMoney(price, locale)}
          </span>
        </div>
      </div>
    </article>
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
  const meta = useTranslations("CustomerMeta");
  const [expanded, setExpanded] = useState(false);
  const stepperRef = useRef<HTMLDivElement | null>(null);
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
      if (stepperRef.current?.contains(document.activeElement)) return;
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
    <div
      ref={stepperRef}
      className={`mf-product-stepper mf-button-primary ${expanded ? "is-expanded" : "is-collapsed"} relative items-center overflow-hidden rounded-full text-sm font-black`}
      onFocusCapture={() => { setExpanded(true); clearCollapseTimer(); }}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) scheduleCollapse(); }}
    >
      <div aria-hidden={!expanded} className="mf-stepper-face grid h-full w-full grid-cols-3 items-center" data-visible={expanded ? "true" : "false"}>
        <button
          aria-label={meta("decreaseQuantity", { product: productName })}
          className="pressable h-full w-full"
          onClick={() => {
            onDecrease();
            scheduleCollapse();
          }}
          tabIndex={expanded ? undefined : -1}
          type="button"
        >
          -
        </button>
        <span className="mf-stepper-count text-center" key={quantity}>
          {quantity}
        </span>
        <button
          aria-label={meta("increaseQuantity", { product: productName })}
          className="pressable h-full w-full"
          onClick={() => {
            onIncrease();
            scheduleCollapse();
          }}
          tabIndex={expanded ? undefined : -1}
          type="button"
        >
          +
        </button>
      </div>
      <button
        aria-hidden={expanded}
        aria-label={meta("changeQuantity", { product: productName, quantity })}
        className="mf-stepper-face pressable grid h-full w-full place-items-center"
        data-visible={expanded ? "false" : "true"}
        onClick={expand}
        tabIndex={expanded ? -1 : undefined}
        type="button"
      >
        {quantity}
      </button>
    </div>
  );
}
