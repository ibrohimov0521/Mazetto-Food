export function pickupOutstanding(order) {
  if (order.type !== "TAKEAWAY" || order.paymentStatus === "PAID") return 0;

  const paid = (order.payments ?? [])
    .filter(
      (payment) => payment.status === "PAID" || payment.status === "SUCCESS",
    )
    .reduce((total, payment) => total + Number(payment.amount), 0);

  return Math.max(0, Number(order.total) - paid);
}
