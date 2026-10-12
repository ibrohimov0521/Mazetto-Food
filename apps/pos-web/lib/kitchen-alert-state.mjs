export function getKitchenAlertTicketState(
  previousIds,
  tickets,
  acknowledgedIds = new Set(),
) {
  const activeIds = new Set(
    tickets
      .filter((ticket) => ticket.status === "NEW" && ticket.id)
      .map((ticket) => ticket.id),
  );
  return {
    activeIds,
    arrivedIds: [...activeIds].filter(
      (id) => !previousIds.has(id) && !acknowledgedIds.has(id),
    ),
    pendingIds: [...activeIds].filter((id) => !acknowledgedIds.has(id)),
  };
}
