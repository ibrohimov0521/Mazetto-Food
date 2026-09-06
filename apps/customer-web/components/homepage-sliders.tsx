"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { MediaImage } from "./media-image";
import { MotionDiv, sectionMotion } from "./motion-primitives";
import { formatMoney } from "../lib/cart";
import type { HomepageHeroSlide, HomepagePromotion, Product } from "../lib/types";

export function HomepageHeroSlider({ slides, fallbackProduct, menuHref, loading }: {
  slides: HomepageHeroSlide[];
  fallbackProduct: Product | undefined;
  menuHref: string;
  loading: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const safeSlides = useMemo(() => slides.filter((slide) => slide.title), [slides]);
  const activeSlide = safeSlides[activeIndex] ?? safeSlides[0];

  function goTo(index: number) {
    if (!safeSlides.length) return;
    setActiveIndex((index + safeSlides.length) % safeSlides.length);
  }

  const product = activeSlide?.product ?? fallbackProduct;
  const title = activeSlide?.title ?? fallbackProduct?.name ?? "MAZETTO FOOD";
  const imageUrl = activeSlide?.imageUrl ?? product?.imageUrl;
  const subtitle = activeSlide?.subtitle?.trim() || "";
  const href = activeIndex === 0 ? menuHref : activeSlide?.targetUrl ?? (product ? `/product/${product.id}` : menuHref);

  return (
    <section aria-label="MAZETTO taomlari" aria-roledescription="karusel" className="mf-home-hero mf-hero-restored" data-home-slider>
      <div className="mf-hero-copy">
        <p className="mf-hero-eyebrow">{activeSlide?.badge || "MAZETTO FOOD"}</p>
        <h1>{title}</h1>
        {subtitle ? <p className="mf-hero-description">{subtitle}</p> : null}
        <div className="mf-hero-actions">
        <Link className="pressable mf-button-primary mf-home-order-cta" href={href}>
          {activeSlide?.ctaLabel ?? "Buyurtma berish"}
        </Link>
        {product ? <p className="mf-hero-price">{formatMoney(product.sellingPrice)}</p> : null}
        </div>
      </div>
      <div className="mf-home-hero-media" onTouchStart={(event) => {
        const touch = event.touches[0];
        touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
      }} onTouchCancel={() => { touchStart.current = null; }} onTouchEnd={(event) => {
        const start = touchStart.current;
        const end = event.changedTouches[0];
        touchStart.current = null;
        if (!start || !end) return;
        const dx = end.clientX - start.x;
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(end.clientY - start.y)) goTo(activeIndex + (dx < 0 ? 1 : -1));
      }}>
        {loading ? <div className="skeleton h-full" /> : <MediaImage
          alt={product?.name ?? title}
          aspectClassName="h-full"
          fit="cover"
          imageClassName="max-md:object-contain"
          priority
          sizes="(max-width: 767px) 55vw, (max-width: 1152px) 55vw, 616px"
          src={imageUrl}
        />}
      </div>
      <div className="mf-hero-navigation">
        <div className="flex min-w-0 flex-wrap">
          {safeSlides.map((slide, index) => <button
            aria-label={`${index + 1}-slayd`}
            aria-pressed={index === activeIndex}
            className="mf-hero-dot"
            key={slide.id}
            onClick={() => goTo(index)}
            type="button"
          ><span /></button>)}
        </div>
        {safeSlides.length > 1 ? <div className="flex gap-2">
          <button aria-label="Oldingi slayd" className="pressable mf-slider-arrow grid h-11 w-11 place-items-center rounded-full" onClick={() => goTo(activeIndex - 1)} type="button">‹</button>
          <button aria-label="Keyingi slayd" className="pressable mf-slider-arrow grid h-11 w-11 place-items-center rounded-full" onClick={() => goTo(activeIndex + 1)} type="button">›</button>
        </div> : null}
      </div>
    </section>
  );
}

export function PromotionSlider({ promotions }: { promotions: HomepagePromotion[] }) {
  if (!promotions.length) {
    return null;
  }

  return (
    <MotionDiv {...sectionMotion} className="mx-auto max-w-6xl px-4 pb-8">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="mf-section-link text-sm font-black uppercase">Aksiyalar</p>
          <h2 className="mf-section-heading">Bugungi foydali takliflar</h2>
        </div>
        <Link className="pressable mf-section-link text-sm font-black" href="/menu">Menyuga o'tish</Link>
      </div>
      <div className="no-scrollbar flex max-w-full snap-x gap-3 overflow-x-auto pb-2">
        {promotions.map((promotion) => {
          const href = promotion.targetUrl ?? (promotion.product ? `/product/${promotion.product.id}` : promotion.category ? `/menu?category=${promotion.category.id}` : "/menu");
          return (
            <Link className="mazetto-liquid-surface grid w-[min(19rem,82vw)] shrink-0 snap-start overflow-hidden rounded-[1.6rem] sm:w-[24rem] sm:grid-cols-[minmax(0,1fr)_9rem]" href={href} key={promotion.id}>
              <div className="min-w-0 p-4">
                {promotion.badge ?? promotion.discountPercent ? (
                  <span className="mazetto-glass-chip inline-flex rounded-full px-3 py-1.5 text-xs font-black text-[#67E8F9]">
                    {promotion.badge ?? `${Number(promotion.discountPercent)}% chegirma`}
                  </span>
                ) : null}
                <h3 className="mt-3 text-xl font-black text-white">{promotion.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/60">
                  {promotion.description ?? promotion.product?.name ?? "Cheklangan muddatli taklif."}
                </p>
                <span className="mt-4 inline-flex text-sm font-black text-[#67E8F9]">
                  {promotion.ctaLabel ?? "Ko'rish"}
                </span>
              </div>
              <MediaImage
                alt={promotion.title}
                aspectClassName="h-40 sm:h-full"
                className="h-full"
                sizes="160px"
                src={promotion.imageUrl ?? promotion.product?.imageUrl ?? promotion.category?.imageUrl}
              />
            </Link>
          );
        })}
      </div>
    </MotionDiv>
  );
}
