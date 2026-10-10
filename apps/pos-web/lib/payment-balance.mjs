const collectedStatuses = new Set(["PAID", "SUCCESS", "PARTIALLY_REFUNDED"]);

function toMinorUnits(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;

  const minorUnits = Math.round(amount * 100);
  if (
    !Number.isSafeInteger(minorUnits) ||
    Math.abs(amount - minorUnits / 100) > 0.000001
  ) {
    return null;
  }
  return minorUnits;
}

/**
 * @param {string | number} total
 * @param {{ amount: string | number; status: string; refunds?: { amount: string | number }[] }[]} payments
 */
export function calculateOutstandingPaymentBalance(total, payments) {
  const totalMinorUnits = toMinorUnits(total);
  if (totalMinorUnits === null || !Array.isArray(payments)) return null;

  let paidMinorUnits = 0;
  for (const payment of payments) {
    if (!collectedStatuses.has(payment.status)) continue;

    const amount = toMinorUnits(payment.amount);
    if (
      amount === null ||
      (payment.status === "PARTIALLY_REFUNDED" &&
        !Array.isArray(payment.refunds))
    ) {
      return null;
    }

    const refunds = payment.refunds ?? [];
    if (!Array.isArray(refunds)) return null;
    let refundedMinorUnits = 0;
    for (const refund of refunds) {
      const refundAmount = toMinorUnits(refund.amount);
      if (refundAmount === null) return null;
      refundedMinorUnits += refundAmount;
      if (!Number.isSafeInteger(refundedMinorUnits)) return null;
    }
    if (refundedMinorUnits > amount) return null;

    paidMinorUnits += amount - refundedMinorUnits;
    if (!Number.isSafeInteger(paidMinorUnits)) return null;
  }

  return {
    paid: paidMinorUnits / 100,
    outstanding: Math.max(0, totalMinorUnits - paidMinorUnits) / 100,
  };
}

/**
 * @param {{ amount: string | number; status: string; methodCode?: string | null; method?: { code?: string | null } | null; refund?: { amount: string | number } | null; refunds?: { amount: string | number }[] }[]} payments
 */
export function summarizePaymentPage(payments) {
  let successful = 0;
  let grossMinorUnits = 0;
  let cashMinorUnits = 0;
  let refundsMinorUnits = 0;

  for (const payment of payments) {
    if (collectedStatuses.has(payment.status)) {
      const amount = toMinorUnits(payment.amount);
      if (amount === null) return null;
      successful += 1;
      grossMinorUnits += amount;
      if (!Number.isSafeInteger(grossMinorUnits)) return null;

      const methodCode = payment.method?.code ?? payment.methodCode;
      if (methodCode === "CASH") {
        cashMinorUnits += amount;
        if (!Number.isSafeInteger(cashMinorUnits)) return null;
      }
    }

    const refundRows =
      Array.isArray(payment.refunds) && payment.refunds.length
        ? payment.refunds
        : payment.refund
          ? [payment.refund]
          : [];
    for (const refund of refundRows) {
      const amount = toMinorUnits(refund.amount);
      if (amount === null) return null;
      refundsMinorUnits += amount;
      if (!Number.isSafeInteger(refundsMinorUnits)) return null;
    }
  }

  return {
    total: payments.length,
    successful,
    cash: cashMinorUnits / 100,
    cashless: (grossMinorUnits - cashMinorUnits) / 100,
    refunds: refundsMinorUnits / 100,
  };
}
