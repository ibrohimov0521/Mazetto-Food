"use client";

import { useState } from "react";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
  sizes?: string;
};

export function BrandLogo({
  className = "h-12 w-auto",
  priority = false,
  sizes = "180px",
}: BrandLogoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        aria-label="MAZETTO FOOD"
        className={`inline-flex items-center font-black uppercase leading-none text-[#F5CF00] drop-shadow-[0_8px_18px_rgba(0,0,0,0.32)] ${className}`}
      >
        MAZETTO FOOD
      </span>
    );
  }

  return (
    <img
      alt="MAZETTO FOOD"
      className={`object-contain ${className}`}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "auto"}
      height={895}
      onError={() => setFailed(true)}
      sizes={sizes}
      src="/brand/mazetto-food-logo.webp"
      width={2048}
    />
  );
}
