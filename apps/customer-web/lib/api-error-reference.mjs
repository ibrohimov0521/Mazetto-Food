const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const BASE_MESSAGES = {
  uz: "Serverda vaqtinchalik muammo bor. Bir ozdan keyin qayta urinib ko'ring.",
  ru: "На сервере временная проблема. Попробуйте ещё раз немного позже.",
};

export function customerServerErrorMessage(requestId, locale = "uz") {
  const base = locale === "ru" ? BASE_MESSAGES.ru : BASE_MESSAGES.uz;
  if (typeof requestId !== "string" || !SAFE_REQUEST_ID.test(requestId)) return base;
  const label = locale === "ru" ? "Код обращения: " : "Murojaat kodi: ";
  return base + " " + label + requestId + ".";
}
