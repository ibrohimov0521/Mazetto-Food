import * as rootParams from "next/root-params";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ locale }) => {
  let requestLocale = locale;
  if (!requestLocale) {
    const routeLocale = await rootParams.locale();
    if (hasLocale(routing.locales, routeLocale)) {
      requestLocale = routeLocale;
    }
  }

  if (!requestLocale || !hasLocale(routing.locales, requestLocale)) {
    notFound();
  }
  return {
    locale: requestLocale,
    messages: (await import(`../messages/${requestLocale}.json`)).default,
    timeZone: "Asia/Tashkent",
  };
});
