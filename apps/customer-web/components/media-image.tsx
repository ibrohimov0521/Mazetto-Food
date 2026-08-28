"use client";

import Image from "next/image";
import { forwardRef, useMemo, useState } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { productImage } from "../lib/cart";

type MediaImageProps = {
  alt: string;
  src?: string | null | undefined;
  aspectClassName?: string;
  className?: string;
  imageClassName?: string;
  sizes: string;
  priority?: boolean;
  fit?: "cover" | "contain";
  fallbackLabel?: string;
  motionProps?: HTMLMotionProps<"div">;
};

const mediaOrigin = process.env.NEXT_PUBLIC_MEDIA_URL?.replace(/\/$/, "");

export const MediaImage = forwardRef<HTMLDivElement, MediaImageProps>(function MediaImage({
  alt,
  src,
  aspectClassName = "aspect-[4/3]",
  className = "",
  imageClassName = "",
  sizes,
  priority = false,
  fit = "cover",
  fallbackLabel = "Rasm tayyorlanmoqda",
  motionProps,
}: MediaImageProps, ref) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const resolvedSrc = useMemo(() => productImage(src), [src]);
  const canUseNextImage = isNextImageCompatible(resolvedSrc);

  return (
    <motion.div
      {...motionProps}
      className={`relative overflow-hidden ${aspectClassName} ${className}`}
      ref={ref}
    >
      {!loaded && !failed ? <div className="skeleton absolute inset-0" /> : null}
      {failed || !resolvedSrc ? (
        <MediaFallback label={fallbackLabel} />
      ) : canUseNextImage ? (
        <Image
          alt={alt}
          className={`transition-opacity duration-300 ease-out ${fit === "cover" ? "object-cover" : "object-contain"} ${loaded ? "opacity-100" : "opacity-0"} ${imageClassName}`}
          fill
          onError={() => setFailed(true)}
          onLoad={() => setLoaded(true)}
          priority={priority}
          sizes={sizes}
          src={resolvedSrc}
        />
      ) : (
        <img
          alt={alt}
          className={`h-full w-full transition-opacity duration-300 ease-out ${fit === "cover" ? "object-cover" : "object-contain"} ${loaded ? "opacity-100" : "opacity-0"} ${imageClassName}`}
          loading={priority ? "eager" : "lazy"}
          onError={() => setFailed(true)}
          onLoad={() => setLoaded(true)}
          src={resolvedSrc}
        />
      )}
    </motion.div>
  );
});

function isNextImageCompatible(src: string): boolean {
  if (!src) {
    return false;
  }

  if (src.startsWith("/")) {
    return true;
  }

  if (!mediaOrigin) {
    return false;
  }

  return src.startsWith(`${mediaOrigin}/`);
}

function MediaFallback({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_20%,rgba(245,207,0,0.22),transparent_48%),linear-gradient(145deg,rgba(0,79,85,0.92),rgba(8,104,106,0.78))] px-4 text-center">
      <div>
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/14 bg-white/10 text-[#F5CF00] shadow-[0_12px_34px_rgba(245,207,0,0.18)]">
          <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11Z" stroke="currentColor" strokeWidth="2" />
            <path d="m5 17 4.2-4.2a1.5 1.5 0 0 1 2.1 0L13 14.5l2.2-2.2a1.5 1.5 0 0 1 2.1 0L20 15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            <path d="M15.5 8.5h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
          </svg>
        </div>
        <p className="mt-3 line-clamp-2 text-xs font-black leading-4 text-[#F5F5EF]/78">{label}</p>
      </div>
    </div>
  );
}
