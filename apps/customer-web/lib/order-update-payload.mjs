export function orderUpdateId(payload) {
  if (!payload || typeof payload !== "object") return null;
  const event = payload;
  const candidates = [
    event.orderId,
    event.order?.id,
    event.ticket?.orderId,
    event.ticket?.order?.id,
  ];
  return candidates.find((value) => typeof value === "string" && value.length > 0) ?? null;
}

export function matchesOrderUpdate(payload, orderIdFilter) {
  return orderIdFilter === undefined || orderUpdateId(payload) === orderIdFilter;
}
