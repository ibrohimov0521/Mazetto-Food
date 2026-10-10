const labels = {
  uz: {
    PENDING: "Kutilmoqda",
    SUCCESS: "To'langan",
    PAID: "To'langan",
    FAILED: "O'tmadi",
    REFUNDED: "Qaytarilgan",
    PARTIALLY_REFUNDED: "Qisman qaytarilgan",
  },
  ru: {
    PENDING: "Ожидает оплаты",
    SUCCESS: "Оплачен",
    PAID: "Оплачен",
    FAILED: "Не прошла",
    REFUNDED: "Возвращена",
    PARTIALLY_REFUNDED: "Частичный возврат",
  },
};

/** @param {string} status @param {string} [locale="uz"] */
export function paymentStatusLabel(status, locale = "uz") {
  const language = locale === "ru" ? "ru" : "uz";
  return (
    labels[language][status] ??
    (language === "ru" ? "Статус не определён" : "Holat aniqlanmadi")
  );
}
