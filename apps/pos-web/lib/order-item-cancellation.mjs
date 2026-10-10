const refundableStatuses = new Set([
  "SUCCESS",
  "PAID",
  "PARTIALLY_REFUNDED",
]);

function toMinorUnits(value) {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(String(value ?? "").trim());
  if (!match) return null;

  const fractional = match[2] ?? "";
  const whole = Number(match[1]);
  const cents = Number((fractional + "00").slice(0, 2));
  const roundedCents = cents + (Number(fractional[2] ?? "0") >= 5 ? 1 : 0);
  const minorUnits = whole * 100 + roundedCents;
  return Number.isSafeInteger(minorUnits) ? minorUnits : null;
}

/**
 * UI permission hint matching the server's post-cancellation balance rule.
 * Invalid monetary data fails closed and requires refund permission.
 *
 * @param {{ orderTotal: string | number; itemTotal: string | number; payments: { amount: string | number; status: string; refunds?: { amount: string | number }[] }[] }} input
 */
export function orderItemCancellationNeedsRefundPermission({
  orderTotal,
  itemTotal,
  payments,
}) {
  const total = toMinorUnits(orderTotal);
  const item = toMinorUnits(itemTotal);
  if (total === null || item === null) return true;

  let netPaid = 0;
  for (const payment of payments) {
    if (!refundableStatuses.has(payment.status)) continue;

    const amount = toMinorUnits(payment.amount);
    if (amount === null) return true;

    let refunded = 0;
    for (const refund of payment.refunds ?? []) {
      const refundAmount = toMinorUnits(refund.amount);
      if (refundAmount === null) return true;
      refunded += refundAmount;
    }
    netPaid += Math.max(amount - refunded, 0);
    if (!Number.isSafeInteger(netPaid)) return true;
  }

  const remainingTotal = Math.max(total - item, 0);
  return netPaid > remainingTotal;
}
