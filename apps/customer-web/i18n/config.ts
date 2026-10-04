export const supportedLocales = ["uz", "ru"] as const;
export type CustomerLocale = (typeof supportedLocales)[number];

export const defaultLocale: CustomerLocale = "uz";
