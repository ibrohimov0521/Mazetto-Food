import { defineRouting } from "next-intl/routing";
import { defaultLocale, supportedLocales } from "./config";

export const routing = defineRouting({
  locales: supportedLocales,
  defaultLocale,
  localePrefix: "as-needed",
  localeDetection: true,
});
