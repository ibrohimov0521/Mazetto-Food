function createShift() {
  const openedAt = new Date(Date.now() - 8 * 60_000).toISOString();
  return {
    id: "s1",
    shiftNumber: 24,
    status: "OPEN",
    openingBalance: "100000",
    expectedCash: "460000",
    cashSales: "360000",
    orderCount: 10,
    openedAt,
    branch: {
      id: "qa-branch",
      name: "MAZETTO Sergeli",
      address: "Sergeli 7/3",
    },
    employee: { firstName: "Sinov", lastName: "Kassir" },
    cashTransactions: [
      { id: "cash1", type: "CASH_SALE", amount: "360000", occurredAt: openedAt },
    ],
  };
}

const session = {
  user: {
    id: "qa-staff",
    email: "sinov@mazetto.example",
    employeeId: "qa-employee",
    branchId: "qa-branch",
    roles: ["CASHIER", "KITCHEN", "COURIER"],
    permissions: [
      "POS_USE",
      "SHIFT_VIEW_OWN",
      "KITCHEN_VIEW",
      "KITCHEN_ACCEPT",
      "KITCHEN_STATUS_UPDATE",
      "COURIER_DELIVERY_VIEW",
      "COURIER_DELIVERY_UPDATE",
    ],
  },
  tokens: {
    accessToken: "qa-intercepted",
    refreshToken: "qa-intercepted",
    tokenType: "Bearer",
  },
};

module.exports = { createShift, session };
