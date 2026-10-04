"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "../i18n/navigation";
import type { CustomerLocale } from "../i18n/config";

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("LocaleSwitcher");

  function changeLocale(nextLocale: CustomerLocale) {
    if (nextLocale === locale) return;
    router.replace(`${pathname}${window.location.search}${window.location.hash}`, {
      locale: nextLocale,
    });
  }

  return (
    <div
      aria-label={t("ariaLabel")}
      className="inline-flex shrink-0 items-center rounded-lg border border-white/20 bg-white/10 p-0.5"
      role="group"
    >
      {(["uz", "ru"] as const).map((option) => (
        <button
          aria-pressed={locale === option}
          className={`min-w-8 rounded-md px-1.5 py-1 text-[10px] font-black transition-colors ${locale === option ? "bg-[#F5CF00] text-[#07373A]" : "text-white/80 hover:bg-white/10"}`}
          key={option}
          onClick={() => changeLocale(option)}
          type="button"
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
