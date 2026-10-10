import assert from "node:assert/strict";
import test from "node:test";
import { readOfflineKitchenSnapshot } from "../lib/offline-kitchen-bootstrap.mjs";

const ticket = {
  id: "ticket-a",
  ticketNumber: "K-101",
  status: "COOKING",
  priority: 1,
  version: 2,
  revisionNumber: 1,
  isSupplement: false,
  createdAt: "2026-10-01T08:00:00.000Z",
  acceptedAt: "2026-10-01T08:01:00.000Z",
  items: [
    {
      id: "ticket-item-a",
      productName: "Lavash",
      variantName: null,
      quantity: "1",
      notes: null,
      modifierSnapshot: [],
      stationRouting: "KITCHEN",
      printerNameSnapshot: "Oshxona",
    },
  ],
  order: {
    id: "order-a",
    branchId: "branch-a",
    orderNumber: "A-101",
    displayOrderNumber: "101",
    source: "POS",
    type: "DINE_IN",
    total: "12000",
    paymentStatus: "PENDING",
    payments: [
      {
        amount: "7000",
        status: "PARTIALLY_REFUNDED",
        refunds: [{ amount: "1000" }],
      },
    ],
    isSupplemental: false,
    supplementNumber: null,
    notes: null,
    kitchenComment: null,
    branch: { name: "Mazetto" },
    table: { number: 3, name: "3-stol" },
    items: [
      {
        id: "order-item-a",
        productName: "Lavash",
        variantName: null,
        quantity: "1",
        notes: null,
        modifierSnapshot: [],
      },
    ],
  },
};

const snapshot = () => ({
  schemaVersion: 2,
  branchId: "branch-a",
  generatedAt: "2026-10-01T08:02:00.000Z",
  kitchenQueue: { items: [ticket], hasMore: false, limit: 250 },
});

test("restores a bounded kitchen queue for its authenticated branch", () => {
  assert.deepEqual(readOfflineKitchenSnapshot(snapshot(), "branch-a"), {
    items: [ticket],
    hasMore: false,
    limit: 250,
  });
});

test("rejects cross-branch, unsupported and incomplete kitchen snapshots", () => {
  assert.equal(readOfflineKitchenSnapshot(snapshot(), "branch-b"), null);
  assert.equal(
    readOfflineKitchenSnapshot({ ...snapshot(), schemaVersion: 3 }, "branch-a"),
    null,
  );
  assert.equal(
    readOfflineKitchenSnapshot(
      {
        ...snapshot(),
        kitchenQueue: {
          ...snapshot().kitchenQueue,
          items: [
            { ...ticket, order: { ...ticket.order, branchId: "branch-b" } },
          ],
        },
      },
      "branch-a",
    ),
    null,
  );
  assert.equal(
    readOfflineKitchenSnapshot(
      {
        ...snapshot(),
        kitchenQueue: { items: [ticket], hasMore: false, limit: 0 },
      },
      "branch-a",
    ),
    null,
  );
});

test("rejects cached payment data without refund details", () => {
  assert.equal(
    readOfflineKitchenSnapshot(
      {
        ...snapshot(),
        kitchenQueue: {
          ...snapshot().kitchenQueue,
          items: [
            {
              ...ticket,
              order: {
                ...ticket.order,
                payments: [
                  { amount: "7000", status: "PARTIALLY_REFUNDED" },
                ],
              },
            },
          ],
        },
      },
      "branch-a",
    ),
    null,
  );
});
