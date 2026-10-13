/**
 * @param {{ code: string, name: string, active?: boolean }[]} paymentMethods
 * @param {boolean} offline
 */
export function filterOfflinePaymentMethods(paymentMethods, offline) {
  return offline
    ? paymentMethods.filter((method) => method.code === "CASH")
    : paymentMethods;
}

/**
 * @param {boolean} bootstrapSnapshotUsed
 * @param {boolean} cachedCatalogResponse
 */
export function isOfflineCatalogSnapshot(
  bootstrapSnapshotUsed,
  cachedCatalogResponse,
) {
  return bootstrapSnapshotUsed || cachedCatalogResponse;
}

/**
 * @param {{
 *   catalogReady: boolean;
 *   hasItems: boolean;
 *   deferredPayment: boolean;
 *   paymentMethodCount: number;
 *   isCashPayment: boolean;
 *   validCash: boolean;
 * }} input
 */
export function canSubmitPosCheckout({
  catalogReady,
  hasItems,
  deferredPayment,
  paymentMethodCount,
  isCashPayment,
  validCash,
}) {
  return (
    catalogReady &&
    hasItems &&
    (deferredPayment ||
      (paymentMethodCount > 0 && (!isCashPayment || validCash)))
  );
}
