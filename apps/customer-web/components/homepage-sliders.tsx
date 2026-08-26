"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { MediaImage } from "./media-image";
import { MotionDiv, buttonMotion, sectionMotion } from "./motion-primitives";
import { formatMoney } from "../lib/cart";
import type { HomepageHeroSlide, HomepagePromotion } from "../lib/types";

export function HomepageHeroSlider({ slides }: { slides: HomepageHeroSlide[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const safeSlides = useMemo(() => slides.filter((slide) => slide.title), [slides]);
  const activeSlide = safeSlides[activeIndex] ?? safeSlides[0];

  useEffect(() => {
    if (safeSlides.length < 2) {
      return;
    }

    const timer = window.setInterval(
      () => setActiveIndex((current) => (current + 1) % safeSlides.length),
      5200,
    );
    return () => window.clearInterval(timer);
  }, [safeSlides.length]);

  if (!activeSlide) {
    return null;
  }

  function goTo(index: number) {
    setActiveIndex((index + safeSlides.length) % safeSlides.length);
  }

  const href = activeSlide.targetUrl ?? (activeSlide.product ? `/product/${activeSlide.product.id}` : "/menu");

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 lg:py-10">
      <div className="mazetto-liquid-surface grid min-h-[33rem] min-w-0 overflow-hidden rounded-[2rem] lg:min-h-[30rem] lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="relative z-10 flex min-w-0 flex-col justify-between gap-8 p-5 sm:p-7 lg:p-9">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeSlide.id}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              initial={{ opacity: 0, x: 18 }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            >
              {activeSlide.badge ? (
                <span className="mazetto-glass-chip inline-flex rounded-full px-4 py-2 text-xs font-black uppercase text-[#67E8F9]">
                  {activeSlide.badge}
                </span>
              ) : null}
              <h1 className="mt-5 break-words text-4xl font-black leading-tight text-white sm:text-5xl lg:text-6xl">
                {activeSlide.title}
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-white/64 sm:text-lg">
                {activeSlide.subtitle ?? "MAZETTO FOOD menyusidan issiq va tez tayyorlanadigan taom."}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <motion.div {...buttonMotion}>
                  <Link className="pressable ripple mf-button-primary inline-flex px-6 py-4 text-sm font-black" href={href}>
                    {activeSlide.ctaLabel ?? "Buyurtma berish"}
                  </Link>
                </motion.div>
                {activeSlide.product ? (
                  <span className="mazetto-glass-chip rounded-full px-4 py-3 text-sm font-black text-[#67E8F9]">
                    {formatMoney(activeSlide.product.sellingPrice)}
                  </span>
                ) : null}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="flex min-w-0 items-center justify-between gap-4">
            <div className="flex gap-2">
              {safeSlides.map((slide, index) => (
                <button
                  aria-label={`${index + 1}-slayd`}
                  className={`h-2.5 rounded-full transition-all ${index === activeIndex ? "w-9 bg-[#67E8F9]" : "w-2.5 bg-white/24"}`}
                  key={slide.id}
                  onClick={() => goTo(index)}
                  type="button"
                />
              ))}
            </div>
            {safeSlides.length > 1 ? (
              <div className="hidden gap-2 sm:flex">
                <button aria-label="Oldingi slayd" className="pressable mazetto-glass-button grid h-11 w-11 place-items-center rounded-full text-white" onClick={() => goTo(activeIndex - 1)} type="button">
                  ‹
                </button>
                <button aria-label="Keyingi slayd" className="pressable mazetto-glass-button grid h-11 w-11 place-items-center rounded-full text-white" onClick={() => goTo(activeIndex + 1)} type="button">
                  ›
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="relative min-h-[19rem] overflow-hidden lg:min-h-full">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.16}
              key={activeSlide.id}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 1.02, x: -24 }}
              initial={{ opacity: 0, scale: 1.03, x: 24 }}
              onDragEnd={(_, info) => {
                if (Math.abs(info.offset.x) > 48) {
                  goTo(activeIndex + (info.offset.x < 0 ? 1 : -1));
                }
              }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            >
              <MediaImage
                alt={activeSlide.title}
                aspectClassName="min-h-[19rem] lg:min-h-[30rem]"
                className="h-full"
                imageClassName="scale-[1.02]"
                priority
                sizes="(max-width: 1024px) 100vw, 58vw"
                src={activeSlide.imageUrl ?? activeSlide.product?.imageUrl}
              />
            </motion.div>
          </AnimatePresence>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0B0B0B]/72 via-transparent to-transparent lg:bg-gradient-to-r lg:from-[#111111]/48 lg:to-transparent" />
        </div>
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
          <p className="text-sm font-black uppercase text-[#67E8F9]">Aksiyalar</p>
          <h2 className="text-2xl font-black text-white">Bugungi foydali takliflar</h2>
        </div>
        <Link className="pressable text-sm font-black text-[#67E8F9]" href="/menu">Menyuga o'tish</Link>
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
