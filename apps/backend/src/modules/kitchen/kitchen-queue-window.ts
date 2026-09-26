export const MAX_ACTIVE_KITCHEN_TICKETS = 250;

export function trimKitchenQueue<T>(tickets: T[]) {
  return {
    items: tickets.slice(0, MAX_ACTIVE_KITCHEN_TICKETS),
    hasMore: tickets.length > MAX_ACTIVE_KITCHEN_TICKETS,
    limit: MAX_ACTIVE_KITCHEN_TICKETS,
  };
}
