export function pickupOutstanding(order) {
  if (order.type !== "TAKEAWAY" || order.paymentStatus === "PAID") return 0;

  const total = Number(order.total);
  if (!Number.isFinite(total) || total < 0) return 1;

  let paid = 0;
  for (const payment of order.payments ?? []) {
    if (
      payment.status !== "PAID" &&
      payment.status !== "SUCCESS" &&
      payment.status !== "PARTIALLY_REFUNDED"
    ) {
      continue;
    }

    const amount = Number(payment.amount);
    const refunds = payment.refunds ?? [];
    if (
      !Number.isFinite(amount) ||
      amount < 0 ||
      (payment.status === "PARTIALLY_REFUNDED" &&
        !Array.isArray(payment.refunds)) ||
      !Array.isArray(refunds)
    ) {
      return Math.max(total, 1);
    }

    const refunded = refunds.reduce((sum, refund) => {
      const value = Number(refund.amount);
      return Number.isFinite(value) && value >= 0 ? sum + value : Number.NaN;
    }, 0);
    if (!Number.isFinite(refunded) || refunded > amount) {
      return Math.max(total, 1);
    }
    paid += amount - refunded;
  }

  return Math.max(0, total - paid);
}
