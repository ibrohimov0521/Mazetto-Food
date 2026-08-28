"use client";

import Image from "next/image";

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
  return (
    <Image
      alt="MAZETTO FOOD"
      className={`object-contain ${className}`}
      height={895}
      priority={priority}
      sizes={sizes}
      src="/brand/mazetto-food-logo.webp"
      width={2048}
    />
  );
}
