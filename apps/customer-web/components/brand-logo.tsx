"use client";
import { useTranslations } from "next-intl";

import { useState } from "react";
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
  const t = useTranslations("Customer");
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        aria-label={t("mazetto_food_2300a7ce")}
        className={`inline-flex items-center font-black uppercase leading-none text-[#FFE86B] drop-shadow-[0_8px_18px_rgba(0,0,0,0.32)] ${className}`}
      >
        {t("mazetto_food_2300a7ce")}</span>
    );
  }

  return (
    <Image
      alt={t("mazetto_food_2300a7ce")}
      className={`object-contain ${className}`}
      priority={priority}
      height={227}
      onError={() => setFailed(true)}
      sizes={sizes}
      src="/brand/header-logo.webp"
      width={520}
    />
  );
}
